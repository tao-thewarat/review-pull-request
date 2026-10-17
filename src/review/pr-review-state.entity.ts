import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

// Latest desired review per PR, kept outside the queue so stale jobs can be detected.
@Entity('pr_review_state')
export class PrReviewState {
  @PrimaryColumn({ type: 'text' })
  repository: string;

  @PrimaryColumn({ name: 'pr_number', type: 'integer' })
  prNumber: number;

  @Column({ name: 'desired_sha', type: 'text' })
  desiredSha: string;

  @Column({ type: 'integer' })
  generation: number;

  @Column({ type: 'text' })
  status: string;

  @Column({ name: 'published_sha', type: 'text', nullable: true })
  publishedSha: string | null;

  // bigint comes back from pg as string
  @Column({ name: 'review_id', type: 'bigint', nullable: true })
  reviewId: string | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
