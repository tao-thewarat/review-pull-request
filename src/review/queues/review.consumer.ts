import { Processor, WorkerHost } from '@nestjs/bullmq';
import { ReviewService } from '../review.service.js';
import { Job } from 'bullmq';
import type { ReviewJob } from './review.producer.js';

@Processor('pr-review', {
  concurrency: 2,
})
export class ReviewProcessor extends WorkerHost {
  constructor(private readonly reviewService: ReviewService) {
    super();
  }
  async process(job: Job<ReviewJob>): Promise<void> {
    await this.reviewService.run(job.data);
  }
}
