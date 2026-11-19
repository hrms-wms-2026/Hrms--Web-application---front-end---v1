import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { PopoutHeaderActionsComponent, latestDate } from '../../../../shared/ui/popout-header-actions/popout-header-actions.component';
import { PopoutPanelComponent } from '../../../../shared/ui/popout-panel/popout-panel.component';
import { createWidgetLoader } from '../../../../shared/ui/widget-card/widget-loader';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeUpcomingItem, EmployeeUpcomingKind } from '../../models/employee-overview.model';
import { UpcomingDateBlock, upcomingDateBlock } from '../../utils/employee-overview.utils';
import { UpcomingItemDetailComponent } from '../upcoming-item-detail/upcoming-item-detail.component';
import { KeyboardClickDirective } from '../../../../shared/directives/keyboard-click.directive';

const UPCOMING_DAYS = 14;
/** Rows on the compact card; the page load asks the API for only these (plus the window's total). */
export const UPCOMING_PREVIEW_LIMIT = 4;
/** The API's maximum; asked for once, when the card is popped out. */
export const UPCOMING_FULL_LIMIT = 50;

const KIND_LABELS: Record<EmployeeUpcomingKind, string> = {
  calendar: 'Calendar event',
  leave: 'Approved leave',
  release: 'Release'
};

type FullListState = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Forward-looking: not period-aware, so it never refetches when the month changes. The page load
 * fetches only the first four items and the 14-day total. Clicking the card (or View all) pops it
 * out in place and fetches the full list once; reopening reuses it. Each row opens a detail popup
 * from data already loaded - no request per item.
 */
