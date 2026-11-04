import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { PlannerFocusItem, PlannerFocusResponse } from '../../../work/planner/models/planner.models';
import { PlannerDragService } from '../../state/planner-drag.service';
import { PlannerFocusPanelComponent } from './planner-focus-panel.component';

function item(title: string, extra: Partial<PlannerFocusItem> = {}): PlannerFocusItem {
  return {
    taskId: `t-${title}`, projectId: 'p1', projectName: 'Portal', title, priority: 'medium', dueDate: '2026-10-31',
    estimatedMinutes: 300, loggedMinutes: 90, remainingMinutes: 210, plannedAheadMinutes: 0, firstPlannedDate: null,
    plannedDayCount: 0, fullyPlanned: false, reason: 'overdue', ...extra,
  };
}

const focus: PlannerFocusResponse = {
  today: '2026-11-02', weekEnd: '2026-11-08',
  groups: [
    { reason: 'overdue', count: 1, items: [item('Payroll export fix', { priority: 'high', categoryName: 'bug', categoryKind: 'bug',
      createdAt: '2026-10-27T09:00:00Z' })] },
    { reason: 'due_today', count: 1, items: [item('Release notes', { reason: 'due_today', dueDate: '2026-11-02', remainingMinutes: 60,
      plannedAheadMinutes: 60, firstPlannedDate: '2026-11-04', plannedDayCount: 2, fullyPlanned: true, categoryKind: 'task' })] },
    { reason: 'due_this_week', count: 1, items: [item('Test cases', { reason: 'due_this_week', dueDate: '2026-11-06', remainingMinutes: 120,
      projectName: 'Release 1.2', categoryKind: 'testing' })] },
    { reason: 'backlog', count: 7, items: Array.from({ length: 7 }, (_, i) =>
      item(`Backlog ${i}`, { reason: 'backlog', dueDate: null, estimatedMinutes: null, remainingMinutes: null,
        categoryKind: i === 0 ? 'story' : undefined })) },
  ],
};

