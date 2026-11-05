import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { EmployeeSignalItem, EmployeeSignalItemsResponse } from '../../models/employee-overview.model';
import { formatEventTime, formatShortDate } from '../../utils/employee-overview.utils';
import { approvalReviewUrl } from '../../utils/signal-item-links';

interface TaskGroup { readonly projectName: string; readonly items: readonly EmployeeSignalItem[]; }

/** Presents the concrete items behind one Needs Attention signal. */
@Component({
  selector: 'app-signal-items-list',
  standalone: true,
  template: `
    <div class="mt-2 rounded-xl border border-[var(--color-warning-subtle)]/70 bg-[var(--color-surface)]/70 p-2" data-testid="signal-items">
      @if (loading()) {
        @for (i of [0, 1, 2]; track i) {
          <div data-testid="signal-items-skeleton" class="my-1 h-7 animate-pulse rounded bg-[var(--color-surface-secondary)]"></div>
        }
      } @else if (error()) {
        <div class="flex items-center justify-between gap-2 px-2 py-1.5 text-xs text-[var(--color-text-secondary)]" role="alert">
          <span>Could not load these items.</span>
          <button type="button" data-testid="signal-items-retry" class="font-semibold text-[var(--color-accent)] hover:underline" (click)="retry.emit()">Retry</button>
        </div>
      } @else if (response(); as r) {
        @if (isTasks()) {
          @for (group of taskGroups(); track group.projectName) {
            <div data-testid="signal-task-group" class="py-1">
              <p data-testid="signal-task-group-name" class="px-2 text-[11px] font-bold text-[var(--color-text-primary)]">{{ group.projectName }} ({{ group.items.length }})</p>
              @for (item of group.items; track item.id) {
                <button type="button" data-testid="signal-item" class="item-row" (click)="itemSelected.emit(item)">
                  <span class="truncate">{{ item.title }}</span>
                  <span class="flex shrink-0 items-center gap-1.5 text-[var(--color-text-muted)]">
                    @if (item.carriedOver) {
                      <span data-testid="signal-item-carried-over"
                            class="rounded bg-[var(--color-warning-subtle)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-warning-text)]">{{ carriedOverLabel(item) }}</span>
                    }
                    due {{ short(item.dueDate) }} ›
                  </span>
                </button>
              }
            </div>
          }
        } @else {
          @for (item of r.items; track item.kind + item.id) {
            <button type="button" data-testid="signal-item" class="item-row" (click)="onItemClick(item)"
                    [attr.aria-expanded]="item.kind === 'approval' ? openApprovalId() === item.id : null">
              <span class="min-w-0 truncate">
                <span class="font-semibold text-[var(--color-text-primary)]">{{ item.title }}</span>
                @if (item.occurredAt) { <span class="text-[var(--color-text-muted)]"> · {{ time(item.occurredAt, r.timezone) }}</span> }
                @if (item.subtitle) { <span class="text-[var(--color-text-secondary)]"> · {{ item.subtitle }}</span> }
              </span>
              <span class="shrink-0 text-[var(--color-text-muted)]">{{ item.kind === 'approval' ? (openApprovalId() === item.id ? '▾' : '▸') : '›' }}</span>
            </button>
            @if (item.kind === 'approval' && openApprovalId() === item.id) {
              <div class="mx-2 mb-2 rounded-lg bg-[var(--color-surface-secondary)] p-2 text-[11px] text-[var(--color-text-secondary)]" data-testid="approval-detail">
                @if (item.requestedAt) { <p>Requested {{ short(item.requestedAt) }}</p> }
                @if (item.approverName) { <p>Waiting on {{ item.approverName }}</p> }
                <a data-testid="approval-review-link" class="mt-1 inline-block font-semibold text-[var(--color-accent)] hover:underline"
                   [href]="reviewUrl(item)" (click)="navigate($event, reviewUrl(item))">Review in approvals →</a>
              </div>
            }
          }
        }
        @if (r.total > r.items.length && fullListUrl(); as url) {
          <a data-testid="signal-items-more" class="block px-2 py-1.5 text-[11px] font-semibold text-[var(--color-accent)] hover:underline"
             [href]="url" (click)="navigate($event, url)">+{{ r.total - r.items.length }} more · open full list</a>
        }
      }
    </div>
  `,
  styles: [`
    .item-row { display: flex; width: 100%; align-items: center; justify-content: space-between; gap: 0.5rem;
      border-radius: 0.5rem; padding: 0.375rem 0.5rem; text-align: left; font-size: 11px; cursor: pointer; }
    .item-row:hover { background: var(--color-surface-secondary); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SignalItemsListComponent {
  private readonly router = inject(Router);

  readonly response = input<EmployeeSignalItemsResponse | null>(null);
  readonly loading = input(false);
  readonly error = input(false);
  readonly fullListUrl = input<string | null>(null);
  readonly itemSelected = output<EmployeeSignalItem>();
  readonly retry = output<void>();

  readonly openApprovalId = signal<string | null>(null);
  readonly isTasks = computed(() => this.response()?.items[0]?.kind === 'task');
  readonly taskGroups = computed<readonly TaskGroup[]>(() => {
    const groups = new Map<string, EmployeeSignalItem[]>();
    for (const item of this.response()?.items ?? []) {
      const name = item.projectName ?? 'No project';
      groups.set(name, [...(groups.get(name) ?? []), item]);
    }
    return [...groups.entries()].map(([projectName, items]) => ({ projectName, items }));
  });

  readonly reviewUrl = approvalReviewUrl;

  onItemClick(item: EmployeeSignalItem): void {
    if (item.kind === 'approval') {
      this.openApprovalId.update((id) => (id === item.id ? null : item.id));
      return;
    }
    this.itemSelected.emit(item);
  }

  /** "Carried over from Sep · 11 days late" - the month comes from the task's own due date. */
  carriedOverLabel(item: EmployeeSignalItem): string {
    const month = item.dueDate
      ? new Date(`${item.dueDate.slice(0, 10)}T00:00:00Z`).toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
      : null;
    const days = item.daysOverdue ?? 0;
    const late = days > 0 ? ` · ${days} ${days === 1 ? 'day' : 'days'} late` : '';
    return `Carried over${month ? ` from ${month}` : ''}${late}`;
  }

  short(iso: string | null): string {
    return iso ? formatShortDate(iso.slice(0, 10)) : '';
  }

  time(iso: string, timeZone: string | null): string {
    return formatEventTime(iso, timeZone ?? undefined);
  }

  navigate(event: MouseEvent, url: string): void {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    void this.router.navigateByUrl(url);
  }
}
