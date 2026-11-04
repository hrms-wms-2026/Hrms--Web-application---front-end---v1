import { KIND_META, TASK_KINDS, USER_SELECTABLE_KINDS, kindOf } from './task-kind';

describe('task kinds', () => {
  it('reads a known kind and falls back to task for anything else', () => {
    expect(kindOf('bug')).toBe('bug');
    expect(kindOf('testing')).toBe('testing');
    expect(kindOf('epic')).toBe('task');
    expect(kindOf('')).toBe('task');
    expect(kindOf(null)).toBe('task');
    expect(kindOf(undefined)).toBe('task');
  });

  it('lists the seven kinds in display order, five of them for users to pick', () => {
    expect(TASK_KINDS).toEqual(['task', 'bug', 'story', 'feature', 'testing', 'meeting', 'checklist']);
    expect(USER_SELECTABLE_KINDS).toEqual(['task', 'bug', 'story', 'feature', 'testing']);
  });

  it('gives every kind a label, an icon and its colours', () => {
    for (const kind of TASK_KINDS) {
      const meta = KIND_META[kind];
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.icon.length).toBeGreaterThan(0);
      expect(meta.color).toMatch(/^text-/);
      expect(meta.tint).toMatch(/^bg-/);
      expect(meta.bar).toMatch(/^bg-/);
    }
    expect(KIND_META.bug.label).toBe('Bug');
    expect(KIND_META.feature.color).toBe('text-pink-600');
  });
});
