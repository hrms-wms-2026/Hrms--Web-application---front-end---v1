import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlannerFocusGroup, PlannerFocusItem, PlannerFocusReason, PlannerFocusResponse } from '../../../work/planner/models/planner.models';
import { PlannerDragService } from '../../state/planner-drag.service';

const GROUP_TITLES: Record<PlannerFocusReason, string> = {
  overdue: 'Overdue', due_today: 'Due today', due_this_week: 'Due this week', backlog: 'Assigned backlog',
};
const CARDS_PER_GROUP = 5;
/** How far a press must move before it is a drag rather than a click. */
const DRAG_THRESHOLD_PX = 4;

function duration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function localDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * The Focus panel, shown to users as "Task queue" (2026-10-27 Planner = Calendar design, section 4.2): what to work on, in four groups. On a wide screen a
 * card is dragged onto the calendar grid and a click opens the task; on a narrow one a tap asks for a day and time
 * instead. Every card also has a Plan button, the keyboard's way to schedule.
 */
@Component({
  selector: 'app-planner-focus-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './planner-focus-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlannerFocusPanelComponent {
  focus = input<PlannerFocusResponse | null>(null);
  closable = input(true);

  closed = output<void>();
  /** Narrow screens: plan this task with the picker. */
  pick = output<PlannerFocusItem>();
  /** Open the task itself. */
  open = output<PlannerFocusItem>();

  private readonly drag = inject(PlannerDragService);
  private readonly expanded = signal<ReadonlySet<PlannerFocusReason>>(new Set());
  /** The card being dragged, drawn dimmed and dashed in the list. */
  readonly draggingId = signal<string | null>(null);
  readonly ghost = signal<{ title: string; length: string | null; x: number; y: number } | null>(null);
  private justDragged = false;

  readonly groups = computed(() => (this.focus()?.groups ?? []).map((group) => {
    const all = this.expanded().has(group.reason);
    const items = all ? group.items : group.items.slice(0, CARDS_PER_GROUP);
    return {
      reason: group.reason, title: `${GROUP_TITLES[group.reason]} · ${group.count}`,
      more: all ? 0 : group.count - items.length, items: items.map((item) => this.card(item)),
    };
  }));
  readonly empty = computed(() => (this.focus()?.groups ?? []).every((g: PlannerFocusGroup) => g.count === 0));

  expand(reason: PlannerFocusReason): void {
    this.expanded.update((set) => new Set([...set, reason]));
  }

  /**
   * A press becomes a drag only once the pointer moves past a few pixels, so a plain click still opens the task. While
   * it drags, a ghost card follows the pointer, the source card dims and the cursor grabs.
   */
  onCardPointerDown(item: PlannerFocusItem, event: PointerEvent): void {
    if (event.button !== 0 || this.narrow()) return;
    if ((event.target as HTMLElement | null)?.closest?.('[data-no-drag]')) return;
    const from = { x: event.clientX, y: event.clientY };
    let dragging = false;
    const move = (e: PointerEvent) => {
      if (!dragging) {
        if (Math.hypot(e.clientX - from.x, e.clientY - from.y) < DRAG_THRESHOLD_PX) return;
        dragging = true;
        this.drag.start(item);
        this.draggingId.set(item.taskId);
        document.body.style.cursor = 'grabbing';
      }
      this.ghost.set({ title: item.title, length: item.remainingMinutes ? duration(item.remainingMinutes) : null, x: e.clientX, y: e.clientY });
    };
    const up = () => {
      document.removeEventListener('pointermove', move);
      if (!dragging) return;
      // The release after a drag must not also count as a click on the card.
      this.justDragged = true;
      setTimeout(() => (this.justDragged = false));
      this.drag.end();
      this.draggingId.set(null);
      this.ghost.set(null);
      document.body.style.cursor = '';
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up, { once: true });
  }

  /** A click anywhere on the card opens the task; on a narrow screen, where there is no drag, it asks for a time. */
  onCardClick(item: PlannerFocusItem): void {
    if (this.justDragged) return;
    if (this.narrow()) this.pick.emit(item);
    else this.open.emit(item);
  }

  onPlanClick(item: PlannerFocusItem, event: Event): void {
    event.stopPropagation();
    this.pick.emit(item);
  }

  private narrow(): boolean {
    return typeof window !== 'undefined' && !!window.matchMedia?.('(max-width: 767px)').matches;
  }

  private card(item: PlannerFocusItem) {
    let due = 'No due date';
    if (item.reason === 'due_today') due = 'Today';
    else if (item.dueDate) due = `Due ${localDate(item.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
    const planned = item.firstPlannedDate
      ? `planned ${localDate(item.firstPlannedDate).toLocaleDateString('en-US', { weekday: 'short' })}`
        + (item.plannedDayCount > 1 ? ` +${item.plannedDayCount - 1}` : '')
      : null;
    return {
      item, due, planned,
      left: item.remainingMinutes === null ? null : `${duration(item.remainingMinutes)} left`,
      flagged: item.priority === 'high' || item.priority === 'critical',
    };
  }
}
