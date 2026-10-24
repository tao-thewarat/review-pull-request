import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { AiModule } from '../ai/ai.module.js';
import { DiffModule } from '../diff/diff.module.js';
import { OctokitModule } from '../octokit/octokit.module.js';
import { TaskModule } from '../task/task.module.js';
import { ReviewService } from './review.service.js';
import { ReviewProcessor } from './queues/review.consumer.js';
import { ReviewProducer } from './queues/review.producer.js';
import { ReviewStateService } from './review-state.service.js';
import { PrReviewState } from './entities/pr-review-state.entity.js';
import { PrReviewComment } from './entities/pr-review-comment.entity.js';
import { ReviewHistoryService } from './review-history.service.js';
import { ReviewCleanupProcessor } from './queues/review-cleanup.processor.js';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'pr-review' }, { name: 'review-cleanup' }),
    BullBoardModule.forFeature(
      { name: 'pr-review', adapter: BullMQAdapter },
      { name: 'review-cleanup', adapter: BullMQAdapter },
    ),
    TypeOrmModule.forFeature([PrReviewState, PrReviewComment]),
    OctokitModule,
    DiffModule,
    TaskModule,
    AiModule,
  ],
  providers: [
    ReviewProducer,
    ReviewProcessor,
    ReviewService,
    ReviewStateService,
    ReviewHistoryService,
    ReviewCleanupProcessor,
  ],
  exports: [ReviewProducer],
})
export class ReviewModule {}
