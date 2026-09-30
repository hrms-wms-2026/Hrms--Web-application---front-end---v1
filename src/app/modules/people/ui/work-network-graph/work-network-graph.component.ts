import { ChangeDetectionStrategy, Component, ElementRef, computed, input, output, signal, viewChild } from '@angular/core';
import { EmployeeWorkGraphResponse, WorkGraphNode } from '../../models/work-graph.model';
import { GraphLink, GraphNode, layoutWorkGraph, nodeClass } from './work-graph-layout';

interface Point {
  readonly x: number;
  readonly y: number;
}

const VIEW_PADDING = 60;
const CLICK_DRAG_THRESHOLD_PX = 4;

/**
 * Obsidian-style network centred on one employee: he is pinned in the middle, projects orbit him,
 * modules hang off projects (solid = owns, outlined = member, dashed = only has tasks there),
 * and his open tasks hang off their module. Layout is a synchronous d3-force settle; nodes can be
 * dragged and stay where dropped. Rendered as Angular-owned SVG so nodes are focusable.
 */
@Component({
  selector: 'app-work-network-graph',
  standalone: true,
  template: `
    <div class="wg-wrap">
      <svg
        #svg
        class="wg-svg"
        [attr.viewBox]="viewBox()"
        preserveAspectRatio="xMidYMid meet"
        role="group"
        aria-label="Work network: projects, modules and open tasks"
        (pointermove)="onPointerMove($event)"
        (pointerup)="endDrag()"
        (pointerleave)="endDrag()"
      >
        @for (link of links(); track $index) {
          <line
            class="wg-link"
            [class.wg-link--dim]="isLinkDimmed(link)"
            [attr.x1]="pos(link.source).x"
            [attr.y1]="pos(link.source).y"
            [attr.x2]="pos(link.target).x"
            [attr.y2]="pos(link.target).y"
          />
        }
        @for (node of nodes(); track node.id) {
          <g
            class="wg-node"
            [class]="nodeClassOf(node)"
            [class.wg-node--dim]="isDimmed(node.id)"
            [attr.data-node-id]="node.id"
            [attr.transform]="transformOf(node)"
            tabindex="0"
            role="button"
            [attr.aria-label]="ariaLabel(node.data)"
            (pointerenter)="hovered.set(node.id)"
            (pointerleave)="hovered.set(null)"
            (focus)="hovered.set(node.id)"
            (blur)="hovered.set(null)"
            (pointerdown)="startDrag($event, node)"
            (click)="onNodeClick(node)"
            (keydown.enter)="onNodeClick(node)"
          >
            <circle [attr.r]="node.radius" />
            @if (node.data.kind === 'employee') {
              <text class="wg-initials" text-anchor="middle" dy="0.35em">{{ initials(node.data.label) }}</text>
              <text class="wg-label wg-label--strong" text-anchor="middle" [attr.y]="node.radius + 16">{{ node.data.label }}</text>
              @if (node.data.sublabel) {
                <text class="wg-sublabel" text-anchor="middle" [attr.y]="node.radius + 31">{{ node.data.sublabel }}</text>
              }
            } @else {
              <text class="wg-label" text-anchor="middle" [attr.y]="node.radius + 13">{{ shortLabel(node.data.label) }}</text>
            }
          </g>
        }
      </svg>

      <ul class="wg-legend" aria-label="Legend">
        <li><span class="wg-key wg-key--project"></span>Project</li>
        <li><span class="wg-key wg-key--owner"></span>Module you own</li>
        <li><span class="wg-key wg-key--member"></span>Module member</li>
        <li><span class="wg-key wg-key--active"></span>Active task</li>
        <li><span class="wg-key wg-key--not-started"></span>Not started task</li>
      </ul>

      @if (graph().hiddenTaskCount > 0) {
        <p class="wg-note">+{{ graph().hiddenTaskCount }} more tasks not shown</p>
      }
    </div>
  `,
  styles: [`
    .wg-wrap { display: flex; flex-direction: column; gap: 0.5rem; }
    .wg-svg { width: 100%; height: 460px; touch-action: none; user-select: none; }
    .wg-link { stroke: var(--color-border); stroke-width: 1.5; transition: opacity 120ms; }
    .wg-link--dim { opacity: 0.12; }
    .wg-node { cursor: pointer; outline: none; transition: opacity 120ms; }
    .wg-node--dim { opacity: 0.18; }
    .wg-node:focus-visible circle { stroke: var(--color-accent); stroke-width: 3; }
    .wg-node circle { stroke-width: 2; }
    .wg-node--employee circle { fill: var(--color-accent); stroke: var(--color-surface); }
    .wg-node--project circle { fill: #1d4ed8; stroke: var(--color-surface); }
    .wg-node--module-owner circle { fill: #7c3aed; stroke: var(--color-surface); }
    .wg-node--module-member circle { fill: var(--color-surface); stroke: #7c3aed; stroke-width: 3; }
    .wg-node--module-contributor circle { fill: var(--color-surface); stroke: #7c3aed; stroke-width: 2; stroke-dasharray: 3 3; }
    .wg-node--task-active circle { fill: #16a34a; stroke: var(--color-surface); }
    .wg-node--task-not-started circle { fill: #94a3b8; stroke: var(--color-surface); }
    .wg-initials { fill: #fff; font-size: 16px; font-weight: 700; pointer-events: none; }
    .wg-label { fill: var(--color-text-secondary); font-size: 11px; pointer-events: none; }
    .wg-label--strong { fill: var(--color-text-primary); font-size: 13px; font-weight: 600; }
    .wg-sublabel { fill: var(--color-text-secondary); font-size: 11px; pointer-events: none; }
    .wg-legend { display: flex; flex-wrap: wrap; gap: 0.75rem 1.25rem; font-size: 0.75rem; color: var(--color-text-secondary); list-style: none; padding: 0; margin: 0; }
    .wg-legend li { display: inline-flex; align-items: center; gap: 0.375rem; }
    .wg-key { width: 0.75rem; height: 0.75rem; border-radius: 9999px; display: inline-block; border: 2px solid transparent; }
    .wg-key--project { background: #1d4ed8; }
    .wg-key--owner { background: #7c3aed; }
    .wg-key--member { border-color: #7c3aed; }
    .wg-key--active { background: #16a34a; }
    .wg-key--not-started { background: #94a3b8; }
    .wg-note { font-size: 0.75rem; color: var(--color-text-secondary); margin: 0; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkNetworkGraphComponent {
  readonly graph = input.required<EmployeeWorkGraphResponse>();
  readonly nodeSelected = output<WorkGraphNode>();

  readonly hovered = signal<string | null>(null);
  private readonly overrides = signal<Readonly<Record<string, Point>>>({});
  private readonly svg = viewChild<ElementRef<SVGSVGElement>>('svg');

  private drag: { node: GraphNode; startClient: Point; moved: boolean } | null = null;
  private suppressNextClick = false;

  private readonly layout = computed(() => layoutWorkGraph(this.graph()));
  readonly nodes = computed(() => this.layout().nodes);
  readonly links = computed(() => this.layout().links);

  /** Fixed to the settled layout (not drag overrides) so dragging never rescales the view. */
  readonly viewBox = computed(() => {
    const nodes = this.nodes();
    if (nodes.length === 0) return '-200 -150 400 300';
    const minX = Math.min(...nodes.map((n) => (n.x ?? 0) - n.radius)) - VIEW_PADDING;
    const maxX = Math.max(...nodes.map((n) => (n.x ?? 0) + n.radius)) + VIEW_PADDING;
    const minY = Math.min(...nodes.map((n) => (n.y ?? 0) - n.radius)) - VIEW_PADDING;
    const maxY = Math.max(...nodes.map((n) => (n.y ?? 0) + n.radius)) + VIEW_PADDING + 24;
    return `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
  });

  private readonly neighbours = computed(() => {
    const id = this.hovered();
    if (id === null) return null;
    const set = new Set<string>([id]);
    for (const link of this.links()) {
      if (link.source.id === id) set.add(link.target.id);
      if (link.target.id === id) set.add(link.source.id);
    }
    return set;
  });

  nodeClassOf(node: GraphNode): string {
    return nodeClass(node.data);
  }

  pos(node: GraphNode): Point {
    return this.overrides()[node.id] ?? { x: node.x ?? 0, y: node.y ?? 0 };
  }

  transformOf(node: GraphNode): string {
    const p = this.pos(node);
    return `translate(${p.x},${p.y})`;
  }

  isDimmed(id: string): boolean {
    const n = this.neighbours();
    return n !== null && !n.has(id);
  }

  isLinkDimmed(link: GraphLink): boolean {
    const id = this.hovered();
    return id !== null && link.source.id !== id && link.target.id !== id;
  }

  initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || 'EM';
  }

  shortLabel(label: string, max = 22): string {
    return label.length > max ? `${label.slice(0, max - 1)}…` : label;
  }

  ariaLabel(node: WorkGraphNode): string {
    switch (node.kind) {
      case 'employee':
        return `${node.label}, ${node.sublabel ?? 'no position'}`;
      case 'project':
        return `Project ${node.label}`;
      case 'module':
        return `Module ${node.label}, ${node.role ?? 'contributor'}`;
      default:
        return `Task ${node.sublabel ?? ''} ${node.label}, ${node.status === 'active' ? 'active' : 'not started'}`.trim();
    }
  }

  onNodeClick(node: GraphNode): void {
    if (this.suppressNextClick) {
      this.suppressNextClick = false;
      return;
    }
    if (node.data.kind === 'employee') return;
    this.nodeSelected.emit(node.data);
  }

  startDrag(event: PointerEvent, node: GraphNode): void {
    if (node.data.kind === 'employee') return;
    this.drag = { node, startClient: { x: event.clientX, y: event.clientY }, moved: false };
    this.suppressNextClick = false;
  }

  onPointerMove(event: PointerEvent): void {
    const drag = this.drag;
    if (!drag) return;

    if (!drag.moved) {
      const dx = event.clientX - drag.startClient.x;
      const dy = event.clientY - drag.startClient.y;
      if (Math.hypot(dx, dy) < CLICK_DRAG_THRESHOLD_PX) return;
      drag.moved = true;
    }
    const point = this.toSvgPoint(event);
    if (!point) return;
    this.overrides.update((current) => ({ ...current, [drag.node.id]: point }));
  }

  endDrag(): void {
    if (this.drag?.moved) this.suppressNextClick = true;
    this.drag = null;
  }

  private toSvgPoint(event: PointerEvent): Point | null {
    const svg = this.svg()?.nativeElement;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const p = svg.createSVGPoint();
    p.x = event.clientX;
    p.y = event.clientY;
    const local = p.matrixTransform(ctm.inverse());
    return { x: local.x, y: local.y };
  }
}
