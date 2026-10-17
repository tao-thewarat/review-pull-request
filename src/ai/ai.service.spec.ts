import type { ConfigService } from '@nestjs/config';
import { AiService } from './ai.service.js';

describe('AiService', () => {
  const env: Record<string, string> = {
    AI_BASE_URL: 'http://ai.local/v1',
    AI_API_KEY: 'secret',
    AI_MODEL: 'model-x',
  };
  const service = new AiService({
    getOrThrow: (name: string) => env[name],
  } as unknown as ConfigService);
  const fetchMock = vi.fn();
  const files = [
    { path: 'a.ts', annotated: '   1 +x();', lines: new Set([1]) },
    { path: 'logo.png', annotated: null, lines: new Set<number>() },
  ];
  const reply = (content: unknown, finish = 'stop') =>
    new Response(
      JSON.stringify({
        choices: [{ finish_reason: finish, message: { content } }],
      }),
    );
  const sentBody = () => JSON.parse(fetchMock.mock.calls[0][1].body);

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('sends the diff and parses the review', async () => {
    fetchMock.mockResolvedValueOnce(
      reply(
        '{"summary":"ok","findings":[{"path":"a.ts","line":1,"body":"b"}]}',
      ),
    );

    await expect(service.review(files, null)).resolves.toEqual({
      summary: 'ok',
      findings: [
        {
          path: 'a.ts',
          line: 1,
          body: 'b',
          startLine: undefined,
          suggestion: undefined,
        },
      ],
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://ai.local/v1/chat/completions');
    expect(init.headers.Authorization).toBe('Bearer secret');
    const body = sentBody();
    expect(body).toMatchObject({
      model: 'model-x',
      max_tokens: 16_384,
      response_format: { type: 'json_object' },
    });
    expect(body.messages[1].content).toBe('### a.ts\n   1 +x();');
  });

  it('puts the task ahead of the diff', async () => {
    fetchMock.mockResolvedValueOnce(reply('{"summary":"ok","findings":[]}'));
    await service.review(files, {
      key: 'IC20-9',
      title: 'Migrate',
      description: 'Do it',
    });
    expect(sentBody().messages[1].content).toBe(
      '## Task IC20-9: Migrate\nDo it\n\n## Diff\n### a.ts\n   1 +x();',
    );
  });

  it('throws on a gateway error so the job retries', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('overloaded', { status: 503 }),
    );
    await expect(service.review(files, null)).rejects.toThrow(
      'AI gateway 503: overloaded',
    );
  });

  it('reports finish_reason and content when the JSON is invalid', async () => {
    fetchMock.mockResolvedValueOnce(reply('{"summary": "cut', 'length'));
    await expect(service.review(files, null)).rejects.toThrow(
      'AI returned no valid JSON (finish_reason=length): {"summary": "cut',
    );
  });

  it('reports an empty answer', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}'));
    await expect(service.review(files, null)).rejects.toThrow(
      'AI returned no valid JSON (finish_reason=undefined): <empty>',
    );
  });
});