@Component({
  selector: 'app-overview-upcoming-widget',
  standalone: true,
  imports: [KeyboardClickDirective, ErrorStateComponent, PopoutPanelComponent, PopoutHeaderActionsComponent, UpcomingItemDetailComponent],
  template: `
    <app-popout-panel class="block h-full" [open]="showAll()" label="Upcoming" (closed)="showAll.set(false)">
      <section role="button" tabindex="0" appKeyboardClick
        data-testid="upcoming-card"
        class="group flex h-full flex-col rounded-2xl border border-[var(--color-border)]/80 bg-[var(--color-surface)] p-5 shadow-xs"
        [class.cursor-pointer]="canExpand() && !showAll()"
        [attr.aria-busy]="loader.state() === 'loading'"
        (click)="expand()"
      >
        <header class="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <h2 class="text-base font-bold text-[var(--color-text-primary)]">Upcoming</h2>
          <div class="flex min-w-0 flex-wrap items-center justify-end gap-2">
            <span class="shrink-0 rounded-full bg-[var(--color-accent-subtle)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-accent)]">Next 14 days</span>
            <app-popout-header-actions
              [refreshedAt]="refreshedAt()"
              [refreshing]="refreshing()"
              [expanded]="showAll()"
              [canExpand]="canExpand()"
              [revealOnHover]="!showAll()"
              (refresh)="refreshAll()"
              (expand)="expand()"
              (closed)="showAll.set(false)"
            />
          </div>
        </header>

        @switch (loader.state()) {
          @case ('loading') {
            <div data-testid="widget-loading" class="flex-1 animate-pulse space-y-4" aria-hidden="true">
              @for (i of [0, 1, 2]; track i) {
                <div class="flex items-center gap-3">
                  <div class="h-10 w-10 rounded-xl bg-[var(--color-surface-secondary)]"></div>
                  <div class="flex-1 space-y-2">
                    <div class="h-3 w-2/3 rounded bg-[var(--color-surface-secondary)]"></div>
                    <div class="h-3 w-1/2 rounded bg-[var(--color-surface-secondary)]"></div>
                  </div>
                </div>
              }
            </div>
          }
          @case ('error') {
            <app-error-state message="Could not load upcoming items." [retryable]="true" (retry)="loader.reload()" />
          }
          @case ('forbidden') {
            <p data-testid="widget-forbidden" class="text-sm text-[var(--color-text-secondary)]">You do not have access to this section.</p>
          }
          @case ('empty') {
            <div class="flex flex-1 flex-col items-center justify-center py-6 text-center" data-testid="widget-empty">
              <div class="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] text-[var(--color-text-muted)]">
                <svg class="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="16" rx="2"></rect>
                  <path d="M16 3v4M8 3v4M3 10h18"></path>
                  <path d="M8 15h3M8 18h6"></path>
                </svg>
              </div>
              <p class="max-w-52 text-xs leading-5 text-[var(--color-text-secondary)]">Nothing coming up in the next 14 days.</p>
            </div>
          }
          @default {
            <ul class="divide-y divide-[var(--color-border)]">
              @for (item of displayedItems(); track $index) {
                @let when = block(item);
                <li>
                  <button
                    type="button"
                    class="flex w-full items-center gap-3 rounded-lg py-1.5 text-left text-sm transition-colors hover:bg-[var(--color-surface-secondary)] cursor-pointer"
                    data-testid="upcoming-item"
                    [title]="kindLabel(item.kind)"
                    [attr.aria-label]="'Open details for ' + item.title"
                    (click)="openItem($event, item)"
                  >
                    <div
                      data-testid="upcoming-date"
                      class="date-tile"
                      [class]="'date-tile date-tile--' + item.kind"
                      [attr.aria-label]="when.month + ' ' + when.day"
                    >
                      <span class="text-[9px] font-semibold leading-none tracking-wide">{{ when.month }}</span>
                      <span class="mt-0.5 text-sm font-bold leading-none">{{ when.day }}</span>
                    </div>
                    <div class="min-w-0 flex-1">
                      <p class="truncate font-semibold text-[var(--color-text-primary)]">{{ item.title }}</p>
                      <p class="truncate text-xs text-[var(--color-text-secondary)]" data-testid="upcoming-time">
                        {{ when.time }}@if (item.detail && item.kind !== 'leave') { · {{ item.detail }} }
                      </p>
                    </div>
                    <svg class="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" data-testid="upcoming-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </button>
                </li>
              }
            </ul>

            @if (showAll() && fullState() === 'loading') {
              <p class="py-2 text-center text-xs text-[var(--color-text-secondary)]" data-testid="upcoming-full-loading">Loading the rest…</p>
            }
            @if (showAll() && fullState() === 'error') {
              <p class="py-2 text-center text-xs text-[var(--color-danger)]" data-testid="upcoming-full-error">
                Could not load the rest.
                <button type="button" class="font-semibold underline cursor-pointer" (click)="retryFull($event)">Retry</button>
              </p>
            }

            @if (canExpand()) {
              <div class="mt-auto flex justify-end border-t border-[var(--color-border)] pt-2">
                <button
                  type="button"
                  class="text-xs font-semibold text-[var(--color-accent)] hover:text-[var(--color-accent)] hover:underline cursor-pointer"
                  data-testid="upcoming-toggle"
                  [attr.aria-expanded]="showAll()"
                  (click)="onToggleClick($event)"
                >
                  {{ showAll() ? 'Show less' : 'View all (' + total() + ')' }}
                </button>
              </div>
            }
          }
        }
      </section>
    </app-popout-panel>

    <app-upcoming-item-detail [item]="selected()" (closed)="selected.set(null)" />
  `,
  styles: [`
    .date-tile {
      display: flex; flex-shrink: 0; flex-direction: column; align-items: center; justify-content: center;
      width: 2.25rem; height: 2.25rem; border-radius: 0.625rem; background: var(--color-surface-secondary); color: var(--color-text-primary);
    }
    .date-tile > span:first-child { color: var(--color-text-secondary); }
    .date-tile--leave { background: var(--color-success-subtle); }
    .date-tile--leave > span:first-child { color: var(--color-success-text); }
    .date-tile--release { background: var(--color-cat-violet-subtle); }
    .date-tile--release > span:first-child { color: var(--color-cat-violet); }
  `],
  host: { class: 'block h-full' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OverviewUpcomingWidgetComponent {
  private readonly api = inject(PeopleApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly employeeId = input.required<string>();
  /** The item whose detail popup is open, or null. */
  readonly selected = signal<EmployeeUpcomingItem | null>(null);
  readonly showAll = signal(false);

  readonly loader = createWidgetLoader(
    () => this.api.getOverviewUpcoming(this.employeeId(), UPCOMING_DAYS, UPCOMING_PREVIEW_LIMIT),
    { isEmpty: (v) => v.items.length === 0 }
  );

  readonly fullItems = signal<readonly EmployeeUpcomingItem[] | null>(null);
  readonly fullState = signal<FullListState>('idle');
  private readonly fullLoadedAt = signal<Date | null>(null);
  private readonly fullRefreshing = signal(false);
  /** When the shown data last came from the backend (preview or full list, whichever is newer). */
  readonly refreshedAt = computed(() => latestDate(this.loader.loadedAt(), this.fullLoadedAt()));
  readonly refreshing = computed(() => this.loader.refreshing() || this.fullRefreshing());

  /** Falls back to the item count if the API sent no total (e.g. an older backend that ignores `limit`). */
  readonly total = computed(() => {
    const data = this.loader.data();
    return data ? Math.max(data.total ?? 0, data.items.length) : 0;
  });
  readonly canExpand = computed(() => this.total() > UPCOMING_PREVIEW_LIMIT);
  /** The compact card never shows more than the preview, whatever the API returned. */
  readonly displayedItems = computed(() => {
    const preview = this.loader.data()?.items ?? [];
    return this.showAll() ? this.fullItems() ?? preview : preview.slice(0, UPCOMING_PREVIEW_LIMIT);
  });

  constructor() {
    // A different employee means a different full list.
    effect(() => {
      this.employeeId();
      untracked(() => {
        this.fullItems.set(null);
        this.fullState.set('idle');
        this.showAll.set(false);
      });
    });
  }

  /** A click anywhere on the card pops it out - only when there is more than the preview to show. */
  expand(): void {
    if (this.showAll() || !this.canExpand()) return;
    this.showAll.set(true);
    if (this.fullItems() === null && this.fullState() !== 'loading') this.loadFull();
  }

  onToggleClick(event: Event): void {
    event.stopPropagation();
    if (this.showAll()) this.showAll.set(false);
    else this.expand();
  }

  openItem(event: Event, item: EmployeeUpcomingItem): void {
    event.stopPropagation();
    this.selected.set(item);
  }

  retryFull(event: Event): void {
    event.stopPropagation();
    this.loadFull();
  }

  /** Popup refresh: the preview and the full list again, keeping both on screen until the new data lands. */
  refreshAll(): void {
    this.loader.refresh();
    // The full list is only refetched if it has been loaded (i.e. the popup was opened).
    if (this.fullItems() !== null) this.loadFull();
  }

  private loadFull(): void {
    const id = this.employeeId();
    // With the full list already showing, refetch quietly; the header's refresh icon spins instead.
    if (this.fullItems() === null) this.fullState.set('loading');
    else this.fullRefreshing.set(true);
    this.api
      .getOverviewUpcoming(id, UPCOMING_DAYS, UPCOMING_FULL_LIMIT)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (id !== this.employeeId()) return;
          this.fullItems.set(response.items);
          this.fullState.set('ready');
          this.fullLoadedAt.set(new Date());
          this.fullRefreshing.set(false);
        },
        error: () => {
          this.fullRefreshing.set(false);
          if (id === this.employeeId() && this.fullItems() === null) this.fullState.set('error');
        }
      });
  }

  block(item: EmployeeUpcomingItem): UpcomingDateBlock {
    return upcomingDateBlock(item);
  }

  kindLabel(kind: EmployeeUpcomingKind): string {
    return KIND_LABELS[kind];
  }
}
