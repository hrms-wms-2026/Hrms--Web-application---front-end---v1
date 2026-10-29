import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, input, output, signal } from '@angular/core';
import { PlannerAvatarStackComponent } from '../planner-avatar-stack/planner-avatar-stack.component';
import { KIND_META, TaskKind, TaskKindMeta, kindOf } from '../../../work/utils/task-kind';
import { TaskKindIconComponent } from '../../../work/ui/task-kind-icon/task-kind-icon.component';
import { CommonModule } from '@angular/common';
import { CalendarEventResponse } from '../../models/calendar-event.model';
import { GridItem, PositionedEvent, layoutDayItems } from '../../utils/calendar-hour-grid.util';
import { dateOnlyInTimezone, localPartsToUtcIso, utcIsoToLocalParts } from '../../../../shared/utils/timezone.util';
import { gmtOffsetLabel } from '../../../../shared/utils/timezone-label.util';
import { PlannerRangeBlockView, PlannerWorkWindow } from '../../../work/planner/models/planner.models';
import { PlannerDragService } from '../../state/planner-drag.service';
import {
  MinuteRange, blockRange, busyIntervals, dropLength, kindMinutes, kindSegments, overlapSegments, windowMinutes,
} from '../../utils/planner-grid.util';

/** A day's load for its header cell (2026-10-27 Planner = Calendar design, section 4.5). */
export interface PlannerDayLoad {
  readonly plannedMinutes: number;
  readonly workingMinutes: number;
  readonly over: boolean;
}

interface Band { readonly topPct: number; readonly heightPct: number }

interface PlannerBlockViewModel {
  readonly block: PlannerRangeBlockView;
  readonly range: MinuteRange;
  readonly top: number;
  readonly height: number;
  readonly left: number;
  readonly width: number;
  readonly times: string;
  readonly duration: string;
  readonly short: boolean;
  readonly tooltip: string;
  /** The category's type, its look, and "category · project" (or just the project) under the title. */
  readonly kind: TaskKind;
  readonly meta: TaskKindMeta;
  readonly subtitle: string;
  readonly overlaps: readonly Band[];
  /** The first meeting it overlaps, for the pill and "Move after meeting". */
  readonly clash: { readonly title: string; readonly end: number } | null;
}

interface PlannerPreview {
  readonly date: string;
  readonly start: number;
  readonly end: number;
  readonly invalid: boolean;
}

/** h/m text: "1h 30m", "7h", "45m". */
/** How many kinds a day header lists before "+N". */
const KIND_CHIPS_SHOWN = 3;

