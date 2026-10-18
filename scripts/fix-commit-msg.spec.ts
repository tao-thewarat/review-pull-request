import { fixCommitMessage } from './fix-commit-msg.js';

describe('fixCommitMessage', () => {
  it.each([
    ['[ADD] cheque addon', 'feat: cheque addon'],
    ['[FIX] odoo conf.', 'fix: odoo conf'],
    ['[imp] faster diff', 'feat: faster diff'],
    ['feat(review): already fine', 'feat(review): already fine'],
    ['[WIP] unknown tag', '[WIP] unknown tag'],
    [
      'feat(review): add AI review via 9arm',
      'feat(review): Add AI review via 9arm',
    ],
    ['fix: lower case only', 'fix: lower case only'],
  ])('rewrites %s', (input, expected) => {
    expect(fixCommitMessage(`${input}\n`)).toBe(`${expected}\n`);
  });

  it('cuts a long header at a word and keeps the full text in the body', () => {
    const input =
      '[ADD] add ai review pull request on open pull request or push with ai model qwen3.8-27b 9arm ai passport\n';
    const [header, blank, full] = fixCommitMessage(input).split('\n');
    expect(header).toBe(
      'feat: add ai review pull request on open pull request or push with ai',
    );
    expect(header.length).toBeLessThanOrEqual(72);
    expect(blank).toBe('');
    expect(full).toBe(
      'feat: add ai review pull request on open pull request or push with ai model qwen3.8-27b 9arm ai passport',
    );
  });

  it('cuts a long header without spaces at 72 characters', () => {
    const header = fixCommitMessage(`fix: ${'x'.repeat(100)}`).split('\n')[0];
    expect(header).toHaveLength(72);
  });

  it('keeps the existing body and comment lines', () => {
    expect(fixCommitMessage('# note\n[FIX] bug\n\nDetails here\n')).toBe(
      '# note\nfix: bug\n\nDetails here\n',
    );
    const long = `[ADD] ${'word '.repeat(20)}\n\nBody\n`;
    expect(fixCommitMessage(long).endsWith('\n\nBody\n')).toBe(true);
  });

  it.each([
    'Merge branch main',
    'Revert "feat: x"',
    'fixup! feat: x',
    '# only comments\n',
  ])('leaves %s untouched', (input) => {
    expect(fixCommitMessage(input)).toBe(input);
  });

  it.each([
    [
      '[IC20-9,IC20-10][FIX] addons: summary commit message',
      'fix(addons): summary commit message\n\nRefs: IC20-9, IC20-10\n',
    ],
    ['[IC20-9] [ADD] cheque', 'feat: cheque\n\nRefs: IC20-9\n'],
    ['[FIX][IC20-9, IC20-9] bug', 'fix: bug\n\nRefs: IC20-9\n'],
    ['[IC20-9] fix(addons): bug', 'fix(addons): bug\n\nRefs: IC20-9\n'],
    ['[IC20-9] plain words', '[IC20-9] plain words\n'],
    ['[IC20-9][WIP] x', '[IC20-9][WIP] x\n'],
  ])('moves task keys from %s to a footer', (input, expected) => {
    expect(fixCommitMessage(`${input}\n`)).toBe(expected);
  });

  it('puts the footer after the body and before git comments', () => {
    expect(
      fixCommitMessage(
        '[IC20-9][FIX] addons: bug\n\nWhy it broke\n\n# Please enter\n',
      ),
    ).toBe(
      'fix(addons): bug\n\nWhy it broke\n\nRefs: IC20-9\n\n# Please enter\n',
    );
  });
});
