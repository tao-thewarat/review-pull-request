import type { Octokit } from 'octokit';
import type { AiService } from '../ai/ai.service.js';
import type { DiffService } from '../diff/diff.service.js';
import { parsePatch } from '../diff/diff.utils.js';
import type { TaskService } from '../task/task.service.js';
import type { ReviewStateService } from './review-state.service.js';
import type { ReviewJob } from './review.producer.js';
import { ReviewService } from './review.service.js';

describe('ReviewService', () => {
  const job: ReviewJob = {
    owner: 'owner',
    repo: 'repo',
    pullNumber: 7,
    baseRef: 'main',
    headSha: 'abcdef1234567',
    generation: 2,
    taskKey: 'IC20-9',
  };
  const files = [
    { path: 'a.ts', ...parsePatch('@@ -1,1 +1,3 @@\n a();\n+b();\n+c();') },
  ];
  const task = { key: 'IC20-9', title: 'Task', description: 'Do it' };

  const github = {
    paginate: vi.fn(),
    rest: { pulls: { listReviews: vi.fn(), createReview: vi.fn() } },
  };
  const diff = { getDiff: vi.fn() };
  const tasks = { getTask: vi.fn() };
  const ai = { review: vi.fn() };
  const state = { isCurrent: vi.fn(), markPublished: vi.fn() };
  const service = new ReviewService(
    github as unknown as Octokit,
    diff as unknown as DiffService,
    tasks as unknown as TaskService,
    ai as unknown as AiService,
    state as unknown as ReviewStateService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    state.isCurrent.mockResolvedValue(true);
    diff.getDiff.mockResolvedValue(files);
    tasks.getTask.mockResolvedValue(task);
    ai.review.mockResolvedValue({
      summary: 'Looks fine',
      findings: [
        {
          path: 'a.ts',
          startLine: 2,
          line: 3,
          body: 'block',
          suggestion: 'd();',
        },
        { path: 'a.ts', line: 2, body: 'single' },
        { path: 'a.ts', line: 99, body: 'outside diff' },
      ],
    });
    github.paginate.mockResolvedValue([{ id: 1, body: null }]);
    github.rest.pulls.createReview.mockResolvedValue({ data: { id: 55 } });
  });

  it('skips a job that is already stale', async () => {
    state.isCurrent.mockResolvedValueOnce(false);
    await service.run(job);
    expect(diff.getDiff).not.toHaveBeenCalled();
  });

  it('discards the result when a newer push lands during analysis', async () => {
    state.isCurrent.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await service.run(job);
    expect(ai.review).toHaveBeenCalled();
    expect(github.rest.pulls.createReview).not.toHaveBeenCalled();
    expect(state.markPublished).not.toHaveBeenCalled();
  });

  it('posts a review pinned to the commit with validated comments', async () => {
    await service.run(job);

    expect(diff.getDiff).toHaveBeenCalledWith(
      'owner',
      'repo',
      'main',
      job.headSha,
    );
    expect(tasks.getTask).toHaveBeenCalledWith('IC20-9');
    expect(ai.review).toHaveBeenCalledWith(files, task);
    expect(github.paginate).toHaveBeenCalledWith(
      github.rest.pulls.listReviews,
      {
        owner: 'owner',
        repo: 'repo',
        pull_number: 7,
      },
    );
    expect(github.rest.pulls.createReview).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      pull_number: 7,
      commit_id: job.headSha,
      event: 'COMMENT',
      body: `Looks fine\n\nReviewed commit \`${job.headSha}\` against task IC20-9.\n\n<!-- ai-review sha=${job.headSha} -->`,
      comments: [
        {
          path: 'a.ts',
          start_line: 2,
          start_side: 'RIGHT',
          line: 3,
          side: 'RIGHT',
          body: 'block\n\n```suggestion\nd();\n```',
        },
        { path: 'a.ts', line: 2, side: 'RIGHT', body: 'single' },
      ],
    });
    expect(state.markPublished).toHaveBeenCalledWith(
      'owner/repo',
      7,
      2,
      job.headSha,
      55,
    );
  });

  it('reviews without a task and falls back to a default summary', async () => {
    ai.review.mockResolvedValueOnce({ summary: '', findings: [] });
    await service.run({ ...job, taskKey: null });

    expect(tasks.getTask).not.toHaveBeenCalled();
    expect(ai.review).toHaveBeenCalledWith(files, null);
    expect(github.rest.pulls.createReview).toHaveBeenCalledWith(
      expect.objectContaining({
        body: `No summary.\n\nReviewed commit \`${job.headSha}\`.\n\n<!-- ai-review sha=${job.headSha} -->`,
        comments: [],
      }),
    );
  });

  it('reuses a review already posted for the same SHA on retry', async () => {
    github.paginate.mockResolvedValueOnce([
      { id: 1, body: 'old' },
      { id: 42, body: `x <!-- ai-review sha=${job.headSha} -->` },
    ]);
    await service.run(job);

    expect(github.rest.pulls.createReview).not.toHaveBeenCalled();
    expect(state.markPublished).toHaveBeenCalledWith(
      'owner/repo',
      7,
      2,
      job.headSha,
      42,
    );
  });
});
