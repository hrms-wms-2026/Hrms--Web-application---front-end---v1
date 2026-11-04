import { ChangeDetectionStrategy, Component, computed, input, output, signal, viewChild } from '@angular/core';
import { EmployeeWorkGraphResponse, WorkGraphNode } from '../../../models/work-graph.model';
import { SearchHit, buildExplorerLayout, searchGraph, tasksByParent } from './explorer-layout';
import { WorkNetworkDetailPanelComponent } from './work-network-detail-panel.component';
import { WorkNetworkExplorerCanvasComponent } from './work-network-explorer-canvas.component';

const FOCUS_MS = 1800;

/** One row of the footer legend. `key` is the `wge-key--*` modifier that colours the swatch. */
export interface ExplorerLegendItem {
  readonly key: string;
  readonly label: string;
}

/** What the footer shows when `legend` is left alone: the employee Work Network's own legend. */
const EMPLOYEE_LEGEND: readonly ExplorerLegendItem[] = [
  { key: 'project', label: 'Project' },
  { key: 'owner', label: 'Module you own' },
  { key: 'member', label: 'Module member' },
  { key: 'progress', label: 'In progress' },
  { key: 'not-started', label: 'Not started' },
  { key: 'overdue', label: 'Overdue' }
];

/**
 * The full-screen Work Network: three levels of exploration.
 *  1. Overview - employee, projects, modules; tasks hidden.
 *  2. Hover a module (or project) - its open tasks preview as cards beside it; nothing moves.
 *  3. Click it - the selection locks: cards stay, neighbours ease aside, and a details panel opens.
 *     Works without hover, so it also works on touch. Click it again, the empty canvas, or Esc to unlock.
 */
