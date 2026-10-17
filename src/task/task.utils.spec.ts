import { findTaskKey, htmlToText } from './task.utils.js';

describe('task utils', () => {
  it('finds the task key in branch, title, or body', () => {
    expect(findTaskKey('feature/IC20-9-cheque', '[ADD] x', null)).toBe(
      'IC20-9',
    );
    expect(
      findTaskKey('feature/fix-odoo-conf', '[FIX] IC20-12 conf', 'see ABC-1'),
    ).toBe('IC20-12');
    expect(
      findTaskKey('feature/fix-odoo-conf', '[FIX] odoo conf', null),
    ).toBeNull();
  });

  it('converts task HTML to text', () => {
    expect(
      htmlToText(
        '<div data-x="1">Migrate&nbsp;a &amp; b</div><div><br></div><div><img src="x"></div>',
      ),
    ).toBe('Migrate a & b');
  });
});
