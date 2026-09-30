import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild
} from '@angular/core';
import { EmployeeWorkGraphResponse, WorkGraphNode } from '../../models/work-graph.model';
import { WorkGraphModuleScope, filterWorkGraph } from './work-graph-layout';
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
          (keydown.escape)="onEscape()"
        >
          <header class="wg-dialog__header">
            <div class="wg-dialog__title-group">
              <h2 id="work-network-dialog-title">Work Network</h2>
              <p>Drag the canvas to move around, scroll to zoom, or drag a node to pin it.</p>
            </div>

            <div class="wg-dialog__header-right">
              <div #filterWrapper class="wg-filter-wrapper">
                <button
                  type="button"
                  class="wg-filter-trigger"
                  [class.wg-filter-trigger--active]="isCustomFilter()"
                  [class.wg-filter-trigger--open]="filterOpen()"
                  data-testid="filter-trigger"
                  aria-haspopup="dialog"
                  [attr.aria-expanded]="filterOpen()"
                  (click)="toggleFilterOpen($event)"
                >
                  <svg class="wg-filter-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 6h16M7 12h10M10 18h4" />
                  </svg>
                  <span>Filter:</span>
                  <span class="wg-filter-summary">{{ filterSummary() }}</span>
                  <svg class="wg-filter-chevron" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>

                @if (filterOpen()) {
                  <div
                    class="wg-filter-panel"
                    role="dialog"
                    aria-label="Filter network nodes"
                    (click)="$event.stopPropagation()"
                  >
                    <div class="wg-filter-panel__header">
                      <span class="wg-filter-panel__title">Filter network</span>
                      @if (isCustomFilter()) {
                        <button
                          type="button"
                          class="wg-filter-reset-btn"
                          data-testid="filter-reset"
                          (click)="resetFilters()"
                        >
                          Reset
                        </button>
                      }
                    </div>

                    <div class="wg-filter-section">
                      <span class="wg-filter-section__label">Scope</span>
                      <div class="wg-filter-options" role="radiogroup" aria-label="Module scope">
                        <label class="wg-filter-option">
                          <input
                            type="radio"
                            name="moduleScope"
                            data-testid="filter-upto-modules"
                            [checked]="moduleScope() === 'all'"
                            (change)="setModuleScope('all')"
                          />
                          <div class="wg-filter-option__desc">
                            <span class="wg-filter-option__name">Up to modules</span>
                            <span class="wg-filter-option__hint">Projects and all modules (owned & member)</span>
                          </div>
                        </label>

                        <label class="wg-filter-option">
                          <input
                            type="radio"
                            name="moduleScope"
                            data-testid="filter-owner-modules"
                            [checked]="moduleScope() === 'owner'"
                            (change)="setModuleScope('owner')"
                          />
                          <div class="wg-filter-option__desc">
                            <span class="wg-filter-option__name">Owner modules</span>
                            <span class="wg-filter-option__hint">Only modules the employee owns</span>
                          </div>
                        </label>
                      </div>
                    </div>

                    <div class="wg-filter-divider"></div>

                    <div class="wg-filter-section">
                      <span class="wg-filter-section__label">Tasks</span>
                      <label class="wg-filter-option wg-filter-option--checkbox">
                        <input
                          type="checkbox"
                          data-testid="filter-tasks"
                          [checked]="showTasks()"
                          (change)="setShowTasks($any($event.target).checked)"
                        />
                        <div class="wg-filter-option__desc">
                          <span class="wg-filter-option__name">Tasks</span>
                          <span class="wg-filter-option__hint">Show active & not started tasks</span>
                        </div>
                        @if (taskCount() > 0) {
                          <span class="wg-filter-badge">{{ taskCount() }}</span>
                        }
                      </label>
                    </div>
                  </div>
                }
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
            </div>
          </header>

          <div class="wg-dialog__canvas">
            <app-work-network-canvas
              #fullCanvas
              [graph]="fullGraph()"
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
            <div class="wg-dialog__footer-meta">
              <span class="wg-node-count">{{ fullGraph().nodes.length }} nodes shown</span>
              @if (graph().hiddenTaskCount > 0) {
                <p>+{{ graph().hiddenTaskCount }} more tasks are not included in this graph.</p>
              }
            </div>
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
    .wg-dialog__header-right { display: flex; align-items: center; gap: 0.75rem; }

    .wg-filter-wrapper { position: relative; display: inline-flex; align-items: center; }
    .wg-filter-trigger { display: inline-flex; min-height: 2.25rem; align-items: center; gap: 0.4rem; border: 1px solid var(--color-border); border-radius: 0.5rem; background: var(--color-surface); padding: 0.45rem 0.75rem; color: var(--color-text-secondary); font: inherit; font-size: 0.75rem; font-weight: 600; cursor: pointer; transition: background-color 120ms, color 120ms, border-color 120ms; }
    .wg-filter-trigger:hover { border-color: color-mix(in srgb, var(--color-accent) 45%, var(--color-border)); color: var(--color-text-primary); }
    .wg-filter-trigger:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
    .wg-filter-trigger--active { border-color: var(--color-accent); color: var(--color-accent); background: color-mix(in srgb, var(--color-accent) 8%, var(--color-surface)); }
    .wg-filter-icon { width: 0.95rem; height: 0.95rem; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .wg-filter-summary { color: var(--color-text-primary); font-weight: 500; }
    .wg-filter-trigger--active .wg-filter-summary { color: var(--color-accent); font-weight: 600; }
    .wg-filter-chevron { width: 0.8rem; height: 0.8rem; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; transition: transform 120ms; }
    .wg-filter-trigger--open .wg-filter-chevron { transform: rotate(180deg); }

    .wg-filter-panel { position: absolute; top: calc(100% + 6px); right: 0; z-index: 100; width: 280px; border: 1px solid var(--color-border); border-radius: 0.75rem; background: var(--color-surface); box-shadow: 0 16px 36px rgb(15 23 42 / 0.18); padding: 0.75rem; animation: wg-panel-in 120ms ease-out; }
    @keyframes wg-panel-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
    .wg-filter-panel__header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.6rem; padding-bottom: 0.45rem; border-bottom: 1px solid var(--color-border); }
    .wg-filter-panel__title { font-size: 0.78rem; font-weight: 700; color: var(--color-text-primary); }
    .wg-filter-reset-btn { border: 0; background: transparent; padding: 0; color: var(--color-accent); font: inherit; font-size: 0.72rem; font-weight: 600; cursor: pointer; }
    .wg-filter-reset-btn:hover { text-decoration: underline; }
    .wg-filter-section { display: flex; flex-direction: column; gap: 0.35rem; }
    .wg-filter-section__label { font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-text-secondary); }
    .wg-filter-options { display: flex; flex-direction: column; gap: 0.2rem; }
    .wg-filter-option { display: flex; align-items: flex-start; gap: 0.55rem; padding: 0.35rem 0.45rem; border-radius: 0.375rem; cursor: pointer; transition: background-color 100ms; }
    .wg-filter-option:hover { background: var(--color-surface-secondary); }
    .wg-filter-option input[type="radio"], .wg-filter-option input[type="checkbox"] { margin-top: 0.15rem; cursor: pointer; accent-color: var(--color-accent); }
    .wg-filter-option__desc { display: flex; flex-direction: column; gap: 0.1rem; flex: 1; min-width: 0; }
    .wg-filter-option__name { font-size: 0.75rem; font-weight: 600; color: var(--color-text-primary); }
    .wg-filter-option__hint { font-size: 0.68rem; color: var(--color-text-secondary); line-height: 1.25; }
    .wg-filter-divider { height: 1px; background: var(--color-border); margin: 0.45rem 0; }
    .wg-filter-badge { display: inline-flex; min-width: 1.15rem; height: 1.15rem; align-items: center; justify-content: center; padding: 0 0.25rem; border-radius: 9999px; font-size: 0.65rem; font-weight: 700; background: var(--color-surface-secondary); color: var(--color-text-secondary); }

    .wg-dialog__actions { display: flex; align-items: center; gap: 0.4rem; }
    .wg-dialog__actions .wg-icon-button { width: 2.25rem; padding: 0; }
    .wg-action-divider { width: 1px; height: 1.5rem; margin: 0 0.15rem; background: var(--color-border); }
    .wg-dialog__canvas { min-height: 0; flex: 1; overflow: hidden; background: color-mix(in srgb, var(--color-surface-secondary) 55%, var(--color-surface)); }
    .wg-dialog__footer { display: flex; flex: none; align-items: center; justify-content: space-between; gap: 1rem; border-top: 1px solid var(--color-border); padding: 0.65rem 1rem; }
    .wg-dialog__footer p { margin: 0; color: var(--color-text-secondary); font-size: 0.75rem; }
    .wg-dialog__footer-meta { display: flex; align-items: center; gap: 0.75rem; }
    .wg-node-count { font-size: 0.75rem; color: var(--color-text-secondary); }
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
      .wg-dialog__header { flex-wrap: wrap; gap: 0.5rem; padding: 0.65rem 0.75rem; }
      .wg-dialog__header-right { width: 100%; justify-content: space-between; }
      .wg-filter-panel { right: auto; left: 0; width: 100%; max-width: calc(100vw - 2rem); }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkNetworkGraphComponent {
  readonly graph = input.required<EmployeeWorkGraphResponse>();
  readonly nodeSelected = output<WorkGraphNode>();
  readonly expanded = signal(false);

  readonly moduleScope = signal<WorkGraphModuleScope>('all');
  readonly showTasks = signal(false);
  readonly filterOpen = signal(false);

  private readonly dialog = viewChild<ElementRef<HTMLElement>>('dialog');
  private readonly filterWrapper = viewChild<ElementRef<HTMLElement>>('filterWrapper');
  private previouslyFocused: HTMLElement | null = null;

  readonly previewGraph = computed(() => this.buildPreviewGraph(this.graph()));
  readonly previewSummary = computed(() => {
    const shown = this.previewGraph().nodes.length;
    const total = this.graph().nodes.length;
    return shown < total ? `${shown} of ${total} nodes shown` : `${total} nodes`;
  });

  readonly taskCount = computed(() => this.graph().nodes.filter((node) => node.kind === 'task').length);

  readonly fullGraph = computed(() =>
    filterWorkGraph(this.graph(), {
      moduleScope: this.moduleScope(),
      showTasks: this.showTasks()
    })
  );

  readonly filterSummary = computed(() => {
    const scopeLabel = this.moduleScope() === 'owner' ? 'Owner modules' : 'Up to modules';
    return this.showTasks() ? `${scopeLabel} + Tasks` : scopeLabel;
  });

  readonly isCustomFilter = computed(() => this.moduleScope() !== 'all' || this.showTasks());

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

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.filterOpen()) return;
    const target = event.target as Node;
    const wrapper = this.filterWrapper()?.nativeElement;
    if (wrapper && !wrapper.contains(target)) {
      this.filterOpen.set(false);
    }
  }

  openExpanded(): void {
    this.moduleScope.set('all');
    this.showTasks.set(false);
    this.filterOpen.set(false);
    this.expanded.set(true);
  }

  closeExpanded(): void {
    this.filterOpen.set(false);
    this.expanded.set(false);
  }

  onEscape(): void {
    if (this.filterOpen()) {
      this.filterOpen.set(false);
    } else {
      this.closeExpanded();
    }
  }

  toggleFilterOpen(event?: MouseEvent): void {
    event?.stopPropagation();
    this.filterOpen.update((open) => !open);
  }

  setModuleScope(scope: WorkGraphModuleScope): void {
    this.moduleScope.set(scope);
  }

  setShowTasks(checked: boolean): void {
    this.showTasks.set(checked);
  }

  toggleTasks(): void {
    this.showTasks.update((value) => !value);
  }

  resetFilters(): void {
    this.moduleScope.set('all');
    this.showTasks.set(false);
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