function duration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function clock(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

const band = (start: number, end: number): Band => ({ topPct: (start / 1440) * 100, heightPct: ((end - start) / 1440) * 100 });

interface DayColumnViewModel {
  readonly date: string;
  readonly isToday: boolean;
  /** Day and short month, e.g. '26 Oct'; today shows its day number in a circle instead. */
  readonly dayLabel: string;
  readonly weekdayLabel: string; // e.g. "SUN"
  readonly dayNumber: number; // 1-31
  readonly allDayEvents: readonly CalendarEventResponse[];
  /** Events with their local "HH:mm–HH:mm" and, for a meeting, who attends (organizer first). */
  readonly positioned: readonly (PositionedEvent & { readonly times: string; readonly attendeeIds: readonly string[] })[];
  readonly blocks: readonly PlannerBlockViewModel[];
  readonly editable: boolean;
  readonly offHours: readonly Band[];
  /** A non-working day by the legal entity's schedule; still plannable. */
  readonly restDay: boolean;
  readonly load: { readonly label: string; readonly widthPct: number; readonly over: boolean } | null;
  /** The load bar split by kind, and up to three kinds with their planned time (redesign D17). */
  readonly kindSegments: readonly { readonly kind: TaskKind; readonly widthPct: number; readonly bar: string }[];
  readonly kindChips: { readonly shown: readonly { readonly kind: TaskKind; readonly label: string }[]; readonly more: number };
  readonly nowFraction: number | null; // 0-1, only set when isToday
  readonly nowLabel: string | null; // e.g. "9:36 AM", only set when isToday
}

/** 12-hour clock text for the current-time pill, e.g. 9:36 AM / 12:07 AM. */
function formatClock(hour: number, minute: number): string {
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour < 12 ? "AM" : "PM"}`;
}

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const SNAP_MINUTES = 15;
const DAY_MINUTES = 24 * 60;

interface DragSelection {
  readonly date: string;
  readonly topPct: number;
  readonly heightPct: number;
}

@Component({
  selector: 'app-calendar-hour-grid',
  standalone: true,
  imports: [CommonModule, PlannerAvatarStackComponent, TaskKindIconComponent],
  templateUrl: './calendar-hour-grid.component.html',
  // Today's column (header and grid) under the blocks, so the week shows where now is at a glance.
  styles: ['.today-tint { background-color: color-mix(in srgb, var(--color-accent) 6%, transparent); }'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalendarHourGridComponent {
  days = input.required<readonly string[]>();
  events = input<readonly CalendarEventResponse[]>([]);
  timezone = input<string>('UTC');

  eventClick = output<string>();
  slotClick = output<{ date: string; hour: number }>();
  /** Emitted when the user press-drags across the column to pick a time range.
   * Minutes are from midnight, snapped to 15, ordered, at least one snap apart. */
  slotRange = output<{ date: string; startMinutes: number; endMinutes: number }>();

  /** Planner layer (2026-10-27 Planner = Calendar design). All empty while the planner is off. */
  blocks = input<ReadonlyMap<string, readonly PlannerRangeBlockView[]>>(new Map());
  workWindows = input<ReadonlyMap<string, PlannerWorkWindow | null>>(new Map());
  editableDates = input<ReadonlySet<string>>(new Set());
  loads = input<ReadonlyMap<string, PlannerDayLoad>>(new Map());
  employeeId = input<string | null>(null);

  blockCreate = output<{ taskId: string; date: string; startMinutes: number; endMinutes: number }>();
  blockMove = output<{ blockId: string; date: string; startMinutes: number; endMinutes: number }>();
  blockOpen = output<PlannerRangeBlockView>();
  blockMoveAfter = output<{ block: PlannerRangeBlockView; date: string; afterMinute: number }>();
  blockRemove = output<string>();

  readonly hours = HOURS;
  readonly dragSelection = signal<DragSelection | null>(null);
  readonly plannerPreview = signal<PlannerPreview | null>(null);
  readonly openMenu = signal<string | null>(null);

  private readonly drag = inject(PlannerDragService);
  private blockGesture: {
    mode: 'move' | 'resize'; block: PlannerBlockViewModel; date: string; pointerMinute: number; moved: boolean;
  } | null = null;

  /** "GMT+05:30"-style offset for the shown timezone, rendered in the top-left corner
   * cell. Reads `now()` so a DST transition re-derives it. Falls back to the raw id. */
  readonly tzLabel = computed(() => gmtOffsetLabel(this.timezone(), new Date(this.now())));

  private dragDate: string | null = null;
  private dragColumnEl: HTMLElement | null = null;
  private dragStartMinutes = 0;
  private dragCurrentMinutes = 0;
  private dragMoved = false;
  private stopDragListeners: (() => void) | null = null;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  // `columns` derives the red "now" line from the current clock. `new Date()` on its own never
  // invalidates a computed(), so without this tick the line freezes at first render - and also
  // never picks up the tenant timezone, which `loadMyTimezone()` resolves a beat after the grid's
  // first paint (leaving the line stuck at the UTC-offset position). Ticking a signal re-derives
  // it and self-heals that load-order race within one interval. Same pattern as DashboardGreeting.
  private readonly now = signal(Date.now());
  private autoScrollTimer: ReturnType<typeof setTimeout> | null = null;
  private didAutoScroll = false;

  constructor() {
    const tick = setInterval(() => this.now.set(Date.now()), 30_000);
    this.destroyRef.onDestroy(() => {
      clearInterval(tick);
      if (this.autoScrollTimer !== null) clearTimeout(this.autoScrollTimer);
    });

    // On first load, scroll the viewport so the "now" line is centred once today is in view -
    // the grid otherwise opens parked at midnight. Debounced so it settles on the
    // timezone-corrected position (loadMyTimezone resolves a beat after first paint) rather than
    // the transient UTC one. One-shot: it never fights the user's own scrolling afterwards, and
    // does nothing when the shown day isn't today.
    // A Focus card being dragged: follow the pointer over the columns and drop on release. Capture phase, so the drop
    // lands before the panel's own pointerup ends the drag.
    effect((onCleanup) => {
      if (!this.drag.dragging()) {
        this.plannerPreview.set(null);
        return;
      }
      const move = (e: PointerEvent) => this.onFocusDragMove(e);
      const up = () => this.onFocusDrop();
      document.addEventListener('pointermove', move, true);
      document.addEventListener('pointerup', up, true);
      onCleanup(() => {
        document.removeEventListener('pointermove', move, true);
        document.removeEventListener('pointerup', up, true);
      });
    });

    effect(() => {
      const showsToday = this.columns().some((c) => c.nowFraction !== null);
      if (this.didAutoScroll || !showsToday) return;
      if (this.autoScrollTimer !== null) clearTimeout(this.autoScrollTimer);
      this.autoScrollTimer = setTimeout(() => {
        this.didAutoScroll = true;
        const line = this.host.nativeElement.querySelector('[data-testid="calendar-now-line"]');
        line?.scrollIntoView?.({ block: 'center' });
      }, 300);
    });
  }

  private kindLoad(blocks: readonly PlannerRangeBlockView[], workingMinutes: number):
    Pick<DayColumnViewModel, 'kindSegments' | 'kindChips'> {
    const byKind = kindMinutes(blocks);
    const chips = [...byKind.entries()].filter(([, m]) => m > 0).map(([kind, m]) => ({ kind, label: duration(m) }));
    return {
      kindSegments: kindSegments(byKind, workingMinutes).map((s) => ({ ...s, bar: KIND_META[s.kind].bar })),
      kindChips: { shown: chips.slice(0, KIND_CHIPS_SHOWN), more: Math.max(0, chips.length - KIND_CHIPS_SHOWN) },
    };
  }

  readonly columns = computed<readonly DayColumnViewModel[]>(() => {
    const timezone = this.timezone();
    const nowIso = new Date(this.now()).toISOString();
    const todayStr = dateOnlyInTimezone(nowIso, timezone);
    const nowParts = utcIsoToLocalParts(nowIso, timezone);
    const [nowHour, nowMinute] = nowParts.time.split(':').map(Number);

    const blocksByDate = this.blocks();
    const windows = this.workWindows();
    const editable = this.editableDates();
    const loads = this.loads();
    const employeeId = this.employeeId();
    const byDate = new Map<string, CalendarEventResponse[]>();
    for (const event of this.events()) {
      const dateKey = dateOnlyInTimezone(event.startDate, timezone);
      const list = byDate.get(dateKey) ?? [];
      list.push(event);
      byDate.set(dateKey, list);
    }
    return this.days().map((date) => {
      const dayEvents = byDate.get(date) ?? [];
      const dayStart = new Date(localPartsToUtcIso(date, '00:00', timezone));
      const isToday = date === todayStr;
      // `date` is already a wall-clock date in the shown timezone (YYYY-MM-DD), so a
      // local Date built from its parts carries the right weekday without any tz maths.
      const [y, m, d] = date.split('-').map(Number);
      const local = new Date(y, m - 1, d);
      const dayBlocks = blocksByDate.get(date) ?? [];
      const items: GridItem[] = [
        ...dayEvents.filter((e) => !e.isAllDay).map((event): GridItem => ({ kind: 'event', event, start: event.startDate, end: event.endDate })),
        ...dayBlocks.map((block): GridItem => ({ kind: 'block', block, start: block.startAt, end: block.endAt })),
      ];
      const laidOut = layoutDayItems(items, dayStart);
      // Every event, not only those starting this day: a meeting from the evening before can still cover early blocks.
      const busy = busyIntervals(this.events(), employeeId, date, timezone);
      const window = windows.get(date) ?? null;
      const minutes = window ? windowMinutes(window) : null;
      const load = loads.get(date);
      return {
        date,
        isToday,
        weekdayLabel: local.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNumber: d,
        dayLabel: `${d} ${local.toLocaleDateString('en-US', { month: 'short' })}`,
        allDayEvents: dayEvents.filter((e) => e.isAllDay),
        positioned: laidOut.flatMap((p) => p.item.kind === 'event'
          ? [{ event: p.item.event, top: p.top, height: p.height, left: p.left, width: p.width,
            times: `${utcIsoToLocalParts(p.item.event.startDate, timezone).time.slice(0, 5)}–${utcIsoToLocalParts(p.item.event.endDate, timezone).time.slice(0, 5)}`,
            attendeeIds: (p.item.event.participants ?? []).map((x) => x.employeeId) }] : []),
        blocks: laidOut.flatMap((p) => {
          if (p.item.kind !== 'block') return [];
          const block = p.item.block;
          const range = blockRange(block, date, timezone);
          const segments = overlapSegments(range, busy);
          const first = segments[0] ? busy.find((b) => b.eventId === segments[0].eventId) ?? null : null;
          const times = `${clock(range.start)}–${clock(range.end)}`;
          return [{
            block, range, top: p.top, height: p.height, left: p.left, width: p.width, times,
            duration: duration(range.end - range.start), short: range.end - range.start < 30,
            kind: kindOf(block.categoryKind), meta: KIND_META[kindOf(block.categoryKind)],
            subtitle: [block.categoryName, block.projectName].filter((part) => !!part).join(' · '),
            tooltip: `${block.taskTitle} · ${times} · ${duration(block.plannedMinutes)} planned · ${duration(block.actualMinutes)} actual`,
            overlaps: segments.map((s) => band(s.start, s.end)),
            clash: first ? { title: first.title, end: first.end } : null,
          }];
        }),
        editable: editable.has(date),
        offHours: minutes ? [band(0, minutes.start), band(minutes.end, 1440)].filter((b) => b.heightPct > 0) : [],
        restDay: window !== null && !window.isWorkingDay,
        ...this.kindLoad(dayBlocks, load?.workingMinutes ?? 0),
        load: load ? {
          label: `${duration(load.plannedMinutes)} / ${duration(load.workingMinutes)}${load.over ? ' · Over' : ''}`,
          widthPct: load.workingMinutes > 0 ? Math.min(100, (load.plannedMinutes / load.workingMinutes) * 100) : 0,
          over: load.over,
        } : null,
        nowFraction: isToday ? (nowHour * 60 + nowMinute) / 1440 : null,
        nowLabel: isToday ? formatClock(nowHour, nowMinute) : null
      };
    });
  });

  /** Today's column, if shown: drives the time pill in the hour gutter. */
  readonly nowMarker = computed(() => this.columns().find((c) => c.nowFraction !== null) ?? null);

  onSlotPointerDown(date: string, event: PointerEvent, columnEl: HTMLElement): void {
    if (event.button !== 0) return;
    event.preventDefault();
    this.dragDate = date;
    this.dragColumnEl = columnEl;
    this.dragStartMinutes = this.minutesAt(event.clientY, columnEl);
    this.dragCurrentMinutes = this.dragStartMinutes;
    this.dragMoved = false;
    this.updateDragSelection();

    const move = (e: PointerEvent) => this.onDragMove(e);
    const up = (e: PointerEvent) => this.onDragEnd(e);
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    this.stopDragListeners = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      this.stopDragListeners = null;
    };
    this.destroyRef.onDestroy(() => this.stopDragListeners?.());
  }

  private onDragMove(event: PointerEvent): void {
    if (!this.dragColumnEl) return;
    this.dragCurrentMinutes = this.minutesAt(event.clientY, this.dragColumnEl);
    if (Math.abs(this.dragCurrentMinutes - this.dragStartMinutes) >= SNAP_MINUTES) this.dragMoved = true;
    this.updateDragSelection();
  }

  private onDragEnd(_event: PointerEvent): void {
    this.stopDragListeners?.();
    const date = this.dragDate;
    const a = this.dragStartMinutes;
    const b = this.dragCurrentMinutes;
    this.dragSelection.set(null);
    this.dragDate = null;
    this.dragColumnEl = null;
    if (!date) return;

    if (this.dragMoved) {
      const start = Math.min(a, b);
      let end = Math.max(a, b);
      if (end - start < SNAP_MINUTES) end = Math.min(start + SNAP_MINUTES, DAY_MINUTES);
      this.slotRange.emit({ date, startMinutes: start, endMinutes: end });
    } else {
      this.slotClick.emit({ date, hour: Math.floor(a / 60) });
    }
  }

  private updateDragSelection(): void {
    if (!this.dragDate) return;
    const start = Math.min(this.dragStartMinutes, this.dragCurrentMinutes);
    const end = Math.max(this.dragStartMinutes, this.dragCurrentMinutes);
    this.dragSelection.set({
      date: this.dragDate,
      topPct: (start / DAY_MINUTES) * 100,
      heightPct: (Math.max(end - start, SNAP_MINUTES) / DAY_MINUTES) * 100
    });
  }

  // --- Planner blocks: move, resize, menu and the Focus drop ---

  onBlockPointerDown(block: PlannerBlockViewModel, date: string, mode: 'move' | 'resize', event: PointerEvent): void {
    if (event.button !== 0 || !this.editableDates().has(date)) return;
    event.preventDefault();
    event.stopPropagation();
    const column = this.columnEl(date);
    if (!column) return;
    this.blockGesture = { mode, block, date, pointerMinute: this.minutesAt(event.clientY, column), moved: false };
    const move = (e: PointerEvent) => this.onBlockGestureMove(e);
    const up = () => this.onBlockGestureEnd(stop);
    const stop = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    this.destroyRef.onDestroy(stop);
  }

  /** A block on a read-only day still opens its task on click. */
  onBlockClick(block: PlannerBlockViewModel, date: string): void {
    if (!this.editableDates().has(date)) this.blockOpen.emit(block.block);
  }

  toggleMenu(blockId: string, event: Event): void {
    event.stopPropagation();
    this.openMenu.update((open) => (open === blockId ? null : blockId));
  }

  /** The block menu: shift or resize by 15 minutes, within the day and never under 15 minutes. */
  nudge(block: PlannerBlockViewModel, date: string, startDelta: number, endDelta: number): void {
    const length = block.range.end - block.range.start;
    let start = block.range.start + startDelta;
    let end = block.range.end + endDelta;
    if (startDelta !== 0) {
      start = Math.min(Math.max(0, start), DAY_MINUTES - length);
      end = start + length;
    }
    if (end - start < SNAP_MINUTES || end > DAY_MINUTES) return;
    this.blockMove.emit({ blockId: block.block.id, date, startMinutes: start, endMinutes: end });
  }

  moveAfter(block: PlannerBlockViewModel, date: string, event: Event): void {
    event.stopPropagation();
    if (block.clash) this.blockMoveAfter.emit({ block: block.block, date, afterMinute: block.clash.end });
  }

  remove(block: PlannerBlockViewModel, event: Event): void {
    event.stopPropagation();
    this.blockRemove.emit(block.block.id);
  }

  stopPointer(event: Event): void {
    event.stopPropagation();
  }

  private onBlockGestureMove(event: PointerEvent): void {
    const g = this.blockGesture;
    if (!g) return;
    const length = g.block.range.end - g.block.range.start;
    if (g.mode === 'resize') {
      const column = this.columnEl(g.date);
      if (!column) return;
      const end = Math.min(DAY_MINUTES, Math.max(g.block.range.start + SNAP_MINUTES, this.minutesAt(event.clientY, column) || 0));
      g.moved ||= end !== g.block.range.end;
      this.setPreview(g.date, g.block.range.start, end, g.block.block.id);
      return;
    }
    const target = this.columnAt(event.clientX) ?? { date: g.date, el: this.columnEl(g.date)! };
    const delta = this.minutesAt(event.clientY, target.el) - g.pointerMinute;
    const start = Math.min(Math.max(0, g.block.range.start + delta), DAY_MINUTES - length);
    g.moved ||= Math.abs(delta) >= SNAP_MINUTES || target.date !== g.date;
    if (!this.editableDates().has(target.date)) {
      this.plannerPreview.set(null);
      return;
    }
    this.setPreview(target.date, start, start + length, g.block.block.id);
  }

  private onBlockGestureEnd(stop: () => void): void {
    stop();
    const g = this.blockGesture;
    const preview = this.plannerPreview();
    this.blockGesture = null;
    this.plannerPreview.set(null);
    if (!g) return;
    if (!g.moved) {
      if (g.mode === 'move') this.blockOpen.emit(g.block.block);
      return;
    }
    if (preview && !preview.invalid) {
      this.blockMove.emit({ blockId: g.block.block.id, date: preview.date, startMinutes: preview.start, endMinutes: preview.end });
    }
  }

  private onFocusDragMove(event: PointerEvent): void {
    const task = this.drag.dragging();
    const target = this.columnAt(event.clientX);
    if (!task || !target || !this.editableDates().has(target.date)) {
      this.plannerPreview.set(null);
      return;
    }
    const start = Math.min(this.minutesAt(event.clientY, target.el), DAY_MINUTES - SNAP_MINUTES);
    const column = this.columns().find((c) => c.date === target.date);
    const taken = [
      ...(column?.blocks.map((b) => b.range) ?? []),
      ...busyIntervals(this.events(), this.employeeId(), target.date, this.timezone()),
    ];
    const next = taken.filter((r) => r.start > start).reduce<number | null>((min, r) => (min === null || r.start < min ? r.start : min), null);
    const window = this.workWindows().get(target.date);
    const length = dropLength(task.minutes, start, next, window ? windowMinutes(window).end : null);
    this.setPreview(target.date, start, start + length, null);
  }

  private onFocusDrop(): void {
    const task = this.drag.dragging();
    const preview = this.plannerPreview();
    this.plannerPreview.set(null);
    if (!task || !preview || preview.invalid) return;
    this.blockCreate.emit({ taskId: task.taskId, date: preview.date, startMinutes: preview.start, endMinutes: preview.end });
  }

  /** Shows where a block would go; it is invalid over another of the employee's blocks (they never overlap). */
  private setPreview(date: string, start: number, end: number, exceptBlockId: string | null): void {
    const others = (this.columns().find((c) => c.date === date)?.blocks ?? []).filter((b) => b.block.id !== exceptBlockId);
    const invalid = others.some((b) => b.range.start < end && b.range.end > start);
    this.plannerPreview.set({ date, start, end, invalid });
  }

  private columnEls(): HTMLElement[] {
    return Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('[data-testid="calendar-hour-day-column"]'));
  }

  private columnEl(date: string): HTMLElement | null {
    return this.columnEls().find((el) => el.dataset['date'] === date) ?? null;
  }

  private columnAt(clientX: number): { date: string; el: HTMLElement } | null {
    for (const el of this.columnEls()) {
      const rect = el.getBoundingClientRect();
      if (clientX >= rect.left && clientX < rect.right && el.dataset['date']) return { date: el.dataset['date'], el };
    }
    return null;
  }

  private minutesAt(clientY: number, columnEl: HTMLElement): number {
    const rect = columnEl.getBoundingClientRect();
    // scrollHeight is the full 24-hour stack (24 x h-12); rect.height is only the
    // slice visible inside the max-h-[70vh] scroll viewport. The pointer maps to
    // the former - `rect.top` already tracks the internal scroll.
    const fullHeight = columnEl.scrollHeight || rect.height;
    if (!fullHeight) return 0;
    const fraction = Math.min(1, Math.max(0, (clientY - rect.top) / fullHeight));
    const snapped = Math.round((fraction * DAY_MINUTES) / SNAP_MINUTES) * SNAP_MINUTES;
    return Math.min(DAY_MINUTES - SNAP_MINUTES, Math.max(0, snapped));
  }
}
