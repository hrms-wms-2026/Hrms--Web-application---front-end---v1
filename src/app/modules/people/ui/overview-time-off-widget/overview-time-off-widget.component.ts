import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { WidgetCardComponent } from '../../../../shared/ui/widget-card/widget-card.component';
import { createWidgetLoader } from '../../../../shared/ui/widget-card/widget-loader';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeTimeOffBalance } from '../../models/employee-overview.model';
import { formatHours } from '../../utils/employee-overview.utils';

interface BalanceTone {
  readonly tile: string;
  readonly bar: string;
}

/** Cycled per balance so neighbouring leave types never share a colour. */
const TONES: readonly BalanceTone[] = [
  { tile: 'bg-[var(--color-success-subtle)] text-[var(--color-success)]', bar: 'bg-[var(--color-success)]' },
  { tile: 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)]', bar: 'bg-[var(--color-accent)]' },
  { tile: 'bg-[var(--color-cat-violet-subtle)] text-[var(--color-cat-violet)]', bar: 'bg-[var(--color-cat-violet)]' },
  { tile: 'bg-[var(--color-warning-subtle)] text-[var(--color-warning)]', bar: 'bg-[var(--color-warning)]' },
  { tile: 'bg-cyan-50 text-cyan-600', bar: 'bg-cyan-500' },
  { tile: 'bg-pink-50 text-pink-600', bar: 'bg-pink-500' }
];
const OVERDRAWN: BalanceTone = { tile: 'bg-[var(--color-danger-subtle)] text-[var(--color-danger)]', bar: 'bg-[var(--color-danger)]' };

/**
 * Year-based remaining balance per leave type: intentionally independent of the month period, so
 * it never refetches on a month change. Month leave days live on the Attendance card and the next
 * approved leave on Upcoming, so neither is repeated here.
 */
@Component({
  selector: 'app-overview-time-off-widget',
  standalone: true,
  imports: [WidgetCardComponent],
  host: { class: 'block h-full' },
  template: `
    <app-widget-card
      title="Time Off Balance"
      [state]="loader.state()"
      errorMessage="Could not load time off."
      emptyMessage="No leave entitlements for this year."
      (retry)="loader.reload()"
    >
      @if (loader.data(); as d) {
        <div widget-actions class="flex items-center gap-3">
          @if (d.balances.length > 3) {
            <button
              type="button"
              class="text-xs font-semibold text-[var(--color-accent)] hover:text-[var(--color-accent)] hover:underline cursor-pointer"
              (click)="toggleShowAll()"
            >
              {{ showAll() ? 'Show less' : 'See all (' + d.balances.length + ')' }}
            </button>
          } @else {
            <span class="text-xs text-[var(--color-text-secondary)]">Available balance</span>
          }
        </div>
      }

      @if (loader.data(); as d) {
        <div class="grid gap-3 sm:grid-cols-3">
          @for (b of displayedBalances(d.balances); track b.leaveTypeId; let idx = $index) {
            @let tone = toneFor(b, idx);
            <div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)]/60 p-3.5" data-testid="balance-row">
              <div class="flex items-center gap-3">
                <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" [class]="tone.tile" aria-hidden="true">
                  <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3.5" y="5" width="17" height="15.5" rx="2"></rect>
                    <path d="M16 3v4M8 3v4M3.5 10h17M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01"></path>
                  </svg>
                </span>
                <div class="min-w-0">
                  <p class="truncate text-xs font-semibold text-[var(--color-text-primary)]" [title]="b.leaveTypeName">{{ b.leaveTypeName }}</p>
                  <p class="mt-0.5 whitespace-nowrap">
                    @if (b.isNegative) {
                      <span class="text-lg font-bold text-[var(--color-danger)]">{{ hours(-b.remainingHours) }} overdrawn</span>
                    } @else {
                      <span class="text-lg font-bold text-[var(--color-text-primary)]">{{ hours(b.remainingHours) }}</span>
                    }
                    <span class="text-xs text-[var(--color-text-muted)]"> / {{ hours(b.entitledHours) }}</span>
                  </p>
                </div>
              </div>
              <div
                class="mt-3 h-2 overflow-hidden rounded-full bg-[var(--color-border)]/70"
                role="progressbar"
                [attr.aria-valuemin]="0"
                [attr.aria-valuemax]="100"
                [attr.aria-valuenow]="remainingPercent(b)"
                [attr.aria-label]="b.leaveTypeName + ' remaining'"
              >
                <div class="h-full rounded-full transition-all duration-500" [class]="tone.bar" [style.width.%]="remainingPercent(b)"></div>
              </div>
            </div>
          }
        </div>
      }
    </app-widget-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OverviewTimeOffWidgetComponent {
  private readonly api = inject(PeopleApiService);

  readonly employeeId = input.required<string>();
  readonly showAll = signal(false);

  readonly loader = createWidgetLoader(() => this.api.getOverviewTimeOff(this.employeeId()), {
    isEmpty: (v) => v.balances.length === 0
  });

  hours = formatHours;

  displayedBalances(balances: readonly EmployeeTimeOffBalance[]): readonly EmployeeTimeOffBalance[] {
    return this.showAll() ? balances : balances.slice(0, 3);
  }

  toggleShowAll(): void {
    this.showAll.update((v) => !v);
  }

  toneFor(b: EmployeeTimeOffBalance, index: number): BalanceTone {
    return b.isNegative ? OVERDRAWN : TONES[index % TONES.length];
  }

  /** An overdrawn balance fills the bar in red; otherwise the bar is the share still available. */
  remainingPercent(b: EmployeeTimeOffBalance): number {
    if (b.isNegative) return 100;
    if (b.entitledHours <= 0) return 0;
    return Math.round(Math.max(0, Math.min(1, b.remainingHours / b.entitledHours)) * 100);
  }
}
