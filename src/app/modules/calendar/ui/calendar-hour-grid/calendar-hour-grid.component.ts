import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CalendarEventResponse } from '../../models/calendar-event.model';
import { PositionedEvent, layoutDayEvents } from '../../utils/calendar-hour-grid.util';
import { dateOnlyInTimezone, localPartsToUtcIso, utcIsoToLocalParts } from '../../../../shared/utils/timezone.util';

interface DayColumnViewModel {
  readonly date: string;
  readonly isToday: boolean;
  readonly weekdayLabel: string; // e.g. "SUN"
  readonly dayNumber: number; // 1-31
  readonly allDayEvents: readonly CalendarEventResponse[];
  readonly positioned: readonly PositionedEvent[];
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
  imports: [CommonModule],
  templateUrl: './calendar-hour-grid.component.html',
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

  readonly hours = HOURS;
  readonly dragSelection = signal<DragSelection | null>(null);

  /** "GMT+05:30"-style offset for the shown timezone, rendered in the top-left corner
   * cell. Reads `now()` so a DST transition re-derives it. Falls back to the raw id. */
  readonly tzLabel = computed(() => {
    const tz = this.timezone();
    try {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' })
        .formatToParts(new Date(this.now()));
      return parts.find((p) => p.type === 'timeZoneName')?.value ?? tz;
    } catch {
      return tz;
    }
  });

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

  readonly columns = computed<readonly DayColumnViewModel[]>(() => {
    const timezone = this.timezone();
    const nowIso = new Date(this.now()).toISOString();
    const todayStr = dateOnlyInTimezone(nowIso, timezone);
    const nowParts = utcIsoToLocalParts(nowIso, timezone);
    const [nowHour, nowMinute] = nowParts.time.split(':').map(Number);

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
      return {
        date,
        isToday,
        weekdayLabel: local.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
        dayNumber: d,
        allDayEvents: dayEvents.filter((e) => e.isAllDay),
        positioned: layoutDayEvents(dayEvents, dayStart),
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
      let start = Math.min(a, b);
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
