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
    { reason: 'overdue', count: 1, items: [item('Payroll export fix', { priority: 'high' })] },
    { reason: 'due_today', count: 1, items: [item('Release notes', { reason: 'due_today', dueDate: '2026-11-02', remainingMinutes: 60,
      plannedAheadMinutes: 60, firstPlannedDate: '2026-11-04', plannedDayCount: 2, fullyPlanned: true })] },
    { reason: 'due_this_week', count: 0, items: [] },
    { reason: 'backlog', count: 7, items: Array.from({ length: 7 }, (_, i) =>
      item(`Backlog ${i}`, { reason: 'backlog', dueDate: null, estimatedMinutes: null, remainingMinutes: null })) },
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
    await TestBed.configureTestingModule({ imports: [PlannerFocusPanelComponent] }).compileComponents();
    drag = TestBed.inject(PlannerDragService);
    drag.end();
    fixture = TestBed.createComponent(PlannerFocusPanelComponent);
    fixture.componentRef.setInput('focus', focus);
    fixture.detectChanges();
  });
  afterEach(() => vi.restoreAllMocks());

  it('shows the four groups in order with their counts', () => {
    expect(text('[data-testid="planner-focus-group-title"]'))
      .toEqual(['Overdue · 1', 'Due today · 1', 'Due this week · 0', 'Assigned backlog · 7']);
  });

  it('shows five cards a group, then expands on "+ N more"', () => {
    expect(cards().length).toBe(1 + 1 + 5);
    const more = fixture.nativeElement.querySelector('[data-testid="planner-focus-more"]') as HTMLButtonElement;
    expect(more.textContent!.trim()).toBe('+ 2 more');

    more.click();
    fixture.detectChanges();

    expect(cards().length).toBe(1 + 1 + 7);
  });

  it('a card shows the title, project, priority, due date, what is left and when it is planned', () => {
    const [overdue, today, backlog] = [cards()[0], cards()[1], cards()[2]];

    expect(overdue.textContent).toContain('Payroll export fix');
    expect(overdue.textContent).toContain('Portal');
    expect(overdue.querySelector('[data-testid="planner-priority-dot"]')).not.toBeNull();
    expect(overdue.textContent).toContain('Due 31 Oct');
    expect(overdue.textContent).toContain('3h 30m left');
    expect(today.textContent).toContain('Today');
    expect(today.textContent).toContain('planned Wed +1');
    expect(today.getAttribute('data-fully-planned')).toBe('true');
    expect(backlog.textContent).toContain('No due date');
    expect(backlog.textContent).not.toContain('left');
    expect(backlog.querySelector('[data-testid="planner-priority-dot"]')).toBeNull();
  });

  it('starts a drag from a card on a wide screen and ends it on release', () => {
    narrow(false);

    cards()[0].dispatchEvent(Object.assign(new Event('pointerdown', { bubbles: true }), { button: 0 }));
    expect(drag.dragging()?.taskId).toBe('t-Payroll export fix');
    document.dispatchEvent(new Event('pointerup'));
    expect(drag.dragging()).toBeNull();
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
