import type { AiService } from '../ai/ai.service.js';
import {
  CommitMessageService,
  parseMessage,
} from './commit-message.service.js';

describe('CommitMessageService', () => {
  const complete = vi.fn();
  const service = new CommitMessageService({
    complete,
  } as unknown as AiService);

  beforeEach(() => vi.clearAllMocks());

  it('asks for JSON and returns the message', async () => {
    complete.mockResolvedValueOnce({
      content: '{"message": "sale_discount: handle empty discount"}',
      finishReason: 'stop',
    });
    await expect(service.generate('diff --git a/x b/x')).resolves.toBe(
      'sale_discount: handle empty discount',
    );
    expect(complete).toHaveBeenCalledWith(
      expect.stringContaining('<addon>: <summary>'),
      'diff --git a/x b/x',
      { json: true },
    );
  });

  it('truncates very large diffs', async () => {
    complete.mockResolvedValueOnce({
      content: '{"message": "x: bump"}',
      finishReason: 'stop',
    });
    await service.generate('x'.repeat(150_000));
    expect(complete.mock.calls[0][1]).toHaveLength(100_000);
  });

  it('throws with the raw answer when it is unusable', async () => {
    complete.mockResolvedValueOnce({ content: '', finishReason: 'length' });
    await expect(service.generate('diff')).rejects.toThrow(
      'AI returned no commit message (finish_reason=length): <empty>',
    );
    complete.mockResolvedValueOnce({ content: 'sorry', finishReason: 'stop' });
    await expect(service.generate('diff')).rejects.toThrow(': sorry');
  });

  it.each([
    ['{"message": "sale: add x"}', 'sale: add x'],
    [
      '<think>{"a":1}</think>\n```json\n{"message": " sale: add x. "}\n```',
      'sale: add x',
    ],
    ['{"message": "sale: add x\\n\\nlong body"}', 'sale: add x'],
    ['{"message": 42}', ''],
    ['{"msg": "sale: add x"}', ''],
    ['not json', ''],
  ])('parses %j', (input, expected) => {
    expect(parseMessage(input)).toBe(expected);
  });
});
