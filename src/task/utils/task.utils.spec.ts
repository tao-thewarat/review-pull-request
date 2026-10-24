import { findTaskKeys, htmlToText } from './task.utils.js';

describe('task utils', () => {
  it('finds every task key once, in order', () => {
    expect(
      findTaskKeys(
        'feature/IC20-9-cheque',
        '[ADD] [IC20-9,IC20-10] cheque',
        null,
        'fix: IC20-11 and IC20-10\n\nrefs ABC-1',
      ),
    ).toEqual(['IC20-9', 'IC20-10', 'IC20-11', 'ABC-1']);
    expect(
      findTaskKeys('feature/fix-odoo-conf', '[FIX] odoo conf', undefined),
    ).toEqual([]);
  });

  it('converts task HTML to text', () => {
    expect(
      htmlToText(
        '<div data-x="1">Migrate&nbsp;a &amp; b</div><div><br></div><div><img src="x"></div>',
      ),
    ).toBe('Migrate a & b');
  });
});
