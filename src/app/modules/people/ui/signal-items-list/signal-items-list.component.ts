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
    <div class="mt-2 rounded-xl border border-amber-200/70 bg-white/70 p-2" data-testid="signal-items">
      @if (loading()) {
        @for (i of [0, 1, 2]; track i) {
          <div data-testid="signal-items-skeleton" class="my-1 h-7 animate-pulse rounded bg-slate-100"></div>
        }
      } @else if (error()) {
        <div class="flex items-center justify-between gap-2 px-2 py-1.5 text-xs text-slate-600" role="alert">
          <span>Could not load these items.</span>
          <button type="button" data-testid="signal-items-retry" class="font-semibold text-blue-600 hover:underline" (click)="retry.emit()">Retry</button>
        </div>
      } @else if (response(); as r) {
        @if (isTasks()) {
          @for (group of taskGroups(); track group.projectName) {
            <div data-testid="signal-task-group" class="py-1">
              <p data-testid="signal-task-group-name" class="px-2 text-[11px] font-bold text-slate-700">{{ group.projectName }} ({{ group.items.length }})</p>
              @for (item of group.items; track item.id) {
                <button type="button" data-testid="signal-item" class="item-row" (click)="itemSelected.emit(item)">
                  <span class="truncate">{{ item.title }}</span>
                  <span class="shrink-0 text-slate-400">due {{ short(item.dueDate) }} ›</span>
                </button>
              }
            </div>
          }
        } @else {
          @for (item of r.items; track item.kind + item.id) {
            <button type="button" data-testid="signal-item" class="item-row" (click)="onItemClick(item)"
                    [attr.aria-expanded]="item.kind === 'approval' ? openApprovalId() === item.id : null">
              <span class="min-w-0 truncate">
                <span class="font-semibold text-slate-800">{{ item.title }}</span>
                @if (item.occurredAt) { <span class="text-slate-400"> · {{ time(item.occurredAt, r.timezone) }}</span> }
                @if (item.subtitle) { <span class="text-slate-500"> · {{ item.subtitle }}</span> }
              </span>
              <span class="shrink-0 text-slate-400">{{ item.kind === 'approval' ? (openApprovalId() === item.id ? '▾' : '▸') : '›' }}</span>
            </button>
            @if (item.kind === 'approval' && openApprovalId() === item.id) {
              <div class="mx-2 mb-2 rounded-lg bg-slate-50 p-2 text-[11px] text-slate-600" data-testid="approval-detail">
                @if (item.requestedAt) { <p>Requested {{ short(item.requestedAt) }}</p> }
                @if (item.approverName) { <p>Waiting on {{ item.approverName }}</p> }
                <a data-testid="approval-review-link" class="mt-1 inline-block font-semibold text-blue-600 hover:underline"
                   [href]="reviewUrl(item)" (click)="navigate($event, reviewUrl(item))">Review in approvals →</a>
              </div>
            }
          }
        }
        @if (r.total > r.items.length && fullListUrl(); as url) {
          <a data-testid="signal-items-more" class="block px-2 py-1.5 text-[11px] font-semibold text-blue-600 hover:underline"
             [href]="url" (click)="navigate($event, url)">+{{ r.total - r.items.length }} more · open full list</a>
        }
      }
    </div>
  `,
  styles: [`
    .item-row { display: flex; width: 100%; align-items: center; justify-content: space-between; gap: 0.5rem;
      border-radius: 0.5rem; padding: 0.375rem 0.5rem; text-align: left; font-size: 11px; cursor: pointer; }
    .item-row:hover { background: rgb(248 250 252); }
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
