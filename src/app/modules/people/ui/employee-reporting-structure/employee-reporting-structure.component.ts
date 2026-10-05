import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { PopoutHeaderActionsComponent } from '../../../../shared/ui/popout-header-actions/popout-header-actions.component';
import { EmployeeDirectoryStore } from '../../../work/state/employee-directory.store';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeListItemResponse } from '../../models/employee.model';
import { EmployeeReportingHierarchyModalComponent } from './employee-reporting-hierarchy-modal.component';

/** The card only needs the direct-report count, so the page load asks for a single row. */
export const REPORTS_COUNT_PAGE_SIZE = 1;

type ReportsState = 'loading' | 'ready' | 'forbidden' | 'error';

/**
 * Reporting Structure: the manager, this employee, and how many people report to them. Clicking
 * the card opens the full reporting structure (positions above up to the top, and everything
 * below), drawn like Org → Positions. The direct-report count comes from the visibility-scoped
 * employee list, so it counts the reports the viewer can see; without access to that list the
 * reports row is left out.
 */
@Component({
  selector: 'app-employee-reporting-structure',
  standalone: true,
  imports: [AvatarComponent, PopoutHeaderActionsComponent, EmployeeReportingHierarchyModalComponent],
  template: `
    <section
      data-testid="reporting-structure-card"
      class="group flex h-full flex-col rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs"
      [class.cursor-pointer]="canOpen()"
      (click)="openHierarchy()"
    >
      <header class="mb-3 flex items-start justify-between gap-3">
        <div class="flex items-center gap-2.5">
          <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600" aria-hidden="true">
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="3" width="6" height="5" rx="1"></rect>
              <rect x="3" y="16" width="6" height="5" rx="1"></rect>
              <rect x="15" y="16" width="6" height="5" rx="1"></rect>
              <path d="M12 8v4M6 16v-2h12v2"></path>
            </svg>
          </span>
          <div>
            <h2 class="text-sm font-bold text-slate-900">Reporting Structure</h2>
            <p class="text-[11px] text-slate-500">Position in the organization</p>
          </div>
        </div>
        <app-popout-header-actions
          [refreshedAt]="loadedAt()"
          [refreshing]="refreshing()"
          [expanded]="false"
          [canExpand]="canOpen()"
          [revealOnHover]="true"
          (refresh)="loadCount(employeeId(), true)"
          (expand)="openHierarchy()"
        />
      </header>

      <ol class="relative flex-1 space-y-1.5">
        <span class="absolute left-[0.6875rem] top-6 bottom-6 w-px bg-slate-200" aria-hidden="true"></span>

        <li class="flex items-center gap-3" data-testid="reporting-manager">
          <span class="relative z-[1] ml-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-600 ring-4 ring-white"></span>
          <div class="flex min-w-0 flex-1 items-center gap-3 rounded-lg bg-slate-50 px-2.5 py-1.5">
            @if (managerName()) {
              <app-avatar size="sm" [avatarUrl]="managerAvatar()" [userName]="managerName()" />
              <div class="min-w-0 flex-1">
                <p class="truncate text-[13px] font-semibold text-slate-900">{{ managerName() }}</p>
                <p class="truncate text-[11px] text-slate-500">Reporting Manager</p>
              </div>
              <span class="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">Manager</span>
            } @else {
              <p class="py-1 text-[13px] text-slate-500">No reporting manager assigned</p>
            }
          </div>
        </li>

        <li class="flex items-center gap-3" data-testid="reporting-self">
          <span class="relative z-[1] ml-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-600 ring-4 ring-white"></span>
          <div class="flex min-w-0 flex-1 items-center gap-3 rounded-lg border border-blue-100 bg-blue-50/70 px-2.5 py-1.5">
            <app-avatar size="sm" [avatarUrl]="selfAvatar()" [userName]="employeeName()" />
            <div class="min-w-0 flex-1">
              <p class="truncate text-[13px] font-semibold text-slate-900">{{ employeeName() }}</p>
              <p class="truncate text-[11px] text-slate-500">
                {{ positionName() || 'Unassigned' }}@if (departmentName()) { · {{ departmentName() }} }
              </p>
            </div>
            <span class="shrink-0 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white">This employee</span>
          </div>
        </li>

        @if (reportsState() !== 'forbidden') {
          <li class="flex items-center gap-3" data-testid="reporting-direct-reports">
            <span class="relative z-[1] ml-1.5 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-blue-600 bg-white ring-4 ring-white"></span>
            <div class="flex min-w-0 flex-1 items-center gap-3 rounded-lg bg-slate-50 px-2.5 py-1.5">
              <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-blue-600 ring-1 ring-slate-200" aria-hidden="true">
                <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="9" cy="8" r="3"></circle><path d="M3 20a6 6 0 0 1 12 0"></path>
                  <circle cx="17" cy="9" r="2.5"></circle><path d="M16 14.5a5 5 0 0 1 5 5"></path>
                </svg>
              </span>
              <div class="min-w-0 flex-1">
                <p class="text-[13px] font-semibold text-slate-900">{{ reportsLabel() }}</p>
                <p class="text-[11px] text-slate-500">
                  @switch (reportsState()) {
                    @case ('loading') { Loading… }
                    @case ('error') {
                      Could not load.
                      <button type="button" class="font-semibold text-blue-600 underline cursor-pointer" (click)="retry($event)">Retry</button>
                    }
                    @default { {{ total() === 0 ? 'No direct reports' : 'View team members' }} }
                  }
                </p>
              </div>
              @if (canOpen()) {
                <svg class="h-4 w-4 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              }
            </div>
          </li>
        }
      </ol>

      @if (canOpen()) {
        <div class="mt-2 flex justify-end border-t border-slate-100 pt-2">
          <button
            type="button"
            class="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
            data-testid="reporting-open-hierarchy"
            (click)="onOpenClick($event)"
          >
            View full structure
          </button>
        </div>
      }
    </section>

    <app-employee-reporting-hierarchy-modal
      [open]="hierarchyOpen()"
      [legalEntityId]="legalEntityId()"
      [positionId]="positionId()"
      [employeeName]="employeeName()"
      (closed)="hierarchyOpen.set(false)"
    />
  `,
  host: { class: 'block h-full' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeReportingStructureComponent {
  private readonly api = inject(PeopleApiService);
  private readonly directory = inject(EmployeeDirectoryStore);
  private readonly destroyRef = inject(DestroyRef);

  readonly employeeId = input.required<string>();
  readonly employeeName = input.required<string>();
  readonly legalEntityId = input<string | null>(null);
  readonly positionId = input<string | null>(null);
  readonly positionName = input<string | null>(null);
  readonly departmentName = input<string | null>(null);
  readonly managerId = input<string | null>(null);
  readonly managerName = input<string | null>(null);

  readonly hierarchyOpen = signal(false);
  readonly reportsState = signal<ReportsState>('loading');
  readonly total = signal(0);
  readonly loadedAt = signal<Date | null>(null);
  readonly refreshing = signal(false);

  /** The full structure needs the employee's position; without one there is nothing to draw. */
  readonly canOpen = computed(() => !!this.positionId() && !!this.legalEntityId());
  readonly reportsLabel = computed(() =>
    this.reportsState() === 'ready' ? `Direct Reports (${this.total()})` : 'Direct Reports'
  );

  readonly managerAvatar = computed(() => {
    const id = this.managerId();
    return id ? this.directory.get(id)?.avatarUrl ?? null : null;
  });
  readonly selfAvatar = computed(() => this.directory.get(this.employeeId())?.avatarUrl ?? null);

  constructor() {
    effect(() => {
      const id = this.managerId();
      if (id) untracked(() => void this.directory.ensureLoaded([id]));
    });
    effect(() => {
      const id = this.employeeId();
      untracked(() => {
        this.hierarchyOpen.set(false);
        this.loadCount(id);
      });
    });
  }

  openHierarchy(): void {
    if (this.canOpen()) this.hierarchyOpen.set(true);
  }

  onOpenClick(event: Event): void {
    event.stopPropagation();
    this.openHierarchy();
  }

  retry(event: Event): void {
    event.stopPropagation();
    this.loadCount(this.employeeId());
  }

  loadCount(id: string, quiet = false): void {
    if (quiet) this.refreshing.set(true);
    else this.reportsState.set('loading');
    this.api
      .listEmployees({ managerId: id, page: 1, pageSize: REPORTS_COUNT_PAGE_SIZE })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.refreshing.set(false);
          if (id !== this.employeeId()) return;
          this.seedDirectory(page.items);
          this.total.set(Math.max(page.totalCount, page.items.length));
          this.loadedAt.set(new Date());
          this.reportsState.set('ready');
        },
        error: (err: unknown) => {
          this.refreshing.set(false);
          if (id !== this.employeeId() || quiet) return;
          this.reportsState.set(err instanceof HttpErrorResponse && err.status === 403 ? 'forbidden' : 'error');
        }
      });
  }

  /** The list already carries name + avatar, so no identity request for those employees. */
  private seedDirectory(items: readonly EmployeeListItemResponse[]): void {
    this.directory.seed(items.map((e) => ({ id: e.id, name: e.fullName, avatarFileId: e.avatarFileId ?? null })));
  }
}
