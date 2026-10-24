import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PrReviewComment } from './entities/pr-review-comment.entity.js';
import type { CheckedFinding } from './utils/review.utils.js';

@Injectable()
export class ReviewHistoryService {
  constructor(
    @InjectRepository(PrReviewComment)
    private readonly comments: Repository<PrReviewComment>,
  ) {}

  list(repository: string, prNumber: number): Promise<PrReviewComment[]> {
    return this.comments.find({
      where: { repository, prNumber },
      order: { id: 'ASC' },
    });
  }

  async record(
    repository: string,
    prNumber: number,
    sha: string,
    findings: CheckedFinding[],
  ): Promise<void> {
    await this.comments.insert(
      findings.map((f) => ({
        repository,
        prNumber,
        sha,
        path: f.path,
        startLine: f.startLine ?? null,
        line: f.line,
        body: f.body,
        fingerprint: f.fingerprint,
      })),
    );
  }

  // Forget PRs closed more than `days` ago: their comment history and their state row.
  // The delay lets a PR reopened soon after closing keep its history.
  async purgeClosed(days: number): Promise<number> {
    // TypeORM returns [rows, affectedCount] for DELETE on Postgres.
    const [, removed]: [unknown[], number] = await this.comments.query(
      `WITH closed AS (
         DELETE FROM pr_review_state
         WHERE status = 'closed' AND updated_at < now() - make_interval(days => $1)
         RETURNING repository, pr_number
       )
       DELETE FROM pr_review_comment c
       USING closed
       WHERE c.repository = closed.repository AND c.pr_number = closed.pr_number`,
      [days],
    );
    return removed;
  }
}
