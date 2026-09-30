import { SelectionModel } from './selection-model';

describe('SelectionModel', () => {
  it('starts empty', () => {
    const model = new SelectionModel();
    expect(model.count()).toBe(0);
    expect(model.selected().size).toBe(0);
  });

  it('toggle flips membership when no explicit state is given', () => {
    const model = new SelectionModel();
    model.toggle('a');
    expect(model.isSelected('a')).toBe(true);
    model.toggle('a');
    expect(model.isSelected('a')).toBe(false);
  });

  it('toggle with an explicit state is idempotent', () => {
    const model = new SelectionModel();
    model.toggle('a', true);
    model.toggle('a', true);
    expect(model.count()).toBe(1);
    model.toggle('a', false);
    model.toggle('a', false);
    expect(model.count()).toBe(0);
  });

  it('accumulates ids from different pages', () => {
    const model = new SelectionModel();
    model.setMany(['p1-a', 'p1-b', 'p1-c'], true);
    model.setMany(['p2-a', 'p2-b'], true);
    expect(model.count()).toBe(5);
  });

  it('setMany(false) removes only the given ids', () => {
    const model = new SelectionModel();
    model.setMany(['a', 'b', 'c'], true);
    model.setMany(['a', 'b'], false);
    expect([...model.selected()]).toEqual(['c']);
  });

  it('clear empties the selection', () => {
    const model = new SelectionModel();
    model.setMany(['a', 'b'], true);
    model.clear();
    expect(model.count()).toBe(0);
  });

  it('allOf is false for an empty id list', () => {
    const model = new SelectionModel();
    model.toggle('a', true);
    expect(model.allOf([])).toBe(false);
  });

  it('allOf / someOf report full, partial and no selection of the visible ids', () => {
    const model = new SelectionModel();
    const visible = ['a', 'b', 'c'];
    expect(model.allOf(visible)).toBe(false);
    expect(model.someOf(visible)).toBe(false);

    model.toggle('a', true);
    expect(model.allOf(visible)).toBe(false);
    expect(model.someOf(visible)).toBe(true);

    model.setMany(visible, true);
    expect(model.allOf(visible)).toBe(true);
    expect(model.someOf(visible)).toBe(false);
  });

  it('selected ids outside the visible list do not affect allOf/someOf', () => {
    const model = new SelectionModel();
    model.toggle('other-page', true);
    expect(model.someOf(['a', 'b'])).toBe(false);
    expect(model.allOf(['a', 'b'])).toBe(false);
  });

  it('produces a new Set instance on every mutation', () => {
    const model = new SelectionModel();
    const s0 = model.selected();
    model.toggle('a');
    const s1 = model.selected();
    model.setMany(['b'], true);
    const s2 = model.selected();
    model.clear();
    const s3 = model.selected();
    expect(new Set([s0, s1, s2, s3]).size).toBe(4);
  });
});
