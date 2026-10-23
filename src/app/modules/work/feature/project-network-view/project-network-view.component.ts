import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { Subscription } from 'rxjs';
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

/** No status rows: a circle's fill already says not started / started / completed. */
const PROJECT_LEGEND: readonly ExplorerLegendItem[] = [
  { key: 'default-module', label: 'Default module' },
  { key: 'module', label: 'Module' },
  { key: 'sprint', label: 'Sprint' },
  { key: 'task', label: 'Task' },
  { key: 'done', label: 'Completed' },
  { key: 'alert', label: 'Has an alert' }
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
    <!-- The loader only covers the first load: a refetch keeps the drawn network (and its zoom,
         pan and locked node) on screen until the new graph arrives. -->
    @if (loading() && graph().nodes.length === 0) {
      <app-loader label="Loading network…" />
    } @else if (error()) {
      <app-error-state [message]="error()!" [retryable]="true" (retry)="load()" />
    } @else if (!hasRoot()) {
      <!-- The graph is from another project than the root id (mid project switch): wait, so the
           explorer is only ever created with a root it can pin. -->
      <app-loader label="Loading network…" />
    } @else {
      <app-work-network-explorer
        [graph]="graph()"
        [rootId]="rootNodeId()"
        [projectMode]="true"
        [showProgressRing]="true"
        [neutralModuleFill]="true"
        taskDotStyle="status"
        [revealSprintsOnHover]="true"
        [alertNodeIds]="alertNodeIds()"
        [showClose]="false"
        [showDetailPanel]="false"
        [showHeader]="false"
        [legend]="legend"
        (lockChanged)="onLockChanged($event)"
        (navigate)="nodeSelected.emit($event)"
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
  /**
   * Any value that changes when the project's tree is reloaded (the tree tab passes the tree
   * object itself). A change re-fetches the graph, so a module created while the network is
   * showing appears in it.
   */
  readonly reloadKey = input<unknown>(null);

  /**
   * A module, sprint or task the viewer clicked. The tree tab shows it in its own explanation
   * card, so the explorer's built-in panel is off. Releasing the lock is not emitted: the card
   * keeps showing the last selection.
   */
  readonly nodeSelected = output<WorkGraphNode>();

  readonly legend = PROJECT_LEGEND;
  readonly graph = signal<ProjectWorkGraphDto>(EMPTY_GRAPH);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly rootNodeId = computed(() => `module:${this.rootObjectiveId()}`);
  readonly hasRoot = computed(() => this.graph().nodes.some((n) => n.id === this.rootNodeId()));

  /**
   * Circle node ids to draw in the alert colour. Module and sprint alerts map straight to their
   * node. Tasks are only shown on hover, so a task alert reddens the circle the task hangs off -
   * its sprint, or its module when it is in no sprint. An alert whose target is not in the graph
   * (anything the viewer cannot see, or a task past the cap) is dropped rather than reddening a
   * circle at random. An alert inside an achieved module is skipped too: the tree draws it faded
   * and leaves it out of the count, and the two views share one screen.
   */
  readonly alertNodeIds = computed<ReadonlySet<string>>(() => {
    const { nodes, links } = this.graph();
    const circleIds = new Set(nodes.filter((n) => n.kind === 'module' || n.kind === 'sprint').map((n) => n.id));
    const parentOfTask = new Map(
      links.filter((l) => l.kind === 'has_task').map((l) => [l.target, l.source] as const)
    );
    const ids = new Set<string>();
    for (const alert of this.monitor.alerts()) {
      if (alert.inAchievedModule) continue;
      const candidate =
        alert.targetType === 'module' ? `module:${alert.targetId}`
          : alert.targetType === 'sprint' ? `sprint:${alert.targetId}`
            : parentOfTask.get(`task:${alert.targetId}`);
      if (candidate && circleIds.has(candidate)) ids.add(candidate);
    }
    return ids;
  });

  /** The request in flight; a new load cancels it, so responses can never land out of order. */
  private request: Subscription | null = null;

  constructor() {
    effect(() => {
      this.projectId();
      this.reloadKey();
      untracked(() => this.load());
    });
    inject(DestroyRef).onDestroy(() => this.request?.unsubscribe());
  }

  onLockChanged(node: WorkGraphNode | null): void {
    if (node) this.nodeSelected.emit(node);
  }

  load(): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    this.request = this.api.getWorkGraph(this.projectId()).subscribe({
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
