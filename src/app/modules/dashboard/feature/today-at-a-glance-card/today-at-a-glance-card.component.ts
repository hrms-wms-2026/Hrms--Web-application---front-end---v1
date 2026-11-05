import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, afterNextRender, computed, effect, inject, signal } from '@angular/core';
import { DashboardGreetingComponent } from '../dashboard-greeting/dashboard-greeting.component';
import { TimeTrackingStore } from '../../../attendance/state/time-tracking.store';
import { LeaveRequestApiService } from '../../../leave/data-access/leave-request-api.service';
import { formatMinutes } from '../../util/timeline-segments.util';
import { getTimeOfDayInfo, TimeOfDayInfo } from '../../util/time-of-day.util';
import { DayBlock, DayBlockType, ShiftAxis, TimeInterval, buildDayBlocks, buildShiftAxis } from '../../util/shift-axis.util';

const CLOCK_FORMAT = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });

/** "9:00 AM" style, whatever the browser locale; null for an invalid date. */
function formatClock(date: Date): string | null {
  return Number.isNaN(date.getTime()) ? null : CLOCK_FORMAT.format(date);
}

/** The activity bar's legend, in the design's order; Upcoming is the bar's own background. */
const BLOCK_LEGEND: readonly { type: DayBlockType | 'upcoming'; label: string; dotClass: string }[] = [
  { type: 'working', label: 'Working', dotClass: 'bg-[var(--color-accent)]' },
  { type: 'break', label: 'Break', dotClass: 'bg-[var(--color-warning)]' },
  { type: 'leave', label: 'Leave', dotClass: 'bg-[var(--color-danger)]' },
  { type: 'upcoming', label: 'Upcoming', dotClass: 'bg-[var(--color-border)]' }
];

const BLOCK_CLASS: Record<DayBlockType, string> = {
  working: 'bg-gradient-to-r from-[var(--color-accent)] to-sky-500',
  break: 'bg-[var(--color-warning)]',
  leave: 'bg-[var(--color-danger)]'
};

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * The design's own size. The card is always laid out at (at least) this size - the full design: picture
 * top right, tiles side by side, every hour on the bar - and then scaled to fit whatever size the card has.
 */
const DESIGN_WIDTH = 800;
const DESIGN_HEIGHT = 620;

/**
 * Whether hour tick `index` of `count` is labelled when at most `max` labels fit: every `step`th hour
 * from the first, plus the last - dropping the one before it if it would sit closer than a step.
 */
export function isTickShown(index: number, count: number, max: number): boolean {
  if (count <= max) return true;
  const last = count - 1;
  if (index === last) return true;
  const step = Math.ceil(last / (max - 1));
  return index % step === 0 && last - index >= step;
}

const STATUS_LABELS: Record<string, string> = {
  not_clocked_in: 'Not clocked in',
  clocked_in: 'Clocked in',
  on_break: 'On break',
  clocked_out: 'Clocked out'
};

