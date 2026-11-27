import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PopoutHeaderActionsComponent } from '../../../../shared/ui/popout-header-actions/popout-header-actions.component';
import { PopoutPanelComponent } from '../../../../shared/ui/popout-panel/popout-panel.component';
import { WidgetCardComponent } from '../../../../shared/ui/widget-card/widget-card.component';
import { createWidgetLoader } from '../../../../shared/ui/widget-card/widget-loader';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeActivityItem, EmployeeRecentActivityResponse } from '../../models/employee-overview.model';
import { formatActivityWhen } from '../../utils/employee-overview.utils';

/** Rows on the compact card; the page load asks the API for only these. */
export const ACTIVITY_PREVIEW_LIMIT = 3;
/** Page size for everything after the preview, fetched only once the card is popped out. */
const PAGE_SIZE = 20;

/**
 * What the employee did, newest first. Lifetime (not period-aware) and partial by design: the API
 * builds it from existing tables, so some actions are not recorded - the widget says so.
 * The page load fetches only the newest three. Clicking the card (or View all) pops it out in place
 * and continues from the preview's cursor - the first three are never fetched twice - with
 * "Load older activity" paging further inside the popup.
 */
@Component({
  selector: 'app-overview-recent-activity-widget',
  standalone: true,
  imports: [WidgetCardComponent, PopoutPanelComponent, PopoutHeaderActionsComponent],
  template: `
    <app-popout-panel class="block h-full" [open]="showAll()" label="Recent Activity" (closed)="showAll.set(false)">
    <app-widget-card
      class="group"
      title="Recent Activity"
      [class.cursor-pointer]="canExpand() && !showAll()"
      [state]="loader.state()"
      errorMessage="Could not load recent activity."
      emptyMessage="No recorded activity yet."
      (retry)="loader.reload()"
      (click)="expand()"
    >
      @if (loader.data(); as summary) {
        <div widget-actions class="flex items-center gap-2">
          <span data-testid="activity-count" class="rounded-full bg-[var(--color-surface-secondary)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-text-secondary)]">
            {{ items().length }}{{ hasMore() ? '+' : '' }} {{ items().length === 1 && !hasMore() ? 'update' : 'updates' }}
          </span>
          <app-popout-header-actions
            [refreshedAt]="loader.loadedAt()"
            [refreshing]="loader.refreshing() || loadingOlder()"
            [expanded]="showAll()"
            [canExpand]="canExpand()"
            [revealOnHover]="!showAll()"
            (refresh)="refreshAll()"
            (expand)="expand()"
            (closed)="showAll.set(false)"
          />
        </div>
      }
      @if (loader.data(); as d) {
        <ul class="space-y-0" data-testid="activity-timeline" aria-label="Recent employee activity">
          @for (item of displayedItems(); track item.id; let last = $last) {
            <li class="relative grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-start gap-3 pb-5 text-sm last:pb-1" data-testid="activity-item">
              <div
                data-testid="activity-marker"
                class="relative z-10 flex h-9 w-9 items-center justify-center rounded-xl ring-4 ring-[var(--color-surface)]"
                [class]="'relative z-10 flex h-9 w-9 items-center justify-center rounded-xl ring-4 ring-[var(--color-surface)] ' + activityTone(item.kind)"
              >
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M5 12l4 4L19 6"></path>
                </svg>
              </div>
              @if (!last) {
                <span class="absolute bottom-0 left-[17px] top-9 w-px bg-[var(--color-border)]" aria-hidden="true"></span>
              }

              <div class="min-w-0 pt-1">
                <p class="leading-5 text-[var(--color-text-primary)]">
                  <span class="font-semibold text-[var(--color-text-primary)]">{{ item.action }}</span>
                  @if (item.target) { <span class="font-medium"> {{ item.target }}</span> }
                </p>
                @if (item.detail) {
                  <p class="mt-1 inline-flex rounded-md bg-[var(--color-surface-secondary)] px-2 py-1 text-xs text-[var(--color-text-secondary)]">{{ item.detail }}</p>
                }
              </div>
              <time class="mt-1 shrink-0 self-start rounded-full bg-[var(--color-surface-secondary)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-text-secondary)]">{{ when(item) }}</time>
            </li>
          }
        </ul>

        @if (olderError()) {
          <p class="mt-2 text-xs text-[var(--color-danger-text)]" role="alert" data-testid="older-error">Could not load older activity. Try again.</p>
        }

        @if (showAll() && hasMore()) {
          <div class="mt-2 flex justify-center border-t border-[var(--color-border)] pt-4">
            <button
              type="button"
              class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-xs font-semibold text-[var(--color-accent)] shadow-xs transition-colors hover:bg-[var(--color-accent-subtle)] disabled:cursor-not-allowed disabled:opacity-60"
              data-testid="load-older"
              [disabled]="loadingOlder()"
              (click)="onLoadOlderClick($event)"
            >
              {{ loadingOlder() ? 'Loading…' : 'Load older activity' }}
            </button>
          </div>
        }

        @if (d.isPartial) {
          <p class="mt-4 rounded-lg border border-[var(--color-accent-subtle)] bg-[var(--color-accent-subtle)]/60 px-3 py-2 text-xs text-[var(--color-accent)]" data-testid="partial-note">
            Showing key activity — some actions are not recorded yet.
          </p>
        }

        @if (canExpand()) {
          <div class="mt-3 flex justify-end border-t border-[var(--color-border)] pt-3">
            <button
              type="button"
              class="text-xs font-semibold text-[var(--color-accent)] hover:text-[var(--color-accent)] hover:underline cursor-pointer"
              data-testid="activity-toggle"
              [attr.aria-expanded]="showAll()"
              (click)="onToggleClick($event)"
            >
              {{ showAll() ? 'Show less' : 'View all' }}
            </button>
          </div>
        }
      }
    </app-widget-card>
    </app-popout-panel>
  `,
  host: { class: 'block h-full' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OverviewRecentActivityWidgetComponent {
  private readonly api = inject(PeopleApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly employeeId = input.required<string>();

  readonly loader = createWidgetLoader(
    () => this.api.getOverviewRecentActivity(this.employeeId(), null, ACTIVITY_PREVIEW_LIMIT),
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

  constructor() {
    // After a popup refresh lands, page past the preview again.
    effect(() => {
      const first = this.loader.data();
      untracked(() => {
        if (!first || !this.refillAfterRefresh) return;
        this.refillAfterRefresh = false;
        if (this.showAll() && this.hasMore()) this.loadOlder();
      });
    });
  }

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
    // The API leaves out a null cursor, so a missing one also means "no older page".
    return (paging ? paging.cursor : first.nextBefore) ?? null;
  });
  readonly hasMore = computed(() => this.cursor() !== null);

  readonly showAll = signal(false);
  private refillAfterRefresh = false;
  /** More than the compact card shows - either already loaded or still on the server. */
  readonly canExpand = computed(() => this.items().length > ACTIVITY_PREVIEW_LIMIT || this.hasMore());
  readonly displayedItems = computed(() =>
    this.showAll() ? this.items() : this.items().slice(0, ACTIVITY_PREVIEW_LIMIT)
  );

  /** A click anywhere on the card pops it out; the first pop-out fetches the next page once. */
  expand(): void {
    if (this.showAll() || !this.canExpand()) return;
    this.showAll.set(true);
    if (this.items().length <= ACTIVITY_PREVIEW_LIMIT && this.hasMore()) this.loadOlder();
  }

  onToggleClick(event: Event): void {
    event.stopPropagation();
    if (this.showAll()) this.showAll.set(false);
    else this.expand();
  }

  /**
   * Popup refresh: refetches the newest page (the current list stays until it lands), then the next
   * page again so the popup keeps showing more than the preview.
   */
  refreshAll(): void {
    this.refillAfterRefresh = true;
    this.loader.refresh();
  }

  onLoadOlderClick(event: Event): void {
    event.stopPropagation();
    this.loadOlder();
  }

  when(item: EmployeeActivityItem): string {
    return formatActivityWhen(item.at, this.now);
  }

  activityTone(kind: string): string {
    if (kind.startsWith('attendance_')) return 'bg-[var(--color-success-subtle)] text-[var(--color-success)]';
    if (kind.startsWith('leave_')) return 'bg-[var(--color-cat-violet-subtle)] text-[var(--color-cat-violet)]';
    if (kind.startsWith('task_')) return 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)]';
    return 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]';
  }

  loadOlder(): void {
    const first = this.loader.data();
    const before = this.cursor();
    if (!first || before == null || this.loadingOlder()) return;

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
