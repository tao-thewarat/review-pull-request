import type { Repository } from 'typeorm';
import type { PrReviewState } from './pr-review-state.entity.js';
import { ReviewStateService } from './review-state.service.js';

describe('ReviewStateService', () => {
  const states = { query: vi.fn(), existsBy: vi.fn(), update: vi.fn() };
  const service = new ReviewStateService(
    states as unknown as Repository<PrReviewState>,
  );

  beforeEach(() => vi.clearAllMocks());

  it('returns the new generation when the SHA changes', async () => {
    states.query.mockResolvedValueOnce([{ generation: 4 }]);
    await expect(service.bump('o/r', 7, 'sha')).resolves.toBe(4);
    expect(states.query).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT'),
      ['o/r', 7, 'sha'],
    );
  });

  it('returns null for a SHA that is already desired', async () => {
    states.query.mockResolvedValueOnce([]);
    await expect(service.bump('o/r', 7, 'sha')).resolves.toBeNull();
  });

  it('clears the desired SHA when the PR closes', async () => {
    states.query.mockResolvedValueOnce([[{ generation: 3 }], 1]);
    await expect(service.close('o/r', 7)).resolves.toBe(3);
    expect(states.query).toHaveBeenCalledWith(
      expect.stringContaining("desired_sha = ''"),
      ['o/r', 7],
    );
  });

  it('returns null when closing a PR that was never reviewed', async () => {
    states.query.mockResolvedValueOnce([[], 0]);
    await expect(service.close('o/r', 7)).resolves.toBeNull();
  });

  it('checks SHA and generation together', async () => {
    states.existsBy.mockResolvedValueOnce(true);
    await expect(service.isCurrent('o/r', 7, 'sha', 2)).resolves.toBe(true);
    expect(states.existsBy).toHaveBeenCalledWith({
      repository: 'o/r',
      prNumber: 7,
      desiredSha: 'sha',
      generation: 2,
    });
  });

  it('marks the generation as published', async () => {
    await service.markPublished('o/r', 7, 2, 'sha', 55);
    expect(states.update).toHaveBeenCalledWith(
      { repository: 'o/r', prNumber: 7, generation: 2 },
      { status: 'published', publishedSha: 'sha', reviewId: '55' },
    );
  });
});
