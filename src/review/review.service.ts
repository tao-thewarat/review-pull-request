import { Injectable, Logger } from '@nestjs/common';
import { Octokit } from 'octokit';
import { AiService } from '../ai/ai.service.js';
import { DiffService } from '../diff/diff.service.js';
import { TaskService } from '../task/task.service.js';
import { ReviewStateService } from './review-state.service.js';
import { ReviewHistoryService } from './review-history.service.js';
import type { ReviewJob } from './queues/review.producer.js';
import { commentBody, validateFindings } from './utils/review.utils.js';

@Injectable()
export class ReviewService {
  private readonly logger = new Logger(ReviewService.name);

  constructor(
    private readonly github: Octokit,
    private readonly diff: DiffService,
    private readonly tasks: TaskService,
    private readonly ai: AiService,
    private readonly state: ReviewStateService,
    private readonly history: ReviewHistoryService,
  ) {}

  async run(job: ReviewJob): Promise<void> {
    const { owner, repo, pullNumber, baseRef, headSha, generation, taskKeys } =
      job;
    const repository = `${owner}/${repo}`;
    const label = `${repository}#${pullNumber}@${headSha.slice(0, 7)}`;
    const isCurrent = () =>
      this.state.isCurrent(repository, pullNumber, headSha, generation);

    if (!(await isCurrent())) {
      this.logger.log(`Skip stale job ${label}`);
      return;
    }

    const files = await this.diff.getDiff(owner, repo, baseRef, headSha);
    const tasks = await this.tasks.getTasks(taskKeys);
    // Comments from earlier pushes: shown to the model, and filtered out again if repeated
    // on code that has not changed since.
    const previous = await this.history.list(repository, pullNumber);
    const review = await this.ai.review(files, tasks, previous);
    const findings = validateFindings(
      review.findings,
      files,
      new Set(previous.map((c) => c.fingerprint)),
    );

    // The AI call is slow; a newer push may have landed meanwhile.
    if (!(await isCurrent())) {
      this.logger.log(`Discard stale result ${label}`);
      return;
    }

    // The marker makes retries idempotent: a review already posted for this SHA is reused.
    const marker = `<!-- ai-review sha=${headSha} -->`;
    const reviews = await this.github.paginate(
      this.github.rest.pulls.listReviews,
      { owner, repo, pull_number: pullNumber },
    );
    let reviewId = reviews.find((r) => r.body?.includes(marker))?.id;

    if (!reviewId) {
      // commit_id pins the review to the analysed SHA even if a push slips in after the check.
      const { data } = await this.github.rest.pulls.createReview({
        owner,
        repo,
        pull_number: pullNumber,
        commit_id: headSha,
        event: 'COMMENT',
        body: `${review.summary || 'No summary.'}\n\nReviewed commit \`${headSha}\`${tasks.length ? ` against ${tasks.map((t) => t.key).join(', ')}` : ''}.\n\n${marker}`,
        comments: findings.map((f) => ({
          path: f.path,
          ...(f.startLine && {
            start_line: f.startLine,
            start_side: 'RIGHT' as const,
          }),
          line: f.line,
          side: 'RIGHT' as const,
          body: commentBody(f),
        })),
      });
      reviewId = data.id;
      await this.history.record(repository, pullNumber, headSha, findings);
    }

    await this.state.markPublished(
      repository,
      pullNumber,
      generation,
      headSha,
      reviewId,
    );
    this.logger.log(
      `Published review ${reviewId} for ${label} (${findings.length} comments)`,
    );
  }
}
