import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlannerFocusGroup, PlannerFocusItem, PlannerFocusReason, PlannerFocusResponse } from '../../../work/planner/models/planner.models';
import { PlannerDragService } from '../../state/planner-drag.service';
import { KIND_META, TASK_KINDS, TaskKind, kindOf } from '../../../work/utils/task-kind';
import { TaskKindIconComponent } from '../../../work/ui/task-kind-icon/task-kind-icon.component';
import { dateOnlyInTimezone } from '../../../../shared/utils/timezone.util';

const GROUP_TITLES: Record<PlannerFocusReason, string> = {
  overdue: 'Overdue', due_today: 'Due today', due_this_week: 'Due this week', backlog: 'Assigned backlog',
};
const REASONS: readonly PlannerFocusReason[] = ['overdue', 'due_today', 'due_this_week', 'backlog'];
/** The section dot: red overdue, orange due today, grey otherwise. */
const REASON_DOTS: Record<PlannerFocusReason, string> = {
  overdue: 'bg-[var(--color-danger)]', due_today: 'bg-orange-500',
  due_this_week: 'bg-[var(--color-text-secondary)]', backlog: 'bg-[var(--color-text-secondary)]',
};
/** Cards per section before "See all". */
const SECTION_SIZE = 3;
const GROUP_BY_KEY = 'planner.queueGroupBy';
type GroupBy = 'due' | 'kind';

