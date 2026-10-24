import { parsePatch } from '../../diff/utils/diff.utils.js';
import {
  codeFingerprint,
  commentBody,
  validateFindings,
} from './review.utils.js';

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
    expect(result.map(({ fingerprint, ...f }) => f)).toEqual([
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

  it('fingerprints the commented code, ignoring line numbers and trailing spaces', () => {
    const before = new Map([
      [10, 'def _compute(self):'],
      [11, '    return 1'],
    ]);
    const after = new Map([
      [30, 'def _compute(self):  '],
      [31, '    return 1'],
    ]);
    expect(codeFingerprint('a.py', before, 10, 11)).toBe(
      codeFingerprint('a.py', after, 30, 31),
    );
    expect(codeFingerprint('a.py', before, 10, 11)).not.toBe(
      codeFingerprint('b.py', before, 10, 11),
    );
    expect(codeFingerprint('a.py', before, 10, 11)).not.toBe(
      codeFingerprint(
        'a.py',
        new Map([...before, [11, '    return 2']]),
        10,
        11,
      ),
    );
  });

  it('treats lines outside the map as empty', () => {
    expect(codeFingerprint('a.py', new Map([[1, 'x']]), 1, 2)).toBe(
      codeFingerprint(
        'a.py',
        new Map([
          [1, 'x'],
          [2, ''],
        ]),
        1,
        2,
      ),
    );
  });

  it('drops findings on code that was already commented', () => {
    const files = [{ path: 'a.ts', ...parsePatch(patch) }];
    const known = new Set([codeFingerprint('a.ts', files[0].lines, 2, 3)]);
    const result = validateFindings(
      [
        { path: 'a.ts', startLine: 2, line: 3, body: 'same issue again' },
        { path: 'a.ts', line: 4, body: 'new issue' },
      ],
      files,
      known,
    );
    expect(result).toEqual([
      {
        path: 'a.ts',
        line: 4,
        body: 'new issue',
        startLine: undefined,
        suggestion: undefined,
        fingerprint: codeFingerprint('a.ts', files[0].lines, 4, 4),
      },
    ]);
  });
});
