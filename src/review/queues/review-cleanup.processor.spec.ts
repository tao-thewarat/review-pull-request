import type { Queue } from 'bullmq';
import { ReviewCleanupProcessor } from './review-cleanup.processor.js';
import type { ReviewHistoryService } from '../review-history.service.js';

describe('ReviewCleanupProcessor', () => {
  const queue = { upsertJobScheduler: vi.fn() };
  const history = { purgeClosed: vi.fn() };
  const processor = new ReviewCleanupProcessor(
    queue as unknown as Queue,
    history as unknown as ReviewHistoryService,
  );

  it('schedules a daily cleanup at 03:00', async () => {
    await processor.onModuleInit();
    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      'daily-cleanup',
      { pattern: '0 3 * * *' },
      { name: 'cleanup' },
    );
  });

  it('purges PRs closed more than 7 days ago', async () => {
    history.purgeClosed.mockResolvedValueOnce(3);
    await processor.process();
    expect(history.purgeClosed).toHaveBeenCalledWith(7);
  });
});
