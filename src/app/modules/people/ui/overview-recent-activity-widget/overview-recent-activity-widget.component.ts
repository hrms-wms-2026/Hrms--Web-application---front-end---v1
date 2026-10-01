import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { WidgetCardComponent } from '../../../../shared/ui/widget-card/widget-card.component';
import { createWidgetLoader } from '../../../../shared/ui/widget-card/widget-loader';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeActivityItem, EmployeeRecentActivityResponse } from '../../models/employee-overview.model';
import { formatActivityWhen } from '../../utils/employee-overview.utils';

const PAGE_SIZE = 20;

/**
 * What the employee did, newest first. Lifetime (not period-aware) and partial by design: the API
 * builds it from existing tables, so some actions are not recorded - the widget says so.
 */
@Component({
  selector: 'app-overview-recent-activity-widget',
  standalone: true,
  imports: [WidgetCardComponent],
  template: `
    <app-widget-card
      title="Recent Activity"
      [state]="loader.state()"
      errorMessage="Could not load recent activity."
      emptyMessage="No recorded activity yet."
      (retry)="loader.reload()"
    >
      @if (loader.data(); as d) {
        <ul class="divide-y divide-[var(--color-border)]">
          @for (item of items(); track item.id) {
            <li class="flex items-start justify-between gap-4 py-2 text-sm" data-testid="activity-item">
              <div class="min-w-0">
                <p class="text-[var(--color-text-primary)]">
                  <span class="font-medium">{{ item.action }}</span>
                  @if (item.target) { <span> {{ item.target }}</span> }
                </p>
                @if (item.detail) {
                  <p class="text-xs text-[var(--color-text-secondary)]">{{ item.detail }}</p>
                }
              </div>
              <span class="shrink-0 text-xs text-[var(--color-text-secondary)]">{{ when(item) }}</span>
            </li>
          }
        </ul>

        @if (olderError()) {
          <p class="mt-2 text-xs text-[var(--color-danger-text)]" role="alert" data-testid="older-error">Could not load older activity. Try again.</p>
        }

        @if (hasMore()) {
          <button
            type="button"
            class="mt-3 rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-secondary)] disabled:cursor-not-allowed disabled:opacity-60"
            data-testid="load-older"
            [disabled]="loadingOlder()"
            (click)="loadOlder()"
          >
            {{ loadingOlder() ? 'Loading…' : 'Load older activity' }}
          </button>
        }

        @if (d.isPartial) {
          <p class="mt-3 text-xs text-[var(--color-text-secondary)]" data-testid="partial-note">
            Showing key activity — some actions are not recorded yet.
          </p>
        }
      }
    </app-widget-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OverviewRecentActivityWidgetComponent {
  private readonly api = inject(PeopleApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly employeeId = input.required<string>();

  readonly loader = createWidgetLoader(
    () => this.api.getOverviewRecentActivity(this.employeeId(), null, PAGE_SIZE),
    { isEmpty: (v) => v.items.length === 0 }
  );

  /**
   * Pages loaded after the first one. Tied to the exact first-page response they extend (`base`),
   * so a reload or an employee change produces a new response object and the stale pages simply
   * stop matching - no effect is needed to reset them.
   */
  private readonly paged = signal<{
    readonly base: EmployeeRecentActivityResponse;
    readonly items: readonly EmployeeActivityItem[];
    readonly cursor: string | null;
  } | null>(null);
  readonly loadingOlder = signal(false);
  readonly olderError = signal(false);

  /** Fixed at construction so "Today"/"Yesterday" do not change while the widget is open. */
  private readonly now = new Date();

  private readonly currentPaging = computed(() => {
    const first = this.loader.data();
    const paged = this.paged();
    return first && paged && paged.base === first ? paged : null;
  });

  readonly items = computed(() => [...(this.loader.data()?.items ?? []), ...(this.currentPaging()?.items ?? [])]);
  private readonly cursor = computed<string | null>(() => {
    const first = this.loader.data();
    if (!first) return null;
    const paging = this.currentPaging();
    return paging ? paging.cursor : first.nextBefore;
  });
  readonly hasMore = computed(() => this.cursor() !== null);

  when(item: EmployeeActivityItem): string {
    return formatActivityWhen(item.at, this.now);
  }

  loadOlder(): void {
    const first = this.loader.data();
    const before = this.cursor();
    if (!first || before === null || this.loadingOlder()) return;

    const employeeId = this.employeeId();
    this.loadingOlder.set(true);
    this.olderError.set(false);
    this.api
      .getOverviewRecentActivity(employeeId, before, PAGE_SIZE)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.loadingOlder.set(false);
          if (employeeId !== this.employeeId()) return;
          const existing = this.currentPaging()?.items ?? [];
          this.paged.set({ base: first, items: [...existing, ...page.items], cursor: page.nextBefore });
        },
        error: () => {
          this.loadingOlder.set(false);
          this.olderError.set(true);
        }
      });
  }
}