@Component({
  selector: 'app-work-network-explorer',
  standalone: true,
  imports: [WorkNetworkExplorerCanvasComponent, WorkNetworkDetailPanelComponent],
  template: `
    @if (showHeader()) {
    <header class="wge-head">
      <div class="wge-title">
        <h2 id="work-network-dialog-title">{{ heading() }}</h2>
        <p>{{ description() }}</p>
      </div>

      <div class="wge-actions">
        <div class="wge-search ui-field ui-field--sm">
          <span class="ui-field__addon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg></span>
          <input class="ui-field__control"
            type="search"
            data-testid="work-network-search"
            placeholder="Search projects, modules or tasks…"
            aria-label="Search projects, modules or tasks"
            [value]="query()"
            (input)="query.set($any($event.target).value)"
            (keydown.enter)="pickFirst()"
            (keydown.escape)="clearSearch($event)"
          />
          @if (hits().length > 0) {
            <ul class="wge-results" role="listbox" data-testid="work-network-results">
              @for (hit of hits(); track hit.node.id) {
                <li>
                  <button type="button" role="option" aria-selected="false" (click)="pick(hit)">
                    <span [class]="'wge-dot wge-dot--' + hit.node.kind"></span>
                    <span class="wge-result-label">{{ hit.node.label }}</span>
                    <span class="wge-result-kind">{{ hit.kindLabel }}</span>
                  </button>
                </li>
              }
            </ul>
          } @else if (query().trim()) {
            <p class="wge-results wge-results--empty">No matches</p>
          }
        </div>

        <button type="button" class="wge-btn wge-btn--text" data-testid="work-network-fit" (click)="canvas()?.fit()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/></svg>
          Fit to screen
        </button>
        <button type="button" class="wge-btn" aria-label="Reset graph view" title="Reset view" data-testid="work-network-reset" (click)="reset()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>
        </button>
        <button type="button" class="wge-btn" aria-label="Zoom out" title="Zoom out" (click)="canvas()?.zoomOut()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M8 11h6M16 16l5 5"/></svg>
        </button>
        <button type="button" class="wge-btn" aria-label="Zoom in" title="Zoom in" (click)="canvas()?.zoomIn()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M8 11h6M11 8v6M16 16l5 5"/></svg>
        </button>
        @if (showClose()) {
        <span class="wge-divider" aria-hidden="true"></span>
        <button type="button" class="wge-btn" aria-label="Close full work network" title="Close" (click)="closed.emit()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
        </button>
        }
      </div>
    </header>
    }

    <div class="wge-body">
      <div class="wge-stage">
        <app-work-network-explorer-canvas
          [graph]="graph()"
          [locked]="locked()"
          [focusId]="focusId()"
          [rootId]="rootId()"
          [showProgressRing]="showProgressRing()"
          [alertNodeIds]="alertNodeIds()"
          [neutralModuleFill]="neutralModuleFill()"
          [taskDotStyle]="taskDotStyle()"
          [revealSprintsOnHover]="revealSprintsOnHover()"
          (nodeClicked)="toggleLock($event)"
          (taskClicked)="navigate.emit($event)"
          (backgroundClicked)="setLocked(null)"
        />

        <ul class="wge-counts" aria-label="Network contents">
          <li><span class="wge-dot wge-dot--project"></span>Projects ({{ counts().projects }})</li>
          <li><span class="wge-dot wge-dot--module"></span>Modules ({{ counts().modules }})</li>
          <li><span class="wge-dot wge-dot--task"></span>Open tasks ({{ counts().tasks }})</li>
        </ul>
      </div>

      @if (showDetailPanel() && selectedNode(); as node) {
        <app-work-network-detail-panel
          class="wge-panel"
          [graph]="graph()"
          [selected]="node"
          [code]="codes().get(node.id) ?? ''"
          [projectMode]="projectMode()"
          (closed)="setLocked(null)"
          (open)="navigate.emit($event)"
          (taskClicked)="navigate.emit($event)"
          (selectModule)="lockAndCentre($event.id)"
        />
      }
    </div>

    <footer class="wge-foot">
      <ul class="wge-legend" aria-label="Legend">
        @for (item of legendItems(); track item.key) {
          <li><span [class]="'wge-key wge-key--' + item.key"></span>{{ item.label }}</li>
        }
      </ul>
      <p class="wge-meta">
        {{ counts().nodes }} nodes shown · {{ counts().tasks }} open tasks
        @if (graph().hiddenTaskCount > 0) { · +{{ graph().hiddenTaskCount }} more tasks not drawn }
      </p>
    </footer>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; width: 100%; height: 100%; min-height: 0; }
    .wge-head { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.9rem 1.25rem; border-bottom: 1px solid var(--color-border); }
    .wge-title { min-width: 0; }
    .wge-title h2 { margin: 0; font-size: 1.15rem; font-weight: 700; color: var(--color-text-primary); }
    .wge-title p { margin: 0.15rem 0 0; font-size: 0.75rem; color: var(--color-text-secondary); }
    .wge-actions { display: flex; align-items: center; gap: 0.5rem; }
    .wge-search { width: 17rem; }
    .wge-results { position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 5; margin: 0; padding: 0.3rem; list-style: none; border: 1px solid var(--color-border); border-radius: 0.6rem; background: var(--color-surface); box-shadow: var(--shadow-modal); }
    .wge-results--empty { padding: 0.6rem 0.75rem; font-size: 0.75rem; color: var(--color-text-secondary); }
    .wge-results button { display: flex; width: 100%; align-items: center; gap: 0.5rem; border: 0; border-radius: 0.4rem; background: transparent; padding: 0.4rem 0.5rem; text-align: left; cursor: pointer; font-size: 0.78rem; color: var(--color-text-primary); }
    .wge-results button:hover { background: var(--color-surface-secondary); }
    .wge-result-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .wge-result-kind { font-size: 0.68rem; color: var(--color-text-secondary); }
    .wge-btn { display: inline-flex; height: 2.25rem; min-width: 2.25rem; align-items: center; justify-content: center; gap: 0.4rem; border: 1px solid var(--color-border); border-radius: 0.6rem; background: var(--color-surface); color: var(--color-text-secondary); cursor: pointer; font: inherit; font-size: 0.78rem; font-weight: 600; }
    .wge-btn--text { padding: 0 0.75rem; color: var(--color-text-primary); }
    .wge-btn:hover { background: var(--color-surface-secondary); color: var(--color-text-primary); }
    .wge-btn svg { width: 1rem; height: 1rem; }
    .wge-divider { width: 1px; height: 1.5rem; background: var(--color-border); margin: 0 0.25rem; }
    .wge-body { position: relative; display: flex; flex: 1; min-height: 0; }
    .wge-stage { position: relative; flex: 1; min-width: 0; }
    .wge-panel { width: 23rem; flex-shrink: 0; }
    .wge-counts { position: absolute; top: 1rem; left: 1rem; margin: 0; padding: 0.35rem; list-style: none; border: 1px solid var(--color-border); border-radius: 0.75rem; background: var(--color-surface); box-shadow: var(--shadow-popover); }
    .wge-counts li { display: flex; align-items: center; gap: 0.5rem; padding: 0.35rem 0.6rem; font-size: 0.78rem; font-weight: 500; color: var(--color-text-primary); }
    .wge-dot { width: 0.65rem; height: 0.65rem; flex-shrink: 0; border-radius: 9999px; }
    .wge-dot--project, .wge-dot--employee { background: #2563eb; }
    .wge-dot--module { background: #8b5cf6; }
    .wge-dot--task { background: #c4b5fd; }
    .wge-foot { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.6rem 1.25rem; border-top: 1px solid var(--color-border); }
    .wge-legend { display: flex; flex-wrap: wrap; gap: 1rem; margin: 0; padding: 0; list-style: none; font-size: 0.72rem; color: var(--color-text-secondary); }
    .wge-legend li { display: inline-flex; align-items: center; gap: 0.35rem; }
    .wge-key { width: 0.65rem; height: 0.65rem; border-radius: 9999px; }
    .wge-key--project { background: #2563eb; }
    .wge-key--owner { background: #8b5cf6; }
    .wge-key--member { border: 2px solid #8b5cf6; }
    .wge-key--progress { background: #2563eb; outline: 2px solid #bfdbfe; }
    .wge-key--not-started { background: var(--color-text-muted); }
    .wge-key--overdue { background: #ef4444; }
    /* Project-mode legend swatches; only used when a legend with these keys is passed in. */
    .wge-key--default-module { background: #2563eb; }
    .wge-key--module { background: #8b5cf6; }
    .wge-key--sprint { background: #8b5cf6; }
    .wge-key--task { background: #38bdf8; }
    .wge-key--done { background: var(--color-border-strong); }
    .wge-key--alert { background: #ef4444; }
    .wge-meta { margin: 0; font-size: 0.72rem; color: var(--color-text-secondary); white-space: nowrap; }
    @media (max-width: 900px) {
      .wge-title p, .wge-btn--text, .wge-legend { display: none; }
      .wge-search { width: 11rem; }
      .wge-panel { position: absolute; inset: 0 0 0 auto; width: min(23rem, 100%); z-index: 4; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkNetworkExplorerComponent {
  readonly graph = input.required<EmployeeWorkGraphResponse>();
  /**
   * Project-mode chrome and canvas pass-throughs. Every one defaults to the employee Work
   * Network's own behaviour, so that view passes none of them and is unchanged.
   */
  readonly heading = input('Work Network');
  readonly description = input(
    'Projects, modules and tasks. Hover a module to preview its tasks, click it to explore. Drag to move, scroll to zoom.'
  );
  readonly showClose = input(true);
  readonly legend = input<readonly ExplorerLegendItem[] | null>(null);
  readonly rootId = input<string | null>(null);
  readonly showProgressRing = input(false);
  readonly alertNodeIds = input<ReadonlySet<string>>(new Set<string>());
  readonly neutralModuleFill = input(false);
  /** Forwarded to the detail panel: no employee node, no project node, no role word. */
  readonly projectMode = input(false);
  readonly taskDotStyle = input<'tone' | 'status'>('tone');
  readonly revealSprintsOnHover = input(false);
  /** False hides the built-in details panel, for a host that shows its own card via lockChanged. */
  readonly showDetailPanel = input(true);
  /** False drops the header (title, search, fit/reset/zoom); the minimap keeps zoom controls. */
  readonly showHeader = input(true);

  readonly closed = output<void>();
  /** A project, module or task to open in Work Management. */
  readonly navigate = output<WorkGraphNode>();
  /** The node the selection locked on, or null when it was released. */
  readonly lockChanged = output<WorkGraphNode | null>();

  readonly canvas = viewChild(WorkNetworkExplorerCanvasComponent);

  /** The project/module whose tasks stay open and whose details show in the side panel. */
  readonly locked = signal<string | null>(null);
  readonly query = signal('');
  readonly focusId = signal<string | null>(null);
  private focusTimer: ReturnType<typeof setTimeout> | null = null;

  readonly legendItems = computed<readonly ExplorerLegendItem[]>(() => this.legend() ?? EMPLOYEE_LEGEND);
  readonly hits = computed(() => searchGraph(this.graph(), this.query()));
  readonly codes = computed(() =>
    new Map(buildExplorerLayout(this.graph(), this.rootId() ?? undefined).nodes.map((n) => [n.id, n.code] as const))
  );
  readonly selectedNode = computed(() => {
    const id = this.locked();
    return id ? this.graph().nodes.find((n) => n.id === id) ?? null : null;
  });
  readonly counts = computed(() => {
    const nodes = this.graph().nodes;
    const projects = nodes.filter((n) => n.kind === 'project').length;
    const modules = nodes.filter((n) => n.kind === 'module').length;
    const tasks = nodes.filter((n) => n.kind === 'task').length;
    return { projects, modules, tasks, nodes: nodes.length - tasks };
  });

  /** Esc unlocks first; returns false when there was nothing to unlock (the dialog then closes). */
  handleEscape(): boolean {
    if (this.query()) {
      this.query.set('');
      return true;
    }
    if (this.locked()) {
      this.setLocked(null);
      return true;
    }
    return false;
  }

  toggleLock(node: WorkGraphNode): void {
    if (node.kind !== 'module' && node.kind !== 'project' && node.kind !== 'sprint') return;
    this.setLocked(this.locked() === node.id ? null : node.id);
  }

  setLocked(id: string | null): void {
    if (this.locked() === id) return;
    this.locked.set(id);
    this.lockChanged.emit(this.selectedNode());
  }

  lockAndCentre(id: string): void {
    this.setLocked(id);
    this.canvas()?.centerOn(id);
    this.flash(id);
  }

  /** Back to the opening view: nothing selected, search cleared, layout replayed and fitted. */
  reset(): void {
    this.setLocked(null);
    this.query.set('');
    this.focusId.set(null);
    this.canvas()?.relayout();
  }

  pickFirst(): void {
    const first = this.hits()[0];
    if (first) this.pick(first);
  }

  /** A project/module locks and centres; a task locks the module it sits in. */
  pick(hit: SearchHit): void {
    this.query.set('');
    let target = hit.node.id;
    if (hit.node.kind === 'task') {
      for (const [parent, tasks] of tasksByParent(this.graph())) {
        if (tasks.some((t) => t.id === hit.node.id)) target = parent;
      }
    }
    this.lockAndCentre(target);
  }

  clearSearch(event: Event): void {
    if (!this.query()) return;
    event.stopPropagation();
    this.query.set('');
  }

  private flash(id: string): void {
    if (this.focusTimer) clearTimeout(this.focusTimer);
    this.focusId.set(id);
    this.focusTimer = setTimeout(() => this.focusId.set(null), FOCUS_MS);
  }
}
