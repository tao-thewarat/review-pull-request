import { BadRequestException } from '@nestjs/common';
import { CommitMessageController } from './commit-message.controller.js';
import type { CommitMessageService } from './commit-message.service.js';

describe('CommitMessageController', () => {
  const generate = vi.fn();
  const controller = new CommitMessageController({
    generate,
  } as unknown as CommitMessageService);

  it('returns the generated message', async () => {
    generate.mockResolvedValueOnce('feat: Add x');
    await expect(controller.generate({ diff: 'diff --git' })).resolves.toEqual({
      message: 'feat: Add x',
    });
    expect(generate).toHaveBeenCalledWith('diff --git');
  });

  it.each([undefined, {}, { diff: '' }, { diff: '   ' }, { diff: 42 }])(
    'rejects body %j',
    async (body) => {
      await expect(controller.generate(body)).rejects.toThrow(
        BadRequestException,
      );
    },
  );
});
