import { parsePatch } from '../diff/diff.utils.js';
import { commentBody, validateFindings } from './review.utils.js';

describe('review utils', () => {
  const patch = [
    '@@ -1,3 +1,4 @@',
    ' const a = 1;',
    '-const b = 2;',
    '+const b = 3;',
    '+const c = 4;',
    ' export { a };',
    '\\ No newline at end of file',
    '@@ -20,2 +21,2 @@ function x() {',
    ' keep();',
    '+added();',
  ].join('\n');

  it('keeps only findings on diff lines, once', () => {
    const files = [{ path: 'a.ts', ...parsePatch(patch) }];
    const result = validateFindings(
      [
        { path: 'a.ts', line: 3, body: 'bug' },
        { path: 'a.ts', line: 3, body: 'bug ' },
        { path: 'a.ts', line: 10, body: 'outside hunk' },
        { path: 'b.ts', line: 1, body: 'unknown file' },
        { path: 'a.ts', line: 22, body: 'other' },
      ],
      files,
    );
    expect(result.map((f) => f.line)).toEqual([3, 22]);
  });

  it('keeps ranges inside one hunk, downgrades others without suggestion', () => {
    const files = [{ path: 'a.ts', ...parsePatch(patch) }];
    const result = validateFindings(
      [
        { path: 'a.ts', startLine: 2, line: 4, body: 'range', suggestion: 'x' },
        {
          path: 'a.ts',
          startLine: 3,
          line: 21,
          body: 'cross hunk',
          suggestion: 'y',
        },
        {
          path: 'a.ts',
          startLine: 22,
          line: 22,
          body: 'same line',
          suggestion: 'z',
        },
      ],
      files,
    );
    expect(result).toEqual([
      { path: 'a.ts', startLine: 2, line: 4, body: 'range', suggestion: 'x' },
      {
        path: 'a.ts',
        startLine: undefined,
        line: 21,
        body: 'cross hunk',
        suggestion: undefined,
      },
      {
        path: 'a.ts',
        startLine: undefined,
        line: 22,
        body: 'same line',
        suggestion: 'z',
      },
    ]);
  });

  it('renders suggestion blocks with a fence longer than the code', () => {
    expect(
      commentBody({ path: 'a', line: 1, body: 'why', suggestion: 'b();\n' }),
    ).toBe('why\n\n```suggestion\nb();\n```');
    expect(
      commentBody({ path: 'a', line: 1, body: 'w', suggestion: '```md```' }),
    ).toBe('w\n\n````suggestion\n```md```\n````');
  });
});
