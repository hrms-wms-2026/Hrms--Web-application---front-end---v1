import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild
} from '@angular/core';
import { EmployeeWorkGraphResponse, WorkGraphNode } from '../../models/work-graph.model';
import { filterWorkGraph } from './work-graph-layout';
import { WorkNetworkCanvasComponent } from './work-network-canvas.component';
import { WorkNetworkExplorerComponent } from './explorer/work-network-explorer.component';

const MAX_PREVIEW_NODES = 8;

@Component({
  selector: 'app-work-network-graph',
  standalone: true,
  imports: [WorkNetworkCanvasComponent, WorkNetworkExplorerComponent],
  template: `
    <div class="wg-preview" [class.wg-preview--plain]="!showToolbar()">
      @if (showToolbar()) {
        <div class="wg-preview__bar">
          <p>{{ previewSummary() }}</p>
          <button type="button" class="wg-icon-button wg-expand-button" aria-label="Open full work network" (click)="openExpanded()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" />
            </svg>
            <span>View full graph</span>
          </button>
        </div>
      }

      <button
        type="button"
        class="wg-preview__canvas"
        data-testid="work-network-preview"
        aria-label="Open the full interactive work network"
        (click)="openExpanded()"
      >
        <app-work-network-canvas [graph]="previewGraph()" [compact]="true" />
      </button>
    </div>

    @if (expanded()) {
      <!-- stopPropagation: a card around the preview may open the graph on click; closing must not reopen it -->
      <div class="wg-overlay" data-testid="work-network-overlay" (pointerdown)="onBackdropPointerDown($event)" (click)="$event.stopPropagation()">
        <section
          #dialog
          class="wg-dialog ui-scroll-open"
          role="dialog"
          aria-modal="true"
          aria-labelledby="work-network-dialog-title"
          tabindex="-1"
          (keydown.escape)="onEscape()"
        >
          <app-work-network-explorer #explorer [graph]="graph()" (closed)="closeExpanded()" (navigate)="selectNode($event)" />
        </section>
      </div>
    }
  `,
  styles: [`
    .wg-preview { overflow: hidden; border-radius: 0.75rem; border: 1px solid var(--color-border); background: var(--color-surface-secondary); }
    /* Inside a card that already has its own frame: no second border or grey fill. */
    .wg-preview--plain { border: 0; border-radius: 0; background: transparent; }
    .wg-preview__bar { display: flex; min-height: 2.75rem; align-items: center; justify-content: space-between; gap: 1rem; border-bottom: 1px solid var(--color-border); padding: 0.5rem 0.75rem; }
    .wg-preview__bar p { margin: 0; color: var(--color-text-secondary); font-size: 0.75rem; }
    .wg-preview__canvas { display: block; width: 100%; border: 0; background: transparent; padding: 0; cursor: zoom-in; }
    .wg-preview__canvas:focus-visible { outline: 2px solid var(--color-accent); outline-offset: -2px; }
    .wg-icon-button { display: inline-flex; min-height: 2.25rem; align-items: center; justify-content: center; gap: 0.4rem; border: 1px solid var(--color-border); border-radius: 0.5rem; background: var(--color-surface); padding: 0.45rem 0.65rem; color: var(--color-text-secondary); font: inherit; font-size: 0.75rem; font-weight: 600; cursor: pointer; transition: background-color 120ms, color 120ms, border-color 120ms; }
    .wg-icon-button:hover { border-color: color-mix(in srgb, var(--color-accent) 45%, var(--color-border)); color: var(--color-text-primary); }
    .wg-icon-button:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
    .wg-icon-button svg { width: 1rem; height: 1rem; flex: none; }
    .wg-overlay { position: fixed; inset: 0; z-index: 1400; display: flex; background: rgb(15 23 42 / 0.58); padding: 1rem; backdrop-filter: blur(3px); }
    .wg-dialog { display: flex; width: 100%; min-width: 0; height: 100%; min-height: 0; flex-direction: column; overflow: hidden; border: 1px solid var(--color-border); border-radius: 1rem; background: var(--color-surface); box-shadow: 0 24px 80px rgb(0 0 0 / 0.3); outline: none; }
    @media (max-width: 640px) {
      .wg-overlay { padding: 0; }
      .wg-dialog { border: 0; border-radius: 0; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkNetworkGraphComponent {
  readonly graph = input.required<EmployeeWorkGraphResponse>();
  /** Off when the surrounding card already has its own summary and "View full graph" control. */
  readonly showToolbar = input(true);
  readonly nodeSelected = output<WorkGraphNode>();
  readonly expanded = signal(false);

  private readonly dialog = viewChild<ElementRef<HTMLElement>>('dialog');
  private readonly explorer = viewChild<WorkNetworkExplorerComponent>('explorer');
  private previouslyFocused: HTMLElement | null = null;

  /** Projects and modules only; tasks appear in the full graph when their module is hovered. */
  private readonly modulesGraph = computed(() => filterWorkGraph(this.graph(), { moduleScope: 'all', showTasks: false }));
  readonly previewGraph = computed(() => this.buildPreviewGraph(this.modulesGraph()));
  readonly previewSummary = computed(() => {
    const shown = this.previewGraph().nodes.length;
    const total = this.graph().nodes.length;
    return shown < total ? `${shown} of ${total} nodes shown` : `${total} nodes`;
  });

  constructor() {
    effect((onCleanup) => {
      if (!this.expanded()) return;
      this.previouslyFocused = document.activeElement as HTMLElement | null;
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      queueMicrotask(() => this.dialog()?.nativeElement.focus());
      onCleanup(() => {
        document.body.style.overflow = originalOverflow;
        this.previouslyFocused?.focus();
        this.previouslyFocused = null;
      });
    });
  }

  openExpanded(): void {
    this.expanded.set(true);
  }

  closeExpanded(): void {
    this.expanded.set(false);
  }

  /** Esc clears the search / unlocks a module first, and only then closes the dialog. */
  onEscape(): void {
    if (this.explorer()?.handleEscape()) return;
    this.closeExpanded();
  }

  onBackdropPointerDown(event: PointerEvent): void {
    if (event.target === event.currentTarget) this.closeExpanded();
  }

  selectNode(node: WorkGraphNode): void {
    this.closeExpanded();
    this.nodeSelected.emit(node);
  }

  private buildPreviewGraph(graph: EmployeeWorkGraphResponse): EmployeeWorkGraphResponse {
    if (graph.nodes.length <= MAX_PREVIEW_NODES) return graph;

    const nodesById = new Map(graph.nodes.map((node) => [node.id, node] as const));
    const employee = graph.nodes.find((node) => node.kind === 'employee') ?? graph.nodes[0];
    const selectedIds = new Set<string>();
    const queue: string[] = employee ? [employee.id] : [];

    while (queue.length > 0 && selectedIds.size < MAX_PREVIEW_NODES) {
      const id = queue.shift()!;
      if (selectedIds.has(id) || !nodesById.has(id)) continue;
      selectedIds.add(id);
      for (const link of graph.links) {
        if (link.source === id && !selectedIds.has(link.target)) queue.push(link.target);
        if (link.target === id && !selectedIds.has(link.source)) queue.push(link.source);
      }
    }

    for (const node of graph.nodes) {
      if (selectedIds.size >= MAX_PREVIEW_NODES) break;
      selectedIds.add(node.id);
    }

    return {
      nodes: graph.nodes.filter((node) => selectedIds.has(node.id)),
      links: graph.links.filter((link) => selectedIds.has(link.source) && selectedIds.has(link.target)),
      hiddenTaskCount: graph.hiddenTaskCount
    };
  }
}
