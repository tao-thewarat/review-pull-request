import { parseAiReview } from './ai.utils.js';

describe('ai utils', () => {
  it('parses JSON wrapped in think tags and fences', () => {
    const review = parseAiReview(
      '<think>{"x":1}</think>\n```json\n{"summary":"ok","findings":[{"path":"a.ts","line":2,"body":"b"},{"path":"a.ts","line":"2"}]}\n```',
    );
    expect(review).toEqual({
      summary: 'ok',
      findings: [{ path: 'a.ts', line: 2, body: 'b' }],
    });
  });

  it('maps start_line and suggestion from model JSON', () => {
    const review = parseAiReview(
      '{"summary":"s","findings":[{"path":"a","start_line":30,"line":35,"body":"b","suggestion":"c"}]}',
    );
    expect(review.findings).toEqual([
      { path: 'a', startLine: 30, line: 35, body: 'b', suggestion: 'c' },
    ]);
  });

  it('tolerates missing summary and findings', () => {
    expect(parseAiReview('{"summary": 1, "findings": "none"}')).toEqual({
      summary: '',
      findings: [],
    });
  });
});
