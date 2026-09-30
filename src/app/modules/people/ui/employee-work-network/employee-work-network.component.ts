import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { WidgetCardComponent, WidgetState } from '../../../../shared/ui/widget-card/widget-card.component';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeWorkGraphResponse, WorkGraphNode } from '../../models/work-graph.model';
import { WorkNetworkGraphComponent } from '../work-network-graph/work-network-graph.component';

/**
 * Work Network card. Owns its own fetch and states, so a failure or 403 here never affects the
 * cards around it.
 */
@Component({
  selector: 'app-employee-work-network',
  standalone: true,
  imports: [WidgetCardComponent, WorkNetworkGraphComponent],
  template: `
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
  `,
  styles: [`:host { display: block; }`],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeWorkNetworkComponent {
  private readonly api = inject(PeopleApiService);
  private readonly router = inject(Router);

  readonly employeeId = input.required<string>();

  readonly graph = signal<EmployeeWorkGraphResponse | null>(null);
  readonly graphState = signal<WidgetState>('loading');

  constructor() {
    // Signal inputs only notify on a changed value, so a parent reload that re-emits the same
    // id (e.g. after saving job details) does not refetch the graph.
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
