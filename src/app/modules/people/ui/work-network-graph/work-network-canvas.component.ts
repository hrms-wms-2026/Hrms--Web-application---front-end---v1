import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, computed, effect, input, output, signal, viewChild } from '@angular/core';
import { Simulation } from 'd3-force';
import { CanvasGridComponent } from '../../../../shared/ui/canvas-grid/canvas-grid.component';
import { EmployeeWorkGraphResponse, WorkGraphNode } from '../../models/work-graph.model';
import { GraphLayout, GraphLink, GraphNode, createWorkGraphSimulation, layoutWorkGraph, nodeClass } from './work-graph-layout';

interface Point {
  readonly x: number;
  readonly y: number;
}

interface Camera extends Point {
  readonly scale: number;
}

const VIEW_PADDING = 60;
const CLICK_DRAG_THRESHOLD_PX = 4;
const MIN_ZOOM = 0.45;
const MAX_ZOOM = 3;

@Component({
  selector: 'app-work-network-canvas',
  standalone: true,
  imports: [CanvasGridComponent],
  template: `
    @if (interactive()) {
      <app-canvas-grid />
    }
    <svg
      #svg
      class="wgc-svg"
      [class.wgc-svg--compact]="compact()"
      [class.wgc-svg--interactive]="interactive()"
      [class.wgc-svg--animated]="animationRunning()"
      [attr.viewBox]="viewBox()"
      preserveAspectRatio="xMidYMid meet"
      role="group"
      aria-label="Work network: projects, milestones and open tasks"
      (pointerdown)="startPan($event)"
      (pointermove)="onPointerMove($event)"
      (pointerup)="endGesture()"
      (pointercancel)="endGesture()"
      (pointerleave)="endGesture()"
      (wheel)="onWheel($event)"
    >
      <g [attr.transform]="cameraTransform()">
        @for (link of links(); track linkKey(link)) {
          <line
            class="wg-link"
            [class.wg-link--dim]="isLinkDimmed(link)"
            [attr.x1]="position(link.source).x"
            [attr.y1]="position(link.source).y"
            [attr.x2]="position(link.target).x"
            [attr.y2]="position(link.target).y"
          />
        }
        @for (node of nodes(); track node.id) {
          <g
            class="wg-node"
            [class]="nodeClassOf(node)"
            [class.wg-node--dim]="isDimmed(node.id)"
            [class.wg-node--draggable]="interactive() && node.data.kind !== 'employee'"
            [attr.data-node-id]="node.id"
            [attr.transform]="transformOf(node)"
            [attr.tabindex]="interactive() ? 0 : null"
            [attr.role]="interactive() ? 'button' : null"
            [attr.aria-label]="ariaLabel(node.data)"
            (pointerenter)="hovered.set(node.id)"
            (pointerleave)="hovered.set(null)"
            (focus)="hovered.set(node.id)"
            (blur)="hovered.set(null)"
            (pointerdown)="startNodeDrag($event, node)"
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
      </g>
    </svg>
  `,
  styles: [`
    :host { position: relative; isolation: isolate; display: block; width: 100%; height: 100%; min-height: 0; }
    .wgc-svg { display: block; width: 100%; height: 100%; min-height: 360px; touch-action: none; user-select: none; }
    .wgc-svg--compact { min-height: 0; height: 220px; pointer-events: none; }
    .wgc-svg--interactive { cursor: grab; }
    .wgc-svg--interactive:active { cursor: grabbing; }
    .wg-link { stroke: var(--color-border); stroke-width: 1.5; transition: opacity 120ms; }
    .wgc-svg--animated .wg-link { stroke-width: 1.25; }
    .wg-link--dim { opacity: 0.12; }
    .wg-node { outline: none; transition: opacity 120ms; }
    .wg-node--draggable { cursor: grab; }
    .wg-node--draggable:active { cursor: grabbing; }
    .wg-node--dim { opacity: 0.18; }
    .wg-node:focus-visible circle { stroke: var(--color-accent); stroke-width: 3; }
    .wg-node circle { stroke-width: 2; }
    .wg-node--employee circle { fill: var(--color-accent); stroke: var(--color-surface); }
    .wg-node--project circle { fill: #1d4ed8; stroke: var(--color-surface); }
    .wg-node--module-owner circle { fill: #7c3aed; stroke: var(--color-surface); }
    .wg-node--module-member circle { fill: var(--color-surface); stroke: #7c3aed; stroke-width: 3; }
    .wg-node--module-contributor circle { fill: var(--color-surface); stroke: #7c3aed; stroke-width: 2; stroke-dasharray: 3 3; }
    .wg-node--task-active circle { fill: #16a34a; stroke: var(--color-surface); }
    .wg-node--task-not-started circle { fill: var(--color-text-muted); stroke: var(--color-surface); }
    .wg-initials { fill: var(--color-text-on-solid); font-size: 16px; font-weight: 700; pointer-events: none; }
    .wg-label { fill: var(--color-text-secondary); font-size: 11px; pointer-events: none; }
    .wg-label--strong { fill: var(--color-text-primary); font-size: 13px; font-weight: 600; }
    .wg-sublabel { fill: var(--color-text-secondary); font-size: 11px; pointer-events: none; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkNetworkCanvasComponent implements OnDestroy {
  readonly graph = input.required<EmployeeWorkGraphResponse>();
  readonly compact = input(false);
  readonly interactive = input(false);
  readonly animated = input(false);
  readonly nodeSelected = output<WorkGraphNode>();

  readonly hovered = signal<string | null>(null);
  readonly camera = signal<Camera>({ x: 0, y: 0, scale: 1 });
  readonly animationRunning = signal(false);

  private readonly svg = viewChild<ElementRef<SVGSVGElement>>('svg');
  private readonly layoutVersion = signal(0);
  private readonly baseViewBox = signal('-200 -150 400 300');
  private layout: GraphLayout = { nodes: [], links: [] };
  private simulation: Simulation<GraphNode, GraphLink> | null = null;
  private gesture:
    | { kind: 'node'; node: GraphNode; startClient: Point; moved: boolean }
    | { kind: 'pan'; startClient: Point; startCamera: Camera }
    | null = null;
  private suppressNextClick = false;

  readonly nodes = computed(() => {
    this.layoutVersion();
    return this.layout.nodes;
  });
  readonly links = computed(() => {
    this.layoutVersion();
    return this.layout.links;
  });
  readonly viewBox = computed(() => this.baseViewBox());
  readonly cameraTransform = computed(() => {
    const camera = this.camera();
    return `translate(${camera.x} ${camera.y}) scale(${camera.scale})`;
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

  constructor() {
    effect((onCleanup) => {
      const graph = this.graph();
      const shouldAnimate = this.animated() && !this.prefersReducedMotion();
      this.stopSimulation();
      this.layout = layoutWorkGraph(graph, shouldAnimate ? 70 : 300);
      this.baseViewBox.set(this.calculateViewBox(this.layout.nodes));
      this.camera.set({ x: 0, y: 0, scale: 1 });
      this.layoutVersion.update((version) => version + 1);

      if (shouldAnimate) {
        this.simulation = createWorkGraphSimulation(this.layout)
          .alpha(0.65)
          .alphaTarget(0)
          .on('tick', () => this.layoutVersion.update((version) => version + 1))
          .on('end', () => this.animationRunning.set(false));
        this.animationRunning.set(true);
      } else {
        this.animationRunning.set(false);
      }

      onCleanup(() => this.stopSimulation());
    });
  }

  ngOnDestroy(): void {
    this.stopSimulation();
  }

  zoomIn(): void {
    this.zoomBy(1.25);
  }

  zoomOut(): void {
    this.zoomBy(0.8);
  }

  resetView(): void {
    for (const node of this.layout.nodes) {
      if (node.data.kind !== 'employee') {
        node.fx = null;
        node.fy = null;
      }
    }
    this.camera.set({ x: 0, y: 0, scale: 1 });
    this.simulation?.alpha(0.3).restart();
  }

  nodeClassOf(node: GraphNode): string {
    return nodeClass(node.data);
  }

  linkKey(link: GraphLink): string {
    return `${link.source.id}:${link.target.id}:${link.kind}`;
  }

  position(node: GraphNode): Point {
    this.layoutVersion();
    return { x: node.x ?? 0, y: node.y ?? 0 };
  }

  transformOf(node: GraphNode): string {
    const point = this.position(node);
    return `translate(${point.x},${point.y})`;
  }

  isDimmed(id: string): boolean {
    const neighbours = this.neighbours();
    return neighbours !== null && !neighbours.has(id);
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
        return `Milestone ${node.label}, ${node.role ?? 'contributor'}`;
      default:
        return `Task ${node.sublabel ?? ''} ${node.label}, ${node.status === 'active' ? 'active' : 'not started'}`.trim();
    }
  }

  onNodeClick(node: GraphNode): void {
    if (!this.interactive()) return;
    if (this.suppressNextClick) {
      this.suppressNextClick = false;
      return;
    }
    if (node.data.kind !== 'employee') this.nodeSelected.emit(node.data);
  }

  startNodeDrag(event: PointerEvent, node: GraphNode): void {
    if (!this.interactive() || node.data.kind === 'employee') return;
    event.stopPropagation();
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    this.gesture = { kind: 'node', node, startClient: { x: event.clientX, y: event.clientY }, moved: false };
    this.suppressNextClick = false;
  }

  startPan(event: PointerEvent): void {
    if (!this.interactive() || event.target !== event.currentTarget) return;
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    this.gesture = {
      kind: 'pan',
      startClient: { x: event.clientX, y: event.clientY },
      startCamera: this.camera()
    };
  }

  onPointerMove(event: PointerEvent): void {
    const gesture = this.gesture;
    if (!gesture) return;

    if (gesture.kind === 'pan') {
      const svg = this.svg()?.nativeElement;
      if (!svg) return;
      const box = svg.getBoundingClientRect();
      const viewBox = this.viewBoxNumbers();
      const dx = (event.clientX - gesture.startClient.x) * (viewBox.width / Math.max(box.width, 1));
      const dy = (event.clientY - gesture.startClient.y) * (viewBox.height / Math.max(box.height, 1));
      this.camera.set({ ...gesture.startCamera, x: gesture.startCamera.x + dx, y: gesture.startCamera.y + dy });
      return;
    }

    if (!gesture.moved) {
      const dx = event.clientX - gesture.startClient.x;
      const dy = event.clientY - gesture.startClient.y;
      if (Math.hypot(dx, dy) < CLICK_DRAG_THRESHOLD_PX) return;
      gesture.moved = true;
    }
    const point = this.toGraphPoint(event);
    if (!point) return;
    gesture.node.fx = point.x;
    gesture.node.fy = point.y;
    gesture.node.x = point.x;
    gesture.node.y = point.y;
    this.layoutVersion.update((version) => version + 1);
    this.simulation?.alpha(0.2).restart();
  }

  endGesture(): void {
    if (this.gesture?.kind === 'node' && this.gesture.moved) this.suppressNextClick = true;
    this.gesture = null;
  }

  onWheel(event: WheelEvent): void {
    if (!this.interactive()) return;
    event.preventDefault();
    const anchor = this.toSvgPoint(event.clientX, event.clientY);
    if (!anchor) return;
    this.zoomBy(event.deltaY < 0 ? 1.12 : 0.89, anchor);
  }

  private zoomBy(factor: number, anchor?: Point): void {
    const camera = this.camera();
    const scale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, camera.scale * factor));
    const centre = anchor ?? this.viewBoxCentre();
    const ratio = scale / camera.scale;
    this.camera.set({
      scale,
      x: centre.x - (centre.x - camera.x) * ratio,
      y: centre.y - (centre.y - camera.y) * ratio
    });
  }

  private calculateViewBox(nodes: readonly GraphNode[]): string {
    if (nodes.length === 0) return '-200 -150 400 300';
    const minX = Math.min(...nodes.map((node) => (node.x ?? 0) - node.radius)) - VIEW_PADDING;
    const maxX = Math.max(...nodes.map((node) => (node.x ?? 0) + node.radius)) + VIEW_PADDING;
    const minY = Math.min(...nodes.map((node) => (node.y ?? 0) - node.radius)) - VIEW_PADDING;
    const maxY = Math.max(...nodes.map((node) => (node.y ?? 0) + node.radius)) + VIEW_PADDING + 24;
    return `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
  }

  private viewBoxNumbers(): { x: number; y: number; width: number; height: number } {
    const [x, y, width, height] = this.viewBox().split(' ').map(Number);
    return { x, y, width, height };
  }

  private viewBoxCentre(): Point {
    const box = this.viewBoxNumbers();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }

  private toSvgPoint(clientX: number, clientY: number): Point | null {
    const svg = this.svg()?.nativeElement;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const local = point.matrixTransform(ctm.inverse());
    return { x: local.x, y: local.y };
  }

  private toGraphPoint(event: PointerEvent): Point | null {
    const point = this.toSvgPoint(event.clientX, event.clientY);
    if (!point) return null;
    const camera = this.camera();
    return { x: (point.x - camera.x) / camera.scale, y: (point.y - camera.y) / camera.scale };
  }

  private prefersReducedMotion(): boolean {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;
  }

  private stopSimulation(): void {
    this.simulation?.stop();
    this.simulation = null;
    this.animationRunning.set(false);
  }
}
