import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { WorkGraphNode } from '../../../people/models/work-graph.model';
import {
  ExplorerLegendItem,
  WorkNetworkExplorerComponent
} from '../../../people/ui/work-network-graph/explorer/work-network-explorer.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { ProjectApiService } from '../../data-access/project-api.service';
import { ProjectWorkGraphDto } from '../../models/dto/project-work-graph.dto';
import { ProjectMonitorStore } from '../../state/project-monitor.store';

const EMPTY_GRAPH: ProjectWorkGraphDto = { nodes: [], links: [], hiddenTaskCount: 0 };

const PROJECT_LEGEND: readonly ExplorerLegendItem[] = [
  { key: 'owner', label: 'Module' },
  { key: 'overdue', label: 'Has an alert' },
  { key: 'progress', label: 'In progress' },
  { key: 'not-started', label: 'Not started' }
];

/**
 * The project page's network view: the same Work Network explorer the People module uses, rooted
 * on this project's root module instead of an employee.
 *
 * Alerts come from ProjectMonitorStore, which the project page has already loaded, rather than
 * from the graph endpoint - that way the red circles here and the red dots in the tree are the
 * same data and cannot disagree on the same screen.
 */
@Component({
  selector: 'app-project-network-view',
  standalone: true,
  imports: [WorkNetworkExplorerComponent, LoaderComponent, ErrorStateComponent],
  template: `
    @if (loading()) {
      <app-loader label="Loading network…" />
    } @else if (error()) {
      <app-error-state [message]="error()!" [retryable]="true" (retry)="load()" />
    } @else {
      <app-work-network-explorer
        [graph]="graph()"
        [rootId]="rootNodeId()"
        [projectMode]="true"
        [showProgressRing]="true"
        [neutralModuleFill]="true"
        [alertNodeIds]="alertNodeIds()"
        [showClose]="false"
        [legend]="legend"
        heading="Project Network"
        description="Modules and tasks of this project. Hover a module to preview its tasks, click it to explore. Drag to move, scroll to zoom."
        (navigate)="openRequested.emit($event)"
      />
    }
  `,
  styles: [`
    :host { display: block; height: clamp(28rem, 70vh, 52rem); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectNetworkViewComponent {
  private readonly api = inject(ProjectApiService);
  private readonly monitor = inject(ProjectMonitorStore);

  readonly projectId = input.required<string>();
  /** The project's root (default) objective; its node is pinned at the centre of the canvas. */
  readonly rootObjectiveId = input.required<string>();

  /** A module or task the viewer asked to open in Work Management. */
  readonly openRequested = output<WorkGraphNode>();

  readonly legend = PROJECT_LEGEND;
  readonly graph = signal<ProjectWorkGraphDto>(EMPTY_GRAPH);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly rootNodeId = computed(() => `module:${this.rootObjectiveId()}`);

  /**
   * Module node ids to draw in the alert colour. A module alert maps straight to its node; a task
   * alert rolls up to the module that owns the task. An alert whose target is not in the graph -
   * a sprint, which the network does not draw, or anything the viewer cannot see - is dropped,
   * rather than reddening a circle at random.
   */
  readonly alertNodeIds = computed<ReadonlySet<string>>(() => {
    const nodes = this.graph().nodes;
    const moduleIds = new Set(nodes.filter((n) => n.kind === 'module').map((n) => n.id));
    const moduleOfTask = new Map(
      nodes.filter((n) => n.kind === 'task' && n.taskId && n.objectiveId).map((n) => [n.taskId!, `module:${n.objectiveId}`] as const)
    );
    const ids = new Set<string>();
    for (const alert of this.monitor.alerts()) {
      const candidate =
        alert.targetType === 'module' ? `module:${alert.targetId}`
          : alert.targetType === 'task' ? moduleOfTask.get(alert.targetId)
            : undefined;
      if (candidate && moduleIds.has(candidate)) ids.add(candidate);
    }
    return ids;
  });

  constructor() {
    effect(() => {
      this.projectId();
      this.load();
    });
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getWorkGraph(this.projectId()).subscribe({
      next: (graph) => {
        this.graph.set(graph);
        this.loading.set(false);
      },
      error: () => {
        this.graph.set(EMPTY_GRAPH);
        this.error.set('Could not load the project network.');
        this.loading.set(false);
      }
    });
  }
}
