import type { Repository } from 'typeorm';
import type { PrReviewComment } from './entities/pr-review-comment.entity.js';
import { ReviewHistoryService } from './review-history.service.js';

describe('ReviewHistoryService', () => {
  const comments = { find: vi.fn(), insert: vi.fn(), query: vi.fn() };
  const service = new ReviewHistoryService(
    comments as unknown as Repository<PrReviewComment>,
  );

  beforeEach(() => vi.clearAllMocks());

  it('lists the comments of one PR in posting order', async () => {
    comments.find.mockResolvedValueOnce([{ id: 1 }]);
    await expect(service.list('o/r', 7)).resolves.toEqual([{ id: 1 }]);
    expect(comments.find).toHaveBeenCalledWith({
      where: { repository: 'o/r', prNumber: 7 },
      order: { id: 'ASC' },
    });
  });

  it('records posted comments with their fingerprints', async () => {
    await service.record('o/r', 7, 'sha', [
      { path: 'a.ts', startLine: 2, line: 3, body: 'b', fingerprint: 'f1' },
      { path: 'a.ts', line: 5, body: 'c', fingerprint: 'f2' },
    ]);
    expect(comments.insert).toHaveBeenCalledWith([
      {
        repository: 'o/r',
        prNumber: 7,
        sha: 'sha',
        path: 'a.ts',
        startLine: 2,
        line: 3,
        body: 'b',
        fingerprint: 'f1',
      },
      {
        repository: 'o/r',
        prNumber: 7,
        sha: 'sha',
        path: 'a.ts',
        startLine: null,
        line: 5,
        body: 'c',
        fingerprint: 'f2',
      },
    ]);
  });

  it('purges history and state of PRs closed long ago', async () => {
    comments.query.mockResolvedValueOnce([[], 4]);
    await expect(service.purgeClosed(7)).resolves.toBe(4);
    expect(comments.query).toHaveBeenCalledWith(
      expect.stringContaining("status = 'closed'"),
      [7],
    );
  });
});
