import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ReviewHistoryService } from '../review-history.service.js';

const CLEANUP_AFTER_DAYS = 7;

// Daily cron on BullMQ: one run per day even with several app instances.
@Processor('review-cleanup')
export class ReviewCleanupProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(ReviewCleanupProcessor.name);

  constructor(
    @InjectQueue('review-cleanup') private readonly queue: Queue,
    private readonly history: ReviewHistoryService,
  ) {
    super();
  }

  async onModuleInit() {
    await this.queue.upsertJobScheduler(
      'daily-cleanup',
      { pattern: '0 3 * * *' },
      { name: 'cleanup' },
    );
  }

  async process(): Promise<void> {
    const removed = await this.history.purgeClosed(CLEANUP_AFTER_DAYS);
    this.logger.log(
      `Removed ${removed} comments of PRs closed over ${CLEANUP_AFTER_DAYS} days ago`,
    );
  }
}
