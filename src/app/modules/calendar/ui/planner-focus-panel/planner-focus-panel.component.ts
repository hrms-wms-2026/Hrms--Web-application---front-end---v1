import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlannerFocusGroup, PlannerFocusItem, PlannerFocusReason, PlannerFocusResponse } from '../../../work/planner/models/planner.models';
import { PlannerDragService } from '../../state/planner-drag.service';

const GROUP_TITLES: Record<PlannerFocusReason, string> = {
  overdue: 'Overdue', due_today: 'Due today', due_this_week: 'Due this week', backlog: 'Assigned backlog',
};
const CARDS_PER_GROUP = 5;

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
 * The Focus panel (2026-10-27 Planner = Calendar design, section 4.2): what to work on, in four groups. On a wide screen a
 * card is dragged onto the calendar grid; on a narrow one a tap asks for a day and time instead.
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

  onCardPointerDown(item: PlannerFocusItem, event: PointerEvent): void {
    if (event.button !== 0 || this.narrow()) return;
    this.drag.start(item);
    document.addEventListener('pointerup', () => this.drag.end(), { once: true });
  }

  onCardClick(item: PlannerFocusItem): void {
    if (this.narrow()) this.pick.emit(item);
  }

  onTitleClick(item: PlannerFocusItem, event: Event): void {
    if (this.narrow()) return;
    event.stopPropagation();
    this.open.emit(item);
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
