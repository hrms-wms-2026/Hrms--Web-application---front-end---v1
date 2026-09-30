import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, input, output, signal, viewChild } from '@angular/core';
import { EmployeeWorkGraphResponse, WorkGraphNode } from '../../models/work-graph.model';
import { WorkNetworkCanvasComponent } from './work-network-canvas.component';

const MAX_PREVIEW_NODES = 8;

@Component({
  selector: 'app-work-network-graph',
  standalone: true,
  imports: [WorkNetworkCanvasComponent],
  template: `
    <div class="wg-preview">
      <div class="wg-preview__bar">
        <p>{{ previewSummary() }}</p>
        <button type="button" class="wg-icon-button wg-expand-button" aria-label="Open full work network" (click)="openExpanded()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" />
          </svg>
          <span>View full graph</span>
        </button>
      </div>

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
      <div class="wg-overlay" data-testid="work-network-overlay" (pointerdown)="onBackdropPointerDown($event)">
        <section
          #dialog
          class="wg-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="work-network-dialog-title"
          tabindex="-1"
          (keydown.escape)="closeExpanded()"
        >
          <header class="wg-dialog__header">
            <div>
              <h2 id="work-network-dialog-title">Work Network</h2>
              <p>Drag the canvas to move around, scroll to zoom, or drag a node to pin it.</p>
            </div>
            <div class="wg-dialog__actions" aria-label="Graph controls">
              <button type="button" class="wg-icon-button" aria-label="Zoom out" title="Zoom out" (click)="fullCanvas.zoomOut()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M8 11h6M16 16l5 5"/></svg>
              </button>
              <button type="button" class="wg-icon-button" aria-label="Reset graph view" title="Reset view" (click)="fullCanvas.resetView()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>
              </button>
              <button type="button" class="wg-icon-button" aria-label="Zoom in" title="Zoom in" (click)="fullCanvas.zoomIn()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M8 11h6M11 8v6M16 16l5 5"/></svg>
              </button>
              <span class="wg-action-divider" aria-hidden="true"></span>
              <button type="button" class="wg-icon-button" aria-label="Close full work network" title="Close" (click)="closeExpanded()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
              </button>
            </div>
          </header>

          <div class="wg-dialog__canvas">
            <app-work-network-canvas
              #fullCanvas
              [graph]="graph()"
              [interactive]="true"
              [animated]="true"
              (nodeSelected)="selectNode($event)"
            />
          </div>

          <footer class="wg-dialog__footer">
            <ul class="wg-legend" aria-label="Legend">
              <li><span class="wg-key wg-key--project"></span>Project</li>
              <li><span class="wg-key wg-key--owner"></span>Module you own</li>
              <li><span class="wg-key wg-key--member"></span>Module member</li>
              <li><span class="wg-key wg-key--active"></span>Active task</li>
              <li><span class="wg-key wg-key--not-started"></span>Not started task</li>
            </ul>
            @if (graph().hiddenTaskCount > 0) {
              <p>+{{ graph().hiddenTaskCount }} more tasks are not included in this graph.</p>
            }
          </footer>
        </section>
      </div>
    }
  `,
  styles: [`
    .wg-preview { overflow: hidden; border-radius: 0.75rem; border: 1px solid var(--color-border); background: var(--color-surface-secondary); }
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
    .wg-dialog__header { display: flex; flex: none; align-items: center; justify-content: space-between; gap: 1rem; border-bottom: 1px solid var(--color-border); padding: 0.85rem 1rem; }
    .wg-dialog__header h2 { margin: 0; color: var(--color-text-primary); font-size: 1rem; font-weight: 700; }
    .wg-dialog__header p { margin: 0.2rem 0 0; color: var(--color-text-secondary); font-size: 0.75rem; }
    .wg-dialog__actions { display: flex; align-items: center; gap: 0.4rem; }
    .wg-dialog__actions .wg-icon-button { width: 2.25rem; padding: 0; }
    .wg-action-divider { width: 1px; height: 1.5rem; margin: 0 0.15rem; background: var(--color-border); }
    .wg-dialog__canvas { min-height: 0; flex: 1; overflow: hidden; background: color-mix(in srgb, var(--color-surface-secondary) 55%, var(--color-surface)); }
    .wg-dialog__footer { display: flex; flex: none; align-items: center; justify-content: space-between; gap: 1rem; border-top: 1px solid var(--color-border); padding: 0.65rem 1rem; }
    .wg-dialog__footer p { margin: 0; color: var(--color-text-secondary); font-size: 0.75rem; }
    .wg-legend { display: flex; flex-wrap: wrap; gap: 0.6rem 1rem; margin: 0; padding: 0; color: var(--color-text-secondary); font-size: 0.72rem; list-style: none; }
    .wg-legend li { display: inline-flex; align-items: center; gap: 0.35rem; }
    .wg-key { display: inline-block; width: 0.7rem; height: 0.7rem; border: 2px solid transparent; border-radius: 9999px; }
    .wg-key--project { background: #1d4ed8; }
    .wg-key--owner { background: #7c3aed; }
    .wg-key--member { border-color: #7c3aed; }
    .wg-key--active { background: #16a34a; }
    .wg-key--not-started { background: #94a3b8; }
    @media (max-width: 640px) {
      .wg-overlay { padding: 0; }
      .wg-dialog { border: 0; border-radius: 0; }
      .wg-dialog__header p, .wg-expand-button span, .wg-dialog__footer { display: none; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkNetworkGraphComponent {
  readonly graph = input.required<EmployeeWorkGraphResponse>();
  readonly nodeSelected = output<WorkGraphNode>();
  readonly expanded = signal(false);

  private readonly dialog = viewChild<ElementRef<HTMLElement>>('dialog');
  private previouslyFocused: HTMLElement | null = null;

  readonly previewGraph = computed(() => this.buildPreviewGraph(this.graph()));
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