function readGroupBy(): GroupBy {
  try {
    return localStorage.getItem(GROUP_BY_KEY) === 'kind' ? 'kind' : 'due';
  } catch {
    return 'due';
  }
}

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
  imports: [CommonModule, TaskKindIconComponent],
  templateUrl: './planner-focus-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlannerFocusPanelComponent {
  focus = input<PlannerFocusResponse | null>(null);
  closable = input(true);
  /** The planner's time zone, for the date a task was created on ("Open N days"); the browser's when null. */
  timezone = input<string | null>(null);

  closed = output<void>();
  /** Narrow screens: plan this task with the picker. */
  pick = output<PlannerFocusItem>();
  /** Open the task itself. */
  open = output<PlannerFocusItem>();

  private readonly drag = inject(PlannerDragService);
  /** Sections opened with "See all", by section key (a reason or a kind). */
  private readonly expanded = signal<ReadonlySet<string>>(new Set());
  /** The card being dragged, drawn dimmed and dashed in the list. */
  readonly draggingId = signal<string | null>(null);
  readonly ghost = signal<{ title: string; length: string | null; x: number; y: number } | null>(null);
  private justDragged = false;

  /** Sections by due date (Overdue, Due today, ...) or by type; remembered per browser. */
  readonly groupBy = signal<GroupBy>(readGroupBy());
  readonly query = signal('');
  /** Selected type chips; none selected is "All". */
  readonly kinds = signal<ReadonlySet<TaskKind>>(new Set());

  readonly total = computed(() => (this.focus()?.groups ?? []).reduce((sum, g) => sum + g.count, 0));
  private readonly allItems = computed(() => (this.focus()?.groups ?? []).flatMap((g) => g.items));
  /** The type chips: each kind present in the queue, with its count. */
  readonly presentKinds = computed(() => TASK_KINDS
    .map((kind) => ({ kind, label: KIND_META[kind].label, count: this.allItems().filter((i) => kindOf(i.categoryKind) === kind).length }))
    .filter((k) => k.count > 0));
  /** The type chips and the search, together. */
  private readonly visibleItems = computed(() => {
    const q = this.query().trim().toLowerCase();
    const selected = this.kinds();
    return this.allItems().filter((i) => (selected.size === 0 || selected.has(kindOf(i.categoryKind)))
      && (!q || i.title.toLowerCase().includes(q) || i.projectName.toLowerCase().includes(q)));
  });
  readonly sections = computed(() => {
    const items = this.visibleItems();
    // Unfiltered, a due-date section counts every task in its group; the server sends at most 50 of them.
    const unfiltered = this.query().trim() === '' && this.kinds().size === 0;
    const serverCount = (r: PlannerFocusReason) => (this.focus()?.groups ?? []).find((g) => g.reason === r)?.count;
    const raw = this.groupBy() === 'due'
      ? REASONS.map((r) => ({ key: r as string, testid: `queue-section-${r}`, title: GROUP_TITLES[r], dot: REASON_DOTS[r],
          items: items.filter((i) => i.reason === r), count: unfiltered ? serverCount(r) : undefined }))
      : TASK_KINDS.map((k) => ({ key: `kind-${k}`, testid: `queue-section-kind-${k}`, title: KIND_META[k].label, dot: KIND_META[k].bar,
          items: items.filter((i) => kindOf(i.categoryKind) === k), count: undefined as number | undefined }));
    return raw.filter((section) => section.items.length > 0).map((section) => {
      const all = this.expanded().has(section.key);
      return {
        key: section.key, testid: section.testid, title: section.title, dot: section.dot, count: section.count ?? section.items.length,
        more: all ? 0 : Math.max(0, section.items.length - SECTION_SIZE),
        cards: (all ? section.items : section.items.slice(0, SECTION_SIZE)).map((item) => this.card(item)),
      };
    });
  });
  readonly noMatch = computed(() => this.allItems().length > 0 && this.visibleItems().length === 0);
  readonly empty = computed(() => (this.focus()?.groups ?? []).every((g: PlannerFocusGroup) => g.count === 0));

  expand(key: string): void {
    this.expanded.update((set) => new Set([...set, key]));
  }

  setGroupBy(value: GroupBy): void {
    this.groupBy.set(value);
    try {
      localStorage.setItem(GROUP_BY_KEY, value);
    } catch {
      // Storage can be unavailable (private mode); the choice then lasts for this page only.
    }
  }

  toggleKind(kind: TaskKind): void {
    this.kinds.update((set) => {
      const next = new Set(set);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }

  clearKinds(): void {
    this.kinds.set(new Set());
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

  /** A card's look and its meta line, which fits its group (redesign D20). */
  private card(item: PlannerFocusItem) {
    const left = item.remainingMinutes === null ? null : duration(item.remainingMinutes);
    let detail: string;
    let age: string | null = null;
    switch (item.reason) {
      case 'overdue':
        age = item.createdAt ? this.openFor(item.createdAt) : null;
        detail = age ? '' : this.dueLabel(item.dueDate);
        break;
      case 'due_today':
        detail = left ? `${left} left` : 'Today';
        break;
      case 'due_this_week':
        detail = [item.dueDate ? localDate(item.dueDate).toLocaleDateString('en-US', { weekday: 'short' }) : null, left]
          .filter((part) => !!part).join(' · ');
        break;
      default:
        detail = [this.dueLabel(item.dueDate), left].filter((part) => !!part).join(' · ');
    }
    const planned = item.firstPlannedDate
      ? `Planned ${localDate(item.firstPlannedDate).toLocaleDateString('en-US', { weekday: 'short' })}`
        + (item.plannedDayCount > 1 ? ` +${item.plannedDayCount - 1}` : '')
      : null;
    return { item, kind: kindOf(item.categoryKind), detail, age, planned };
  }

  private dueLabel(dueDate: string | null): string {
    return dueDate ? `Due ${localDate(dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : 'No due date';
  }

  /** "Open N days": whole days from the task's creation to today (the queue's own today). */
  private openFor(createdAt: string): string {
    const tz = this.timezone();
    const created = new Date(createdAt);
    const from = tz ? localDate(dateOnlyInTimezone(createdAt, tz)) : new Date(created.getFullYear(), created.getMonth(), created.getDate());
    const todayIso = this.focus()?.today;
    const today = todayIso ? localDate(todayIso) : new Date();
    const days = Math.max(0, Math.round((today.getTime() - from.getTime()) / 86_400_000));
    return days === 0 ? 'Open today' : `Open ${days} ${days === 1 ? 'day' : 'days'}`;
  }
}
