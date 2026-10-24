import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PrReviewState } from './entities/pr-review-state.entity.js';

@Injectable()
export class ReviewStateService {
  constructor(
    @InjectRepository(PrReviewState)
    private readonly states: Repository<PrReviewState>,
  ) {}

  // Atomically record a new head SHA. Returns null when the SHA is already the desired one
  // (redelivered webhook), so the generation never moves for the same commit.
  // Raw SQL because TypeORM's upsert cannot express a conditional increment.
  async bump(
    repository: string,
    prNumber: number,
    sha: string,
  ): Promise<number | null> {
    const rows: { generation: number }[] = await this.states.query(
      `INSERT INTO pr_review_state (repository, pr_number, desired_sha, generation, status)
       VALUES ($1, $2, $3, 1, 'queued')
       ON CONFLICT (repository, pr_number) DO UPDATE
         SET desired_sha = EXCLUDED.desired_sha,
             generation  = pr_review_state.generation + 1,
             status      = 'queued',
             updated_at  = now()
         WHERE pr_review_state.desired_sha <> EXCLUDED.desired_sha
       RETURNING generation`,
      [repository, prNumber, sha],
    );
    return rows[0]?.generation ?? null;
  }

  // PR closed or merged: clear the desired SHA so every queued or running job for it
  // fails its staleness check. Returns the last generation, or null if never reviewed.
  async close(repository: string, prNumber: number): Promise<number | null> {
    // TypeORM returns [rows, affectedCount] for UPDATE ... RETURNING on Postgres.
    const [rows]: [{ generation: number }[], number] = await this.states.query(
      `UPDATE pr_review_state
       SET desired_sha = '', status = 'closed', updated_at = now()
       WHERE repository = $1 AND pr_number = $2
       RETURNING generation`,
      [repository, prNumber],
    );
    return rows[0]?.generation ?? null;
  }

  isCurrent(
    repository: string,
    prNumber: number,
    sha: string,
    generation: number,
  ): Promise<boolean> {
    return this.states.existsBy({
      repository,
      prNumber,
      desiredSha: sha,
      generation,
    });
  }

  async markPublished(
    repository: string,
    prNumber: number,
    generation: number,
    sha: string,
    reviewId: number,
  ): Promise<void> {
    await this.states.update(
      { repository, prNumber, generation },
      { status: 'published', publishedSha: sha, reviewId: String(reviewId) },
    );
  }
}
