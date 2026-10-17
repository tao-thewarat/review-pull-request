import type { Octokit } from 'octokit';
import { DiffService } from './diff.service.js';

describe('DiffService', () => {
  const compareCommitsWithBasehead = vi.fn();
  const service = new DiffService({
    rest: { repos: { compareCommitsWithBasehead } },
  } as unknown as Octokit);

  it('compares base...head and annotates patches', async () => {
    compareCommitsWithBasehead.mockResolvedValueOnce({
      data: {
        files: [
          { filename: 'a.ts', patch: '@@ -1,1 +1,1 @@\n+x();' },
          { filename: 'logo.png' },
        ],
      },
    });

    const files = await service.getDiff('o', 'r', 'main', 'sha');

    expect(compareCommitsWithBasehead).toHaveBeenCalledWith({
      owner: 'o',
      repo: 'r',
      basehead: 'main...sha',
    });
    expect(files).toEqual([
      {
        path: 'a.ts',
        annotated: '@@ -1,1 +1,1 @@\n   1 +x();',
        lines: new Set([1]),
      },
      { path: 'logo.png', annotated: null, lines: new Set() },
    ]);
  });

  it('returns no files when GitHub omits them', async () => {
    compareCommitsWithBasehead.mockResolvedValueOnce({ data: {} });
    await expect(service.getDiff('o', 'r', 'main', 'sha')).resolves.toEqual([]);
  });
});
