import type { Queue } from 'bullmq';
import type { Octokit } from 'octokit';
import type { ReviewStateService } from './review-state.service.js';
import { type ReviewJob, ReviewProducer } from './review.producer.js';

describe('ReviewProducer', () => {
  const queue = { remove: vi.fn(), add: vi.fn() };
  const github = {
    paginate: vi.fn(),
    rest: { pulls: { get: vi.fn(), listCommits: vi.fn() } },
  };
  const state = { bump: vi.fn() };
  const producer = new ReviewProducer(
    queue as unknown as Queue<ReviewJob>,
    github as unknown as Octokit,
    state as unknown as ReviewStateService,
  );
  const pr = {
    state: 'open',
    title: '[ADD] IC20-12 cheque',
    body: null,
    head: { sha: 'sha-2', ref: 'feature/IC20-9-cheque' },
    base: { ref: 'main' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    github.rest.pulls.get.mockResolvedValue({ data: pr });
    state.bump.mockResolvedValue(3);
    github.paginate.mockResolvedValue([
      { commit: { message: 'feat: cheque [IC20-9,IC20-10]' } },
      { commit: { message: 'fix: IC20-11' } },
    ]);
    queue.add.mockResolvedValue({ id: 'owner/repo#7@3' });
  });

  it('ignores a PR that is no longer open', async () => {
    github.rest.pulls.get.mockResolvedValueOnce({
      data: { ...pr, state: 'closed' },
    });
    await expect(producer.enqueue('owner', 'repo', 7)).resolves.toBeNull();
    expect(state.bump).not.toHaveBeenCalled();
  });

  it('skips when the head SHA is already queued', async () => {
    state.bump.mockResolvedValueOnce(null);
    await expect(producer.enqueue('owner', 'repo', 7)).resolves.toBeNull();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('replaces the previous job and queues the current head', async () => {
    await expect(producer.enqueue('owner', 'repo', 7)).resolves.toEqual({
      id: 'owner/repo#7@3',
    });

    expect(github.rest.pulls.get).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      pull_number: 7,
    });
    expect(state.bump).toHaveBeenCalledWith('owner/repo', 7, 'sha-2');
    expect(github.paginate).toHaveBeenCalledWith(
      github.rest.pulls.listCommits,
      {
        owner: 'owner',
        repo: 'repo',
        pull_number: 7,
      },
    );
    expect(queue.remove).toHaveBeenCalledWith('owner/repo#7@2');
    expect(queue.add).toHaveBeenCalledWith(
      'review',
      {
        owner: 'owner',
        repo: 'repo',
        pullNumber: 7,
        baseRef: 'main',
        headSha: 'sha-2',
        generation: 3,
        taskKeys: ['IC20-9', 'IC20-12', 'IC20-10', 'IC20-11'],
      },
      expect.objectContaining({ jobId: 'owner/repo#7@3', attempts: 3 }),
    );
  });
});