@Component({
  selector: 'app-today-at-a-glance-card',
  standalone: true,
  imports: [DashboardGreetingComponent],
  // The card clips the scaled design canvas inside it (see DESIGN_WIDTH).
  host: { class: 'relative block h-full overflow-hidden rounded-2xl' },
  templateUrl: './today-at-a-glance-card.component.html',
  // On a wide card the illustration sits top right and fades out to the left and to the bottom.
  styles: `
    @container (min-width: 32rem) {
      .greeting-art {
        -webkit-mask-image: linear-gradient(to right, transparent, #000 45%), linear-gradient(to bottom, #000 50%, transparent);
        -webkit-mask-composite: source-in;
        mask-image: linear-gradient(to right, transparent, #000 45%), linear-gradient(to bottom, #000 50%, transparent);
        mask-composite: intersect;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TodayAtAGlanceCardComponent implements OnInit {
  private readonly store = inject(TimeTrackingStore);
  private readonly leaveApi = inject(LeaveRequestApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private tickTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * The design canvas: at least DESIGN_WIDTH x DESIGN_HEIGHT, stretched to the card's shape so the card is
   * always filled, and scaled by `scale` to the card's real size.
   */
  protected readonly canvas = signal({ width: DESIGN_WIDTH, height: DESIGN_HEIGHT, scale: 1 });
  // Ticks every minute so greeting/timeline/"last updated" labels stay live without a manual
  // page reload - the greeting/timeline calculations below read this instead of calling
  // `new Date()`/`Date.now()` directly so they re-run on each tick.
  private readonly now = signal(Date.now());

  protected readonly today = this.store.today;
  protected readonly loading = this.store.todayLoading;
  protected readonly timeOfDayInfo = computed<TimeOfDayInfo>(() => getTimeOfDayInfo(new Date(this.now())));

  /** Approved leave around today, as start/end; drawn red on the activity bar. */
  private readonly leaves = signal<TimeInterval[]>([]);
  private leaveRequestedFor: string | null = null;

  protected readonly statusLabel = computed(() => {
    const today = this.today();
    if (!today) {
      return '';
    }
    return today.attendanceStatusLabel?.trim() || STATUS_LABELS[today.attendanceStatus] || 'Not specified';
  });

  protected readonly clockInTimeLabel = computed(() => {
    const clockInAt = this.today()?.clockInAt;
    return clockInAt ? formatClock(new Date(clockInAt)) : null;
  });

  /** Required time still to work today, in minutes; null when the day has no target. */
  private readonly minutesLeft = computed(() => {
    const today = this.today();
    const required = today?.requiredWorkMinutes ?? 0;
    return required > 0 ? Math.max(0, required - (today?.totalWorkedMinutes ?? 0)) : null;
  });

  /** Required time still to work today, never below zero; a dash when the day has no target. */
  protected readonly timeLeftLabel = computed(() => formatMinutes(this.minutesLeft()));

  /**
   * When the day ends: the clock-out time once clocked out, otherwise the time left counted from the
   * last refresh (the worked minutes are as of that refresh). Nothing before clock-in or without a target.
   */
  protected readonly finishLabel = computed(() => {
    const today = this.today();
    if (!today?.clockInAt) return null;
    if (today.clockOutAt) {
      const out = formatClock(new Date(today.clockOutAt));
      return out ? `Finished at ${out}` : null;
    }
    const left = this.minutesLeft();
    if (left === null) return null;
    if (left === 0) return 'Required time done';
    const from = this.lastUpdated()?.getTime() ?? this.now();
    return `Finish at ${formatClock(new Date(from + left * 60_000))}`;
  });

  /** Clocked in and not yet out - whatever the backend's status label says. */
  protected readonly isActive = computed(() => !!this.today()?.clockInAt && !this.today()?.clockOutAt);

  /** On a break right now: a break with no end yet (or the backend's on_break status). */
  protected readonly onBreak = computed(() => {
    const today = this.today();
    return !!today && (today.attendanceStatus === 'on_break' || (today.breaks ?? []).some((b) => !b.endedAt));
  });

  protected readonly workedDurationLabel = computed(() => formatMinutes(this.today()?.totalWorkedMinutes ?? null));

  /** The activity bar's scale: the scheduled shift, stretched for an early start or overtime. */
  protected readonly shiftAxis = computed<ShiftAxis | null>(() => {
    const today = this.today();
    return today ? buildShiftAxis(today, this.now()) : null;
  });

  protected readonly nowLabel = computed(() => formatClock(new Date(this.now())));

  protected readonly legend = BLOCK_LEGEND;

  /** Working, Break and Leave as solid blocks on the shift bar; the rest of the bar is Upcoming. */
  protected readonly dayBlocks = computed<DayBlock[]>(() => {
    const today = this.today();
    const axis = this.shiftAxis();
    if (!today || !axis) return [];
    // The today-summary can omit `breaks` entirely (seen live during an in-progress break).
    const breaks = (today.breaks ?? []).map((b) => ({ start: b.startedAt, end: b.endedAt }));
    return buildDayBlocks(axis, today, breaks, this.leaves(), this.now());
  });

  private readonly lastUpdated = signal<Date | null>(null);

  constructor() {
    afterNextRender(() => {
      const el = this.host.nativeElement;
      this.fitCanvas(el.clientWidth, el.clientHeight);
      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(([entry]) => this.fitCanvas(entry.contentRect.width, entry.contentRect.height));
      observer.observe(el);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });

    this.tickTimer = setInterval(() => this.now.set(Date.now()), 60_000);
    this.destroyRef.onDestroy(() => {
      if (this.tickTimer !== null) clearInterval(this.tickTimer);
    });

    // Approved leave touching today (a day either side covers the timezone offset), once per work date.
    effect(() => {
      const workDate = this.today()?.workDate;
      if (!workDate || this.leaveRequestedFor === workDate) return;
      this.leaveRequestedFor = workDate;
      this.leaveApi.listMine({ status: 'approved', fromDate: addDays(workDate, -1), toDate: addDays(workDate, 1) }).subscribe({
        next: (rows) => this.leaves.set(rows.map((r) => ({ start: r.startAt, end: r.endAt }))),
        error: () => this.leaves.set([])
      });
    });
  }

  ngOnInit(): void {
    void this.store.loadToday().then(() => this.lastUpdated.set(new Date()));
  }

  private fitCanvas(width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    const scale = Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT);
    this.canvas.set({ width: width / scale, height: height / scale, scale });
  }

  /**
   * Hour labels, thinned so they never run into each other: a long day (e.g. 9 AM to 11 PM after
   * working late) has too many hours for the bar, so only every 2nd/3rd/... hour is labelled. How
   * many fit depends on the card's width - just first and last on a narrow one.
   */
  protected tickClass(index: number, count: number): string {
    const base = isTickShown(index, count, 2) ? 'flex' : 'hidden';
    const lg = isTickShown(index, count, 6) ? '@lg:flex' : '@lg:hidden';
    const xl2 = isTickShown(index, count, 10) ? '@2xl:flex' : '@2xl:hidden';
    return `${base} ${lg} ${xl2}`;
  }

  protected blockClass(type: DayBlockType): string {
    return BLOCK_CLASS[type];
  }
}
