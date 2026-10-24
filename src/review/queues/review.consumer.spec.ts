import type { Job } from 'bullmq';
import { ReviewProcessor } from './review.consumer.js';
import type { ReviewJob } from './review.producer.js';
import type { ReviewService } from '../review.service.js';

describe('ReviewProcessor', () => {
  it('runs the review for the job data', async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    const processor = new ReviewProcessor({ run } as unknown as ReviewService);
    const data = { owner: 'o' } as ReviewJob;

    await processor.process({ data } as Job<ReviewJob>);

    expect(run).toHaveBeenCalledWith(data);
  });
});
