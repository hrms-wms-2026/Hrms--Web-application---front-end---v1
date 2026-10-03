import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PopoutHeaderActionsComponent, latestDate } from '../../../../shared/ui/popout-header-actions/popout-header-actions.component';
import { PopoutPanelComponent } from '../../../../shared/ui/popout-panel/popout-panel.component';
import { WidgetCardComponent } from '../../../../shared/ui/widget-card/widget-card.component';
import { createWidgetLoader } from '../../../../shared/ui/widget-card/widget-loader';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeAttendanceDay, EmployeeAttendanceDayDetail } from '../../models/employee-overview.model';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { attendanceDayLabel, formatMinutes } from '../../utils/employee-overview.utils';
import { createCompareLoader, deltaIf } from '../../utils/overview-compare';
import { DeltaBadgeComponent } from '../delta-badge/delta-badge.component';

@Component({
  selector: 'app-overview-attendance-widget',
  standalone: true,
  imports: [WidgetCardComponent, DeltaBadgeComponent, PopoutPanelComponent, PopoutHeaderActionsComponent],
  host: { class: 'block h-full' },
  template: `
    <app-popout-panel
      class="block h-full"
      [open]="showAll()"
      label="Attendance days"
      expandedWidth="60rem"
      expandedMaxHeight="min(85vh, 56rem)"
      (closed)="showAll.set(false)"
    >
    <app-widget-card
      class="group h-full block"
      [class.cursor-pointer]="!showAll()"
      (click)="expand()"
      title="Attendance"
      [state]="loader.state()"
      errorMessage="Could not load attendance."
      emptyMessage="No attendance records for this period."
      (retry)="loader.reload()"
    >
      <app-popout-header-actions
        widget-actions
        [refreshedAt]="refreshedAt()"
        [refreshing]="refreshing()"
        [expanded]="showAll()"
        [canExpand]="true"
        [revealOnHover]="!showAll()"
        (refresh)="refreshAll()"
        (expand)="expand()"
        (closed)="showAll.set(false)"
      />
      @if (loader.data(); as d) {
        <div class="flex flex-col">
          <div>
            <dl class="grid grid-cols-3 gap-2 text-center" data-testid="attendance-stats">
              <div>
                <dd class="flex flex-col items-center text-xl font-bold text-slate-900"><span data-testid="stat-present">{{ d.present }}</span><app-delta-badge [delta]="presentDelta()" [against]="period.compareLabel()" /></dd>
                <dt class="text-[11px] text-slate-500 mt-0.5">Present</dt>
              </div>
              <div>
                <dd class="flex flex-col items-center text-xl font-bold text-amber-600"><span data-testid="stat-late">{{ d.late }}</span><app-delta-badge [delta]="lateDelta()" [against]="period.compareLabel()" /></dd>
                <dt class="text-[11px] text-slate-500 mt-0.5">Late</dt>
              </div>
              <div>
                <dd class="flex flex-col items-center text-xl font-bold text-slate-900"><span data-testid="stat-leave">{{ d.leaveDays }}</span><app-delta-badge [delta]="leaveDelta()" [against]="period.compareLabel()" /></dd>
                <dt class="text-[11px] text-slate-500 mt-0.5">Leave</dt>
              </div>
            </dl>

            @if (recentDays(d.days); as recent) {
              @if (recent.length > 0) {
                <!-- The last few working days of the period up to today, newest on the right -->
                <div class="mt-4 flex items-center justify-between px-1 py-1.5 rounded-lg bg-slate-50 text-[11px]" data-testid="recent-days">
                  @for (item of recent; track item.date) {
                    <div data-testid="recent-day" class="flex flex-col items-center gap-1 flex-1" [title]="item.date + ' · ' + label(item.status)">
                      <span class="text-slate-400">{{ item.weekday }}</span>
                      <span class="font-bold text-slate-700">{{ item.dayNum }}</span>
                      <span class="dot" [class]="'s--' + item.status"></span>
                    </div>
                  }
                </div>
              }
            }
          </div>

          <div class="mt-4 pt-3 border-t border-slate-100">
            <div class="flex h-2 items-end gap-[2px] rounded-full overflow-hidden" role="img" [attr.aria-label]="stripLabel(d.days)" data-testid="attendance-strip">
              @for (day of stripDays(d.days); track day.date) {
                <span
                  data-testid="day-bar"
                  class="day flex-1"
                  [class]="'s--' + day.status"
                  [attr.title]="day.date + ' · ' + label(day.status)"
                ></span>
              }
            </div>
            <!-- View each day shares the summary line, so the card has no extra footer row. -->
            <div class="mt-2.5 flex items-center justify-between gap-3">
              <p class="text-xs text-slate-500">
                {{ d.present }} of {{ d.workingDays }} working days attended
              </p>
              @if (!showAll()) {
                <button type="button" class="relative top-5 shrink-0 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer" data-testid="attendance-toggle" (click)="onToggleClick($event)">View each day</button>
              }
            </div>
          </div>

          @if (showAll()) {
            <section class="mt-4 border-t border-slate-100 pt-4" data-testid="attendance-day-list" aria-label="Days">
              @switch (daysState()) {
                @case ('loading') {
                  <div class="space-y-2" data-testid="attendance-days-loading" aria-hidden="true">
                    @for (i of [0, 1, 2, 3]; track i) {
                      <div class="h-14 animate-pulse rounded-xl bg-slate-100"></div>
                    }
                  </div>
                }
                @case ('error') {
                  <p class="py-4 text-center text-sm text-rose-600" data-testid="attendance-days-error">
                    Could not load the days.
                    <button type="button" class="font-semibold underline cursor-pointer" (click)="retryDays($event)">Retry</button>
                  </p>
                }
                @default {
                  <ul class="space-y-2">
                    @for (day of days(); track day.date) {
                      <li>
                        <button
                          type="button"
                          class="grid w-full grid-cols-[6.5rem_minmax(0,1fr)_auto] items-center gap-4 rounded-xl border border-slate-100 bg-white px-4 py-3 text-left transition-colors hover:border-blue-200 hover:bg-blue-50/40 cursor-pointer"
                          data-testid="attendance-day"
                          [attr.aria-label]="'Open ' + day.date"
                          (click)="openDay($event, day)"
                        >
                          <div>
                            <p class="text-sm font-semibold text-slate-900">{{ dayLabel(day.date) }}</p>
                            <span class="mt-1 inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold" [class]="statusChip(day.status)" data-testid="attendance-day-status">
                              <span class="dot" [class]="'s--' + displayStatus(day.status)"></span>{{ statusText(day) }}
                            </span>
                          </div>

                          <div class="min-w-0 text-sm">
                            @if (day.clockInLocal) {
                              <p class="font-medium text-slate-900" data-testid="attendance-day-times">
                                {{ day.clockInLocal }} → {{ day.clockOutLocal ?? 'No clock-out' }}
                                @if (day.scheduledStart) {
                                  <span class="ml-1 text-xs font-normal text-slate-400">Scheduled {{ day.scheduledStart }}–{{ day.scheduledEnd }}</span>
                                }
                              </p>
                              <p class="mt-0.5 text-xs text-slate-500" data-testid="attendance-day-hours">
                                Worked {{ minutes(day.workedMinutes) }}@if (day.requiredWorkMinutes) { of {{ minutes(day.requiredWorkMinutes) }} } · Break {{ minutes(day.breakMinutes) }}@if (day.workMode) { · {{ day.workMode }} }
                              </p>
                            } @else {
                              <p class="text-slate-500">{{ noClockText(day) }}</p>
                            }
                          </div>

                          <div class="flex flex-wrap items-center justify-end gap-1.5" data-testid="attendance-day-flags">
                            @if (day.lateMinutes > 0) { <span class="flag flag--warn">{{ day.lateMinutes }}m late</span> }
                            @if (day.earlyLeaveMinutes > 0) { <span class="flag flag--warn">Left {{ day.earlyLeaveMinutes }}m early</span> }
                            @if (day.shortHours) { <span class="flag flag--warn">Short hours</span> }
                            @if (day.overBreakMinutes > 0) { <span class="flag flag--warn">{{ day.overBreakMinutes }}m over break</span> }
                            @if (day.status === 'missing_clock_out') { <span class="flag flag--bad">Missing clock-out</span> }
                            <svg class="h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"></polyline></svg>
                          </div>
                        </button>
                      </li>
                    } @empty {
                      <p class="py-4 text-center text-sm text-slate-500">No days to show yet.</p>
                    }
                  </ul>
                }
              }
              <div class="mt-4 flex justify-end">
                <button type="button" class="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer" data-testid="attendance-toggle" (click)="onToggleClick($event)">Show less</button>
              </div>
            </section>
          }
        </div>
      }
    </app-widget-card>
    </app-popout-panel>
  `,
  // One colour per status, shared by the recent-day dots and the period strip so both read the same.
  styles: [`
    .day { min-width: 3px; border-radius: 2px; height: 100%; }
    .dot { width: 6px; height: 6px; border-radius: 9999px; }
    .s--present { background: #16a34a; }
    .s--late { background: #f59e0b; }
    .s--leave { background: #3b82f6; }
    .s--absent { background: #f43f5e; }
    .s--off { background: var(--color-border); }
    .s--none { background: var(--color-border); }
    .flag { border-radius: 0.375rem; padding: 0.125rem 0.5rem; font-size: 0.6875rem; font-weight: 600; white-space: nowrap; }
    .flag--warn { background: #fffbeb; color: #b45309; }
    .flag--bad { background: #fff1f2; color: #be123c; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OverviewAttendanceWidgetComponent {
  private readonly api = inject(PeopleApiService);
  readonly period = inject(EmployeePeriodStore);

  readonly employeeId = input.required<string>();

  readonly loader = createWidgetLoader(
    () => this.api.getOverviewAttendance(this.employeeId(), this.period.from(), this.period.to()),
    { isEmpty: (v) => v.days.length === 0 }
  );
  readonly compareLoader = createCompareLoader(this.period, (from, to) =>
    this.api.getOverviewAttendance(this.employeeId(), from, to)
  );
  readonly presentDelta = computed(() =>
    deltaIf(this.period.isComparing(), this.loader.data()?.present, this.compareLoader.data()?.present, 'higher-better')
  );
  readonly lateDelta = computed(() =>
    deltaIf(this.period.isComparing(), this.loader.data()?.late, this.compareLoader.data()?.late, 'lower-better')
  );
  readonly leaveDelta = computed(() =>
    deltaIf(this.period.isComparing(), this.loader.data()?.leaveDays, this.compareLoader.data()?.leaveDays, 'neutral')
  );

  label = attendanceDayLabel;

  /** A day row was clicked; the Overview opens it in the attendance day drawer (in the employee's timezone). */
  readonly daySelected = output<{ readonly day: EmployeeAttendanceDayDetail; readonly timezone: string }>();
  readonly showAll = signal(false);
  private readonly destroyRef = inject(DestroyRef);
  readonly days = signal<readonly EmployeeAttendanceDayDetail[]>([]);
  readonly daysState = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  private readonly daysLoadedAt = signal<Date | null>(null);
  private readonly daysRefreshing = signal(false);
  /** When the shown data last came from the backend (card counts or day list, whichever is newer). */
  readonly refreshedAt = computed(() => latestDate(this.loader.loadedAt(), this.daysLoadedAt()));
  readonly refreshing = computed(() => this.loader.refreshing() || this.daysRefreshing());
  private daysTimezone = 'UTC';
  /** Which employee + month the loaded days belong to. */
  private readonly daysKey = computed(() => `${this.employeeId()}|${this.period.from()}|${this.period.to()}`);

  constructor() {
    // A new employee or month makes the loaded days stale: drop them, and refetch if the list is open.
    effect(() => {
      this.daysKey();
      untracked(() => {
        this.days.set([]);
        this.daysState.set('idle');
        if (this.showAll()) this.loadDays();
      });
    });
  }

  /** A click anywhere on the card pops it out with every day (fetched on first open per month). */
  expand(): void {
    if (this.showAll() || !this.loader.data()) return;
    this.showAll.set(true);
    if (this.daysState() === 'idle' || this.daysState() === 'error') this.loadDays();
  }

  onToggleClick(event: Event): void {
    event.stopPropagation();
    if (this.showAll()) this.showAll.set(false);
    else this.expand();
  }

  openDay(event: Event, day: EmployeeAttendanceDayDetail): void {
    event.stopPropagation();
    this.daySelected.emit({ day, timezone: this.daysTimezone });
  }

  retryDays(event: Event): void {
    event.stopPropagation();
    this.loadDays();
  }

  dayLabel(date: string): string {
    const [year, month, day] = date.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  /** A missing clock-out is still an attended day; the flag says the rest. */
  displayStatus(status: EmployeeAttendanceDay['status']): EmployeeAttendanceDay['status'] {
    return status === 'missing_clock_out' ? 'present' : status;
  }

  statusText(day: EmployeeAttendanceDayDetail): string {
    if (day.status === 'off') return day.holidayName ?? 'Day off';
    return attendanceDayLabel(this.displayStatus(day.status));
  }

  statusChip(status: EmployeeAttendanceDay['status']): string {
    switch (this.displayStatus(status)) {
      case 'present': return 'bg-emerald-50 text-emerald-700';
      case 'late': return 'bg-amber-50 text-amber-700';
      case 'leave': return 'bg-blue-50 text-blue-700';
      case 'absent': return 'bg-rose-50 text-rose-700';
      default: return 'bg-slate-100 text-slate-600';
    }
  }

  noClockText(day: EmployeeAttendanceDayDetail): string {
    switch (day.status) {
      case 'leave': return 'On approved leave';
      case 'absent': return 'No clock-in or approved leave';
      case 'off': return day.holidayName ? 'Holiday' : 'Not a working day';
      default: return 'No clock-in yet';
    }
  }

  minutes = formatMinutes;

  /** Popup refresh: the counts and the day list again, keeping both on screen until the new data lands. */
  refreshAll(): void {
    this.loader.refresh();
    // The day list is only refetched if it has been loaded (i.e. the popup was opened).
    if (this.daysState() === 'ready') this.loadDays();
  }

  private loadDays(): void {
    const key = this.daysKey();
    // With days already showing, refetch quietly; the header's refresh icon spins instead.
    if (this.daysState() === 'ready') this.daysRefreshing.set(true);
    else this.daysState.set('loading');
    this.api
      .getOverviewAttendanceDays(this.employeeId(), this.period.from(), this.period.to())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (key !== this.daysKey()) return;
          this.daysTimezone = response.timezone || 'UTC';
          this.days.set(response.days);
          this.daysState.set('ready');
          this.daysLoadedAt.set(new Date());
          this.daysRefreshing.set(false);
        },
        error: () => {
          const wasRefresh = this.daysRefreshing();
          this.daysRefreshing.set(false);
          if (key === this.daysKey() && !wasRefresh) this.daysState.set('error');
        }
      });
  }

  stripLabel(days: readonly EmployeeAttendanceDay[]): string {
    const shown = days.map(displayDay);
    const count = (status: EmployeeAttendanceDay['status']) => shown.filter((d) => d.status === status).length;
    return `Daily attendance: ${count('present')} present, ${count('late')} late, ${count('leave')} on leave, ${count('absent')} absent`;
  }

  stripDays(days: readonly EmployeeAttendanceDay[]): readonly EmployeeAttendanceDay[] {
    return days.filter((day) => day.status !== 'none' && day.status !== 'off').map(displayDay);
  }

  /** The last RECENT_DAY_COUNT working days of the period that have already happened; empty when there are none. */
  recentDays(days: readonly EmployeeAttendanceDay[]) {
    const today = localIsoDate(new Date());
    return days
      .filter((day) => day.date <= today && day.status !== 'off' && day.status !== 'none')
      .slice(-RECENT_DAY_COUNT)
      .map((day) => {
        const [year, month, date] = day.date.split('-').map(Number);
        return {
          date: day.date,
          weekday: new Date(year, month - 1, date).toLocaleDateString('en-US', { weekday: 'short' }),
          dayNum: date,
          status: displayDay(day).status
        };
      });
  }
}

const RECENT_DAY_COUNT = 5;

/** A missing clock-out still means the employee turned up, so it is shown as an ordinary present day. */
function displayDay(day: EmployeeAttendanceDay): EmployeeAttendanceDay {
  return day.status === 'missing_clock_out' ? { ...day, status: 'present' } : day;
}

function localIsoDate(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
