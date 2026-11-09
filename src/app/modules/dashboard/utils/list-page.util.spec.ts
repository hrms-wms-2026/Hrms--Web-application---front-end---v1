import { describe, expect, it } from 'vitest';
import { listPage } from './list-page.util';

describe('listPage', () => {
  const items = Array.from({ length: 23 }, (_, i) => i);

  it('slices the requested page and reports the total', () => {
    expect(listPage(items, 2, 10)).toEqual({ items: items.slice(10, 20), page: 2, totalPages: 3, offset: 10 });
    expect(listPage(items, 3, 10).items).toEqual([20, 21, 22]);
  });

  it('clamps a page past the end or below 1', () => {
    expect(listPage(items, 9, 10).page).toBe(3);
    expect(listPage(items, 0, 10).page).toBe(1);
  });

  it('an empty list is one empty page', () => {
    expect(listPage([], 1, 10)).toEqual({ items: [], page: 1, totalPages: 1, offset: 0 });
  });
});
