import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { PopoutHeaderActionsComponent } from '../../../../shared/ui/popout-header-actions/popout-header-actions.component';
import { WidgetState } from '../../../../shared/ui/widget-card/widget-card.component';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeDetailResponse, UpdateEmployeeJobDetailsRequest } from '../../models/employee.model';
import { PositionHistoryEntryResponse } from '../../models/position-history.model';
import { EmployeeWorkGraphResponse, WorkGraphNode } from '../../models/work-graph.model';
import { EmployeeJobInfoComponent } from '../../ui/employee-job-info/employee-job-info.component';
import { EmployeeJobJourneyComponent, formatJourneyDate } from '../../ui/employee-job-journey/employee-job-journey.component';
import { EmployeeReportingStructureComponent } from '../../ui/employee-reporting-structure/employee-reporting-structure.component';
import { WorkNetworkGraphComponent } from '../../ui/work-network-graph/work-network-graph.component';

type KpiTone = 'blue' | 'green' | 'violet' | 'orange' | 'sky';

interface EmploymentKpi {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
  readonly tone: KpiTone;
}

/** Whole years and months between two dates (calendar months, not 30-day blocks). */
function monthsBetween(from: Date, to: Date): number {
  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) months -= 1;
  return Math.max(0, months);
}

function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
}

/** '3y 8m', '8m', or 'New joiner' - compact for the KPI tile (the header keeps formatTenure). */
export function formatCompactTenure(hireDate: string | null | undefined, now: Date = new Date()): string {
  const hired = parseIsoDate(hireDate);
  if (!hired) return '—';
  const months = monthsBetween(hired, now);
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0 && rest === 0) return 'New joiner';
  if (years === 0) return `${rest}m`;
  return rest === 0 ? `${years}y` : `${years}y ${rest}m`;
}

/** '3 years ago', '5 months ago', 'This month' for the join date tile. */
export function formatJoinedAgo(hireDate: string | null | undefined, now: Date = new Date()): string {
  const hired = parseIsoDate(hireDate);
  if (!hired) return '';
  if (hired > now) return 'Starts soon';
  const months = monthsBetween(hired, now);
  if (months >= 12) {
    const years = Math.floor(months / 12);
    return `${years} year${years === 1 ? '' : 's'} ago`;
  }
  if (months >= 1) return `${months} month${months === 1 ? '' : 's'} ago`;
  return 'This month';
}

/**
 * Employment tab: KPI strip, then Current Assignment + Reporting Structure, then Career Journey +
 * Work Network. Each card owns its own states, so a failure or 403 in one (e.g. the work graph or
 * the direct-reports list) never affects the others.
 */
