import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, input, model, output, signal, viewChild } from '@angular/core';
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
  overdue: 'bg-[var(--color-danger)]', due_today: 'bg-[var(--color-warning)]',
  due_this_week: 'bg-[var(--color-text-secondary)]', backlog: 'bg-[var(--color-text-secondary)]',
};
/** Cards per section before "See all". */
const SECTION_SIZE = 3;

/** How far a press must move before it is a drag rather than a click. */
const DRAG_THRESHOLD_PX = 4;
const TOOLTIP_GAP_PX = 6;
/** Room above a card for the tooltip's three lines. */
const TOOLTIP_ROOM_PX = 90;

function duration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** A queue card: its task, and what the hover tooltip says about it (redesign D20). */
interface QueueCard {
  readonly item: PlannerFocusItem;
  readonly kind: TaskKind;
  readonly age: string | null;
  /** The rest of the status line, after the age. */
  readonly rest: string;
}

function localDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * The Focus panel, shown to users as "Task list" (2026-10-27 Planner = Calendar design, section 4.2): what to work on, in four groups. On a wide screen a
 * card is dragged onto the calendar grid and a click opens the task; on a narrow one a tap asks for a day and time
 * instead. Every card also has a Plan button, the keyboard's way to schedule.
 */
@Component({
  selector: 'app-planner-focus-panel',
  standalone: true,
  imports: [CommonModule, TaskKindIconComponent],
  host: { class: 'block' },
  templateUrl: './planner-focus-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlannerFocusPanelComponent {
  focus = input<PlannerFocusResponse | null>(null);
  /** The planner's time zone, for the date a task was created on ("Open N days"); the browser's when null. */
  timezone = input<string | null>(null);

  /** Narrow screens: plan this task with the picker. */
  pick = output<PlannerFocusItem>();
  /** Open the task itself. */
  open = output<PlannerFocusItem>();

  private readonly drag = inject(PlannerDragService);
  /** Sections opened with "See all", by group. */
  private readonly expanded = signal<ReadonlySet<string>>(new Set());
  /** The card being dragged, drawn dimmed and dashed in the list. */
  readonly draggingId = signal<string | null>(null);
  readonly ghost = signal<{ title: string; length: string | null; x: number; y: number } | null>(null);
  private justDragged = false;
  /** The card's details, above it, or below when it is too near the top of the window. */
  readonly tooltip = signal<{ card: QueueCard; left: number; top: number; above: boolean } | null>(null);

  readonly query = signal('');
  /** The search opens from an icon (the page's, in the sub-sidebar header); closing it clears it. */
  readonly searchOpen = model(false);
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');
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
    // Unfiltered, a section counts every task in its group; the server sends at most 50 of them.
    const unfiltered = this.query().trim() === '' && this.kinds().size === 0;
    const serverCount = (r: PlannerFocusReason) => (this.focus()?.groups ?? []).find((g) => g.reason === r)?.count;
    const raw = REASONS.map((r) => ({ key: r as string, testid: `queue-section-${r}`, title: GROUP_TITLES[r], dot: REASON_DOTS[r],
      items: items.filter((i) => i.reason === r), count: unfiltered ? serverCount(r) : undefined }));
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

  constructor() {
    // The sub-sidebar around the panel is what scrolls, and scroll events do not bubble.
    const hide = () => this.hideTooltip();
    document.addEventListener('scroll', hide, { capture: true, passive: true });
    inject(DestroyRef).onDestroy(() => document.removeEventListener('scroll', hide, { capture: true }));
    effect(() => {
      if (this.searchOpen()) setTimeout(() => this.searchInput()?.nativeElement.focus());
      else this.query.set('');
    });
  }

  toggleSearch(): void {
    this.searchOpen.update((open) => !open);
  }

  closeSearch(): void {
    this.searchOpen.set(false);
  }

  showTooltip(card: QueueCard, event: Event): void {
    if (this.draggingId()) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const above = rect.top > TOOLTIP_ROOM_PX;
    this.tooltip.set({ card, left: rect.left, top: above ? rect.top - TOOLTIP_GAP_PX : rect.bottom + TOOLTIP_GAP_PX, above });
  }

  hideTooltip(): void {
    this.tooltip.set(null);
  }

  /** "Project › Category", leaving out a category the task does not have. */
  pathOf(item: PlannerFocusItem): string {
    return [item.projectName, item.categoryName].filter((part) => !!part).join(' › ');
  }

  expand(key: string): void {
    this.expanded.update((set) => new Set([...set, key]));
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

  /** A card's look and its status line, which fits its group (redesign D20). */
  private card(item: PlannerFocusItem): QueueCard {
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
    return { item, kind: kindOf(item.categoryKind), age, rest: [detail, planned].filter((part) => !!part).join(' · ') };
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
