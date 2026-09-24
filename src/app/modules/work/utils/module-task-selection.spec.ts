import { moduleCheckState, setModuleBulk, toggleId, toggleModuleBulk, toggleModuleLive, PickerTask } from './module-task-selection';

const t = (id: string, objectiveId = 'o1', sprintId: string | null = null): PickerTask => ({ id, title: id, objectiveId, sprintId });
const all = () => true;

describe('module-task-selection', () => {
  it('live: ticking a module selects it and drops its individual task ticks', () => {
    const r = toggleModuleLive('o1', [t('a'), t('b')], new Set(['a', 'x']), new Set());
    expect([...r.objectiveIds]).toEqual(['o1']);
    expect([...r.taskIds]).toEqual(['x']);
  });

  it('live: unticking a module removes it', () => {
    const r = toggleModuleLive('o1', [], new Set(), new Set(['o1']));
    expect(r.objectiveIds.size).toBe(0);
  });

  it('bulk: selects every pickable task, then deselects on second toggle', () => {
    const tasks = [t('a'), t('b', 'o1', 'frozen')];
    const pickable = (x: PickerTask) => x.sprintId !== 'frozen';
    const first = toggleModuleBulk(tasks, new Set(), pickable);
    expect([...first]).toEqual(['a']);
    const second = toggleModuleBulk(tasks, first, pickable);
    expect(second.size).toBe(0);
  });

  it('bulk state: checked when all pickable selected, indeterminate when some', () => {
    const tasks = [t('a'), t('b')];
    expect(moduleCheckState('bulk', 'o1', tasks, new Set(['a', 'b']), new Set(), all)).toBe('checked');
    expect(moduleCheckState('bulk', 'o1', tasks, new Set(['a']), new Set(), all)).toBe('indeterminate');
    expect(moduleCheckState('bulk', 'o1', tasks, new Set(), new Set(), all)).toBe('unchecked');
  });

  it('live state: checked only via whole-module selection', () => {
    expect(moduleCheckState('live', 'o1', [t('a')], new Set(), new Set(['o1']), all)).toBe('checked');
    expect(moduleCheckState('live', 'o1', [t('a')], new Set(['a']), new Set(), all)).toBe('indeterminate');
  });

  it('setModuleBulk: select=true adds every pickable task without touching non-pickable ones', () => {
    const tasks = [t('a'), t('b', 'o1', 'frozen')];
    const pickable = (x: PickerTask) => x.sprintId !== 'frozen';
    const selected = setModuleBulk(tasks, new Set(), pickable, true);
    expect([...selected]).toEqual(['a']);
  });

  it('setModuleBulk: select=false removes every pickable task regardless of whether they were all selected', () => {
    const tasks = [t('a'), t('b', 'o1', 'frozen')];
    const pickable = (x: PickerTask) => x.sprintId !== 'frozen';
    // 'a' is the only already-selected task here, mirroring the bug scenario where the caller's
    // captured "shown" state says deselect even though not every pickable task was ticked yet.
    const deselected = setModuleBulk(tasks, new Set(['a']), pickable, false);
    expect(deselected.size).toBe(0);
  });

  it('setModuleBulk: select=true keeps already-selected pickable tasks selected (no accidental toggle-off)', () => {
    const tasks = [t('a'), t('b')];
    const pickable = () => true;
    const result = setModuleBulk(tasks, new Set(['a', 'b']), pickable, true);
    expect([...result].sort()).toEqual(['a', 'b']);
  });

  it('toggleId adds and removes', () => {
    expect([...toggleId(new Set(['a']), 'b')]).toEqual(['a', 'b']);
    expect([...toggleId(new Set(['a']), 'a')]).toEqual([]);
  });
});
