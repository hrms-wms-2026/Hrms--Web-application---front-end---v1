import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { WidgetCardComponent } from '../../../../shared/ui/widget-card/widget-card.component';
import { createWidgetLoader } from '../../../../shared/ui/widget-card/widget-loader';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { appDisplayName, formatClock, formatDurationCompact } from '../../utils/employee-work-activity.utils';

@Component({
  selector: 'app-work-pattern-widget',
  standalone: true,
  imports: [WidgetCardComponent],
  template: `
    <app-widget-card
      title="Work Pattern"
      [state]="loader.state()"
      emptyMessage="Activity monitoring is off for this employee."
      errorMessage="Could not load the work pattern."
      (retry)="loader.reload()"
    >
      @if (loader.data(); as d) {
        <p class="-mt-1 mb-3 text-xs text-slate-500">How the working day was spent this period</p>
        <dl class="flex flex-1 flex-col gap-2">
          <div data-testid="pattern-focus" class="flex items-center gap-3 rounded-xl bg-blue-50 p-3">
            <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-blue-600" aria-hidden="true">
              <svg class="h-[1.125rem] w-[1.125rem]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="5"></circle><circle cx="12" cy="12" r="1"></circle></svg>
            </span>
            <div class="min-w-0 flex-1">
              <dt class="text-xs font-medium text-blue-700">Focused work blocks <span class="font-normal text-blue-500">(&ge; 30 min)</span></dt>
              <dd class="text-base font-bold text-slate-900">{{ d.focusBlocks }}</dd>
            </div>
          </div>
          <div data-testid="pattern-top-app" class="flex items-center gap-3 rounded-xl bg-violet-50 p-3">
            <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-violet-600" aria-hidden="true">
              <svg class="h-[1.125rem] w-[1.125rem]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12" rx="2"></rect><path d="M8 20h8M12 16v4"></path></svg>
            </span>
            <div class="min-w-0 flex-1">
              <dt class="text-xs font-medium text-violet-700">Top application</dt>
              <dd class="flex items-baseline justify-between gap-2">
                <span class="truncate text-base font-bold text-slate-900" [title]="d.topApp ? appName(d.topApp) : ''">{{ d.topApp ? appName(d.topApp) : '—' }}</span>
                @if (d.topApp) {
                  <span class="shrink-0 text-xs font-semibold text-violet-700">{{ fmt(d.topAppMinutes) }}</span>
                }
              </dd>
            </div>
          </div>
          <div data-testid="pattern-idle" class="flex items-center gap-3 rounded-xl bg-amber-50 p-3">
            <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-amber-600" aria-hidden="true">
              <svg class="h-[1.125rem] w-[1.125rem]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg>
            </span>
            <div class="min-w-0 flex-1">
              <dt class="text-xs font-medium text-amber-700">Longest idle period</dt>
              @if (d.longestIdle; as idle) {
                <dd class="flex items-baseline justify-between gap-2">
                  <span class="text-base font-bold text-slate-900">{{ fmt(idle.minutes) }}</span>
                  <span class="truncate text-xs text-amber-700">{{ clock(idle.start) }} – {{ clock(idle.end) }}</span>
                </dd>
              } @else {
                <dd class="text-base font-bold text-slate-900">—</dd>
              }
            </div>
          </div>
        </dl>
      }
    </app-widget-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkPatternWidgetComponent {
  private readonly api = inject(PeopleApiService);
  private readonly period = inject(EmployeePeriodStore);

  readonly employeeId = input.required<string>();

  readonly loader = createWidgetLoader(
    () => this.api.getWorkActivityWorkPattern(this.employeeId(), this.period.from(), this.period.to()),
    { isEmpty: (d) => !d.activityMonitoringEnabled }
  );

  appName(name: string): string {
    return appDisplayName(name);
  }

  fmt(minutes: number): string {
    return formatDurationCompact(minutes);
  }

  clock(iso: string): string {
    return formatClock(iso);
  }
}