@Component({
  selector: 'app-employee-employment-tab',
  standalone: true,
  imports: [
    ErrorStateComponent,
    PopoutHeaderActionsComponent,
    EmployeeJobInfoComponent,
    EmployeeJobJourneyComponent,
    EmployeeReportingStructureComponent,
    WorkNetworkGraphComponent
  ],
  template: `
    <div class="space-y-3">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5" data-testid="employment-kpis">
        @for (kpi of kpis(); track kpi.id) {
          <div class="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white px-3.5 py-3 shadow-xs" [attr.data-testid]="'employment-kpi-' + kpi.id">
            <span class="kpi-icon" [class]="'kpi-icon kpi-icon--' + kpi.tone" aria-hidden="true">
              @switch (kpi.id) {
                @case ('tenure') {
                  <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M16 3v4M8 3v4M3 10h18M8 14h2M14 14h2M8 17h2"></path></svg>
                }
                @case ('type') {
                  <svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2"></rect><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"></path></svg>
                }
                @case ('mode') {
                  <svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"></path><circle cx="12" cy="9.5" r="2.5"></circle></svg>
                }
                @case ('joined') {
                  <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M16 3v4M8 3v4M3 10h18"></path><path d="M8 14h3M8 17h6"></path></svg>
                }
                @default {
                  <svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="5" rx="1"></rect><rect x="3" y="16" width="6" height="5" rx="1"></rect><rect x="15" y="16" width="6" height="5" rx="1"></rect><path d="M12 8v4M6 16v-2h12v2"></path></svg>
                }
              }
            </span>
            <div class="min-w-0">
              <p class="text-[11px] font-medium text-slate-500">{{ kpi.label }}</p>
              <p class="truncate text-sm font-bold text-slate-900" [title]="kpi.value">{{ kpi.value }}</p>
              @if (kpi.hint) {
                <p class="truncate text-[11px] text-slate-500" [title]="kpi.hint">{{ kpi.hint }}</p>
              }
            </div>
          </div>
        }
      </div>

      <div class="grid grid-cols-1 gap-3 xl:grid-cols-5">
        <div class="xl:col-span-3">
          <app-employee-job-info
            [jobInformation]="employee().jobInformation"
            [employeeId]="employee().id"
            [canEdit]="canEdit()"
            [saving]="saving()"
            (save)="save.emit($event)"
          />
        </div>
        <div class="xl:col-span-2">
          <app-employee-reporting-structure
            [employeeId]="employee().id"
            [employeeName]="employeeName()"
            [legalEntityId]="employee().jobInformation.legalEntityId"
            [positionId]="employee().jobInformation.positionId"
            [positionName]="employee().jobInformation.positionName"
            [departmentName]="employee().jobInformation.departmentName"
            [managerId]="employee().jobInformation.reportingManagerId ?? null"
            [managerName]="employee().jobInformation.reportingManagerName"
          />
        </div>
      </div>

      <!-- items-start: Career Journey is only as tall as its entries, not stretched to the Work Network card -->
      <div class="grid grid-cols-1 items-start gap-3 xl:grid-cols-5">
        <div class="xl:col-span-3">
          <app-employee-job-journey
            [entries]="jobJourney()"
            [refreshedAt]="jobJourneyLoadedAt()"
            [refreshing]="jobJourneyRefreshing()"
            (refresh)="refreshJobJourney.emit()"
          />
        </div>
        <div class="xl:col-span-2">
          <section
            data-testid="work-network-card"
            class="group flex h-full flex-col rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs"
            [class.cursor-pointer]="graphState() === 'ready'"
            [attr.aria-busy]="graphState() === 'loading'"
            (click)="openGraph()"
          >
            <header class="mb-3 flex items-start justify-between gap-3">
              <div class="flex items-center gap-2.5">
                <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600" aria-hidden="true">
                  <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="9" cy="8" r="3"></circle><path d="M3 20a6 6 0 0 1 12 0"></path>
                    <circle cx="17" cy="9" r="2.5"></circle><path d="M16 14.5a5 5 0 0 1 5 5"></path>
                  </svg>
                </span>
                <div class="min-w-0">
                  <h2 class="text-sm font-bold text-slate-900">Work Network</h2>
                  <p class="truncate text-[11px] text-slate-500">{{ graphSubtitle() }}</p>
                </div>
              </div>
              <app-popout-header-actions
                [refreshedAt]="graphLoadedAt()"
                [refreshing]="graphRefreshing()"
                [expanded]="false"
                [canExpand]="graphState() === 'ready'"
                [revealOnHover]="true"
                (refresh)="refreshGraph()"
                (expand)="openGraph()"
              />
            </header>

            @switch (graphState()) {
              @case ('loading') {
                <div data-testid="widget-loading" class="flex-1 animate-pulse rounded-xl bg-slate-100" aria-hidden="true" style="min-height: 10rem"></div>
              }
              @case ('error') {
                <app-error-state message="Could not load the work network." [retryable]="true" (retry)="loadGraph()" />
              }
              @case ('forbidden') {
                <p data-testid="widget-forbidden" class="text-sm text-slate-500">You do not have access to this section.</p>
              }
              @case ('empty') {
                <p data-testid="widget-empty" class="text-sm text-slate-500">This employee is not part of any project yet.</p>
              }
              @default {
                @if (graph(); as g) {
                  <app-work-network-graph [graph]="g" [showToolbar]="false" (nodeSelected)="onNodeSelected($event)" />
                }
              }
            }
          </section>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .kpi-icon {
      display: flex; flex-shrink: 0; align-items: center; justify-content: center;
      width: 2.25rem; height: 2.25rem; border-radius: 9999px;
    }
    .kpi-icon svg { width: 1.125rem; height: 1.125rem; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
    .kpi-icon--blue { background: #eff6ff; color: #2563eb; }
    .kpi-icon--green { background: #f0fdf4; color: #16a34a; }
    .kpi-icon--violet { background: #f5f3ff; color: #7c3aed; }
    .kpi-icon--orange { background: #fff7ed; color: #ea580c; }
    .kpi-icon--sky { background: #f0f9ff; color: #0284c7; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeEmploymentTabComponent {
  private readonly api = inject(PeopleApiService);
  private readonly router = inject(Router);
  private readonly graphView = viewChild(WorkNetworkGraphComponent);

  readonly employee = input.required<EmployeeDetailResponse>();
  readonly jobJourney = input<readonly PositionHistoryEntryResponse[]>([]);
  readonly jobJourneyLoadedAt = input<Date | null>(null);
  readonly jobJourneyRefreshing = input(false);
  readonly canEdit = input<boolean>(false);
  readonly saving = input<boolean>(false);
  readonly save = output<UpdateEmployeeJobDetailsRequest>();
  readonly refreshJobJourney = output<void>();

  readonly graph = signal<EmployeeWorkGraphResponse | null>(null);
  readonly graphState = signal<WidgetState>('loading');
  readonly graphLoadedAt = signal<Date | null>(null);
  readonly graphRefreshing = signal(false);

  private readonly employeeId = computed(() => this.employee().id);

  readonly employeeName = computed(() => {
    const p = this.employee().personalInformation;
    return `${p.firstName} ${p.lastName}`.trim();
  });

  readonly kpis = computed<readonly EmploymentKpi[]>(() => {
    const job = this.employee().jobInformation;
    const joined = formatJourneyDate(job.hireDate);
    const probationEnd = parseIsoDate(job.probationEndDate);
    const onProbation = probationEnd !== null && probationEnd >= new Date();
    return [
      { id: 'tenure', label: 'Tenure', value: formatCompactTenure(job.hireDate), hint: joined ? `Since ${joined}` : '', tone: 'blue' },
      {
        id: 'type',
        label: 'Employment Type',
        value: job.employmentTypeLabel || '—',
        hint: onProbation ? `Probation until ${formatJourneyDate(job.probationEndDate)}` : '',
        tone: 'green'
      },
      { id: 'mode', label: 'Work Mode', value: job.workModeLabel || '—', hint: '', tone: 'violet' },
      { id: 'joined', label: 'Join Date', value: joined || '—', hint: formatJoinedAgo(job.hireDate), tone: 'orange' },
      { id: 'department', label: 'Department', value: job.departmentName || 'Unassigned', hint: job.legalEntityName ?? '', tone: 'sky' }
    ];
  });

  /** "3 projects · 5 modules" from the graph, or the plain description until it loads. */
  readonly graphSubtitle = computed(() => {
    const g = this.graph();
    if (this.graphState() !== 'ready' || !g) return 'Projects, modules and tasks they work on';
    const count = (kind: WorkGraphNode['kind']) => g.nodes.filter((n) => n.kind === kind).length;
    const parts = [
      [count('project'), 'project'],
      [count('module'), 'module'],
      [count('task') + g.hiddenTaskCount, 'task']
    ] as const;
    return parts
      .filter(([n]) => n > 0)
      .map(([n, label]) => `${n} ${label}${n === 1 ? '' : 's'}`)
      .join(' · ');
  });

  constructor() {
    // employeeId is a memoised computed, so a parent reload that re-emits the same id
    // (e.g. after saving job details) does not refetch the graph.
    effect(() => {
      const id = this.employeeId();
      untracked(() => this.loadGraph(id));
    });
  }

  loadGraph(id: string = this.employeeId()): void {
    this.graphState.set('loading');
    this.api.getWorkGraph(id).subscribe({
      next: (graph) => {
        if (id !== this.employeeId()) return;
        this.graph.set(graph);
        this.graphLoadedAt.set(new Date());
        // The centre node is always present; anything beyond it is real work.
        this.graphState.set(graph.nodes.length > 1 ? 'ready' : 'empty');
      },
      error: (err: unknown) => {
        if (id !== this.employeeId()) return;
        this.graph.set(null);
        this.graphState.set(err instanceof HttpErrorResponse && err.status === 403 ? 'forbidden' : 'error');
      }
    });
  }

  /** Header refresh: keeps the current graph on screen until the new one lands. */
  refreshGraph(): void {
    const id = this.employeeId();
    this.graphRefreshing.set(true);
    this.api.getWorkGraph(id).subscribe({
      next: (graph) => {
        this.graphRefreshing.set(false);
        if (id !== this.employeeId()) return;
        this.graph.set(graph);
        this.graphLoadedAt.set(new Date());
        this.graphState.set(graph.nodes.length > 1 ? 'ready' : 'empty');
      },
      error: () => this.graphRefreshing.set(false)
    });
  }

  /** A click anywhere on the card opens the full graph, like the other cards' pop-outs. */
  openGraph(): void {
    const view = this.graphView();
    // Clicks inside the open overlay bubble up to the card too; don't reset its filters.
    if (view && !view.expanded()) view.openExpanded();
  }

  onNodeSelected(node: WorkGraphNode): void {
    if (!node.projectId) return;
    if (node.kind === 'module' && node.objectiveId) {
      void this.router.navigate(['/work', node.projectId, 'milestones', node.objectiveId, 'tree']);
      return;
    }
    // Projects and tasks land on the project board: no task deep-link route exists.
    void this.router.navigate(['/work', node.projectId, 'board']);
  }
}
