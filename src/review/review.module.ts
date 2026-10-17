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
import { ReviewProcessor } from './review.consumer.js';
import { ReviewProducer } from './review.producer.js';
import { ReviewStateService } from './review-state.service.js';
import { PrReviewState } from './pr-review-state.entity.js';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'pr-review',
    }),
    BullBoardModule.forFeature({
      name: 'pr-review',
      adapter: BullMQAdapter,
    }),
    TypeOrmModule.forFeature([PrReviewState]),
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
  ],
  exports: [ReviewProducer],
})
export class ReviewModule {}