describe('PlannerFocusPanelComponent', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<PlannerFocusPanelComponent>>;
  let drag: PlannerDragService;
  const text = (sel: string): string[] => Array.from(fixture.nativeElement.querySelectorAll(sel)).map((e) => (e as HTMLElement).textContent!.replace(/\s+/g, ' ').trim());
  const cards = (): HTMLElement[] => Array.from(fixture.nativeElement.querySelectorAll('[data-testid="planner-focus-card"]'));
  // jsdom has no matchMedia.
  const narrow = (matches: boolean) => Object.defineProperty(window, 'matchMedia',
    { value: vi.fn(() => ({ matches }) as MediaQueryList), configurable: true, writable: true });

  beforeEach(async () => {
    localStorage.removeItem('planner.queueGroupBy');
    await TestBed.configureTestingModule({ imports: [PlannerFocusPanelComponent] }).compileComponents();
    drag = TestBed.inject(PlannerDragService);
    drag.end();
    fixture = TestBed.createComponent(PlannerFocusPanelComponent);
    fixture.componentRef.setInput('focus', focus);
    fixture.detectChanges();
  });
  afterEach(() => { vi.restoreAllMocks(); localStorage.removeItem('planner.queueGroupBy'); });

  const q = (sel: string): HTMLElement | null => fixture.nativeElement.querySelector(sel);
  const titles = (): string[] => text('[data-testid="planner-focus-title"]');
  const click = (sel: string) => { q(sel)!.click(); fixture.detectChanges(); };
  const search = (value: string) => {
    const input = q('[data-testid="queue-search"]') as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  it('is headed "Task queue" with the total count', () => {
    expect(q('[data-testid="queue-title"]')!.textContent!.trim()).toBe('Task queue');
    expect(q('[data-testid="queue-total"]')!.textContent!.trim()).toBe('10');
  });

  it('by due date: one section per non-empty group, three cards each, and See all shows the rest', () => {
    expect(text('[data-testid="queue-section-title"]')).toEqual(['Overdue 1', 'Due today 1', 'Due this week 1', 'Assigned backlog 7']);
    const backlog = q('[data-testid="queue-section-backlog"]')!;
    expect(backlog.querySelectorAll('[data-testid="planner-focus-card"]').length).toBe(3);

    click('[data-testid="queue-see-all-backlog"]');

    expect(q('[data-testid="queue-section-backlog"]')!.querySelectorAll('[data-testid="planner-focus-card"]').length).toBe(7);
  });

  it('by type: one section per kind present, in kind order, with no empty kinds, and the choice is remembered', () => {
    click('[data-testid="queue-group-by-kind"]');

    expect(text('[data-testid="queue-section-title"]')).toEqual(['Task 7', 'Bug 1', 'Story 1', 'Testing 1']);
    expect(q('[data-testid="queue-section-kind-feature"]')).toBeNull();
    expect(localStorage.getItem('planner.queueGroupBy')).toBe('kind');
    click('[data-testid="queue-group-by-due"]');
    expect(localStorage.getItem('planner.queueGroupBy')).toBe('due');
  });

  it('type chips list the kinds present with counts, select several, and All clears them', () => {
    expect(text('[data-testid^="queue-kind-chip-"]')).toEqual(['All 10', 'Task 7', 'Bug 1', 'Story 1', 'Testing 1']);

    click('[data-testid="queue-kind-chip-bug"]');
    click('[data-testid="queue-kind-chip-testing"]');
    expect(titles()).toEqual(['Payroll export fix', 'Test cases']);

    click('[data-testid="queue-kind-chip-all"]');
    expect(titles().length).toBe(1 + 1 + 1 + 3);
  });

  it('a chip and a search apply together, and clearing the search keeps the chip', () => {
    click('[data-testid="queue-kind-chip-task"]');
    search('release');
    expect(titles()).toEqual(['Release notes']);

    search('');
    expect(titles()).toEqual(['Release notes', 'Backlog 1', 'Backlog 2', 'Backlog 3']);
  });

  it('search matches the title or the project, and says so when nothing matches', () => {
    search('release 1.2');
    expect(titles()).toEqual(['Test cases']);

    search('zzz');
    expect(titles()).toEqual([]);
    expect(q('[data-testid="queue-no-match"]')!.textContent!.trim()).toBe('No tasks match');
  });

  it('a card shows its kind tile, title, and project with a meta line that fits its group', () => {
    const meta = text('[data-testid="planner-focus-meta"]');
    expect(meta[0]).toBe('Portal · Open 6 days');
    expect(q('[data-testid="planner-focus-meta"] [data-testid="meta-age"]')!.className).toContain('text-[var(--color-danger)]');
    expect(meta[1]).toBe('Portal · 1h left · Planned Wed +1');
    expect(meta[2]).toBe('Release 1.2 · Fri · 2h');
    expect(meta[3]).toBe('Portal · No due date');
    const first = cards()[0];
    expect(first.querySelector('[data-testid="task-kind-icon"]')!.getAttribute('data-kind')).toBe('bug');
    expect(first.querySelector('[data-testid="planner-priority-dot"]')).toBeNull();
    expect(cards()[1].getAttribute('data-fully-planned')).toBe('true');
  });

  it('by due date with no filter, a section shows its full server count, past the 50 cards loaded', () => {
    fixture.componentRef.setInput('focus', { ...focus, groups: [
      { reason: 'overdue', count: 73, items: [item('A'), item('B')] },
      { reason: 'due_today', count: 0, items: [] }, { reason: 'due_this_week', count: 0, items: [] }, { reason: 'backlog', count: 0, items: [] },
    ] });
    fixture.detectChanges();

    expect(text('[data-testid="queue-section-title"]')).toEqual(['Overdue 73']);
    search('B');
    expect(text('[data-testid="queue-section-title"]')).toEqual(['Overdue 1']);
  });

  it('"Open N days" counts from the creation date in the planner time zone, not the browser\'s', () => {
    fixture.componentRef.setInput('timezone', 'Asia/Colombo');
    // 20:00 UTC on 1 Nov is already 01:30 on 2 Nov in Colombo: created today there.
    fixture.componentRef.setInput('focus', { ...focus, groups: [
      { reason: 'overdue', count: 1, items: [item('Late', { createdAt: '2026-11-01T20:00:00Z' })] },
      { reason: 'due_today', count: 0, items: [] }, { reason: 'due_this_week', count: 0, items: [] }, { reason: 'backlog', count: 0, items: [] },
    ] });
    fixture.detectChanges();

    expect(text('[data-testid="planner-focus-meta"]')).toEqual(['Portal · Open today']);
  });

  it('the Plan button is always visible', () => {
    expect(cards()[0].querySelector('[data-testid="planner-focus-plan"]')!.className).not.toContain('opacity-0');
  });

  const pointer = (type: string, x: number, y: number) =>
    Object.assign(new Event(type, { bubbles: true }), { button: 0, clientX: x, clientY: y });

  it('starts a drag once a pressed card moves, shows a ghost under the pointer, and ends it on release', () => {
    narrow(false);

    cards()[0].dispatchEvent(pointer('pointerdown', 100, 100));
    expect(drag.dragging()).toBeNull();
    document.dispatchEvent(pointer('pointermove', 102, 101));
    expect(drag.dragging()).toBeNull();

    document.dispatchEvent(pointer('pointermove', 140, 160));
    fixture.detectChanges();
    expect(drag.dragging()?.taskId).toBe('t-Payroll export fix');
    expect(cards()[0].getAttribute('data-dragging')).toBe('true');
    const ghost = fixture.nativeElement.querySelector('[data-testid="planner-focus-ghost"]') as HTMLElement;
    expect(ghost.textContent).toContain('Payroll export fix');
    expect(ghost.textContent).toContain('3h 30m');
    expect(ghost.style.left).toBe('154px');

    document.dispatchEvent(pointer('pointerup', 140, 160));
    fixture.detectChanges();
    expect(drag.dragging()).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="planner-focus-ghost"]')).toBeNull();
    expect(cards()[0].getAttribute('data-dragging')).toBeNull();
  });

  it('a click anywhere on a card opens the task on a wide screen, without starting a drag', () => {
    narrow(false);
    const opened = vi.fn();
    fixture.componentInstance.open.subscribe(opened);

    cards()[1].dispatchEvent(pointer('pointerdown', 10, 10));
    document.dispatchEvent(pointer('pointerup', 10, 10));
    cards()[1].click();

    expect(drag.dragging()).toBeNull();
    expect(opened).toHaveBeenCalledWith(expect.objectContaining({ taskId: 't-Release notes' }));
  });

  it('the release after a drag does not also open the task', () => {
    narrow(false);
    const opened = vi.fn();
    fixture.componentInstance.open.subscribe(opened);

    cards()[0].dispatchEvent(pointer('pointerdown', 0, 0));
    document.dispatchEvent(pointer('pointermove', 50, 50));
    document.dispatchEvent(pointer('pointerup', 50, 50));
    cards()[0].click();

    expect(opened).not.toHaveBeenCalled();
  });

  it('the Plan button asks for a day and time, and neither opens the task nor drags', () => {
    narrow(false);
    const picked = vi.fn();
    const opened = vi.fn();
    fixture.componentInstance.pick.subscribe(picked);
    fixture.componentInstance.open.subscribe(opened);
    const plan = cards()[0].querySelector('[data-testid="planner-focus-plan"]') as HTMLButtonElement;

    plan.dispatchEvent(pointer('pointerdown', 0, 0));
    document.dispatchEvent(pointer('pointermove', 50, 50));
    plan.click();

    expect(drag.dragging()).toBeNull();
    expect(picked).toHaveBeenCalledWith(expect.objectContaining({ taskId: 't-Payroll export fix' }));
    expect(opened).not.toHaveBeenCalled();
    document.dispatchEvent(pointer('pointerup', 50, 50));
  });

  it('Enter on a focused card opens the task', () => {
    narrow(false);
    const opened = vi.fn();
    fixture.componentInstance.open.subscribe(opened);

    cards()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(opened).toHaveBeenCalledWith(expect.objectContaining({ taskId: 't-Payroll export fix' }));
  });

  it('on a narrow screen a tap asks to pick a time instead', () => {
    narrow(true);
    const picked = vi.fn();
    fixture.componentInstance.pick.subscribe(picked);

    cards()[0].dispatchEvent(Object.assign(new Event('pointerdown', { bubbles: true }), { button: 0 }));
    cards()[0].click();

    expect(drag.dragging()).toBeNull();
    expect(picked).toHaveBeenCalledWith(expect.objectContaining({ taskId: 't-Payroll export fix' }));
  });

  it('closes when closable', () => {
    const closed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);

    (fixture.nativeElement.querySelector('[data-testid="planner-focus-close"]') as HTMLButtonElement).click();

    expect(closed).toHaveBeenCalled();
  });
});
