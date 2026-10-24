import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

// Every inline comment posted on a PR, so later pushes do not repeat it.
@Entity('pr_review_comment')
@Index(['repository', 'prNumber'])
export class PrReviewComment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text' })
  repository: string;

  @Column({ name: 'pr_number', type: 'integer' })
  prNumber: number;

  @Column({ type: 'text' })
  sha: string;

  @Column({ type: 'text' })
  path: string;

  @Column({ name: 'start_line', type: 'integer', nullable: true })
  startLine: number | null;

  @Column({ type: 'integer' })
  line: number;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'text' })
  fingerprint: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
