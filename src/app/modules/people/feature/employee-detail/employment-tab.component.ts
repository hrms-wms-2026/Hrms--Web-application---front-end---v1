import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { WidgetCardComponent, WidgetState } from '../../../../shared/ui/widget-card/widget-card.component';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeDetailResponse, UpdateEmployeeJobDetailsRequest } from '../../models/employee.model';
import { PositionHistoryEntryResponse } from '../../models/position-history.model';
import { EmployeeWorkGraphResponse, WorkGraphNode } from '../../models/work-graph.model';
import { EmployeeEmploymentRecordComponent } from '../../ui/employee-employment-record/employee-employment-record.component';
import { EmployeeJobInfoComponent } from '../../ui/employee-job-info/employee-job-info.component';
import { EmployeeJobJourneyComponent } from '../../ui/employee-job-journey/employee-job-journey.component';
import { EmployeeWorkArrangementComponent } from '../../ui/employee-work-arrangement/employee-work-arrangement.component';
import { WorkNetworkGraphComponent } from '../../ui/work-network-graph/work-network-graph.component';
import { primaryLocationLabel } from '../../utils/employee-view.utils';

/**
 * Employment tab. The Work Network widget owns its own fetch and states, so a failure or 403
 * there never affects the job details, arrangement, record or history cards around it.
 */
@Component({
  selector: 'app-employee-employment-tab',
  standalone: true,
  imports: [
    WidgetCardComponent,
    EmployeeJobInfoComponent,
    EmployeeJobJourneyComponent,
    EmployeeEmploymentRecordComponent,
    EmployeeWorkArrangementComponent,
    WorkNetworkGraphComponent
  ],
  template: `
    <div class="grid gap-4 lg:grid-cols-3">
      <div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 lg:col-span-2">
        <app-employee-job-info
          [jobInformation]="employee().jobInformation"
          [employeeId]="employee().id"
          [canEdit]="canEdit()"
          [saving]="saving()"
          (save)="save.emit($event)"
        />
      </div>
      <div class="flex flex-col gap-4">
        <app-employee-work-arrangement
          [workModeLabel]="employee().jobInformation.workModeLabel"
          [legalEntityName]="employee().jobInformation.legalEntityName"
          [primaryLocation]="primaryLocation()"
        />
        <app-employee-employment-record
          [hireDate]="employee().jobInformation.hireDate"
          [probationEndDate]="employee().jobInformation.probationEndDate"
          [status]="employee().jobInformation.status"
        />
      </div>
    </div>

    <div class="mt-4">
      <app-widget-card
        title="Work Network"
        [state]="graphState()"
        errorMessage="Could not load the work network."
        emptyMessage="This employee is not part of any project yet."
        (retry)="loadGraph()"
      >
        @if (graph(); as g) {
          <app-work-network-graph [graph]="g" (nodeSelected)="onNodeSelected($event)" />
        }
      </app-widget-card>
    </div>

    <div class="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
      <app-employee-job-journey [entries]="jobJourney()" />
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeEmploymentTabComponent {
  private readonly api = inject(PeopleApiService);
  private readonly router = inject(Router);

  readonly employee = input.required<EmployeeDetailResponse>();
  readonly jobJourney = input<readonly PositionHistoryEntryResponse[]>([]);
  readonly canEdit = input<boolean>(false);
  readonly saving = input<boolean>(false);
  readonly save = output<UpdateEmployeeJobDetailsRequest>();

  readonly graph = signal<EmployeeWorkGraphResponse | null>(null);
  readonly graphState = signal<WidgetState>('loading');

  private readonly employeeId = computed(() => this.employee().id);
  readonly primaryLocation = computed(() => primaryLocationLabel(this.employee().personalInformation.addresses));

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
