import { parsePatch } from './diff.utils.js';

describe('diff utils', () => {
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

  it('maps diff lines to new-file line numbers', () => {
    const { lines, annotated } = parsePatch(patch);
    expect([...lines.keys()]).toEqual([1, 2, 3, 4, 21, 22]);
    expect(lines.get(3)).toBe('const c = 4;');
    expect(lines.get(1)).toBe('const a = 1;');
    expect(annotated).toContain('   3 +const c = 4;');
    expect(annotated).toContain('     -const b = 2;');
  });
});
