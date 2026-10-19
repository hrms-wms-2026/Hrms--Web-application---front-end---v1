import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { Simulation } from 'd3-force';
import { CanvasGridComponent } from '../../../../../shared/ui/canvas-grid/canvas-grid.component';
import {
  CanvasBox,
  CanvasMinimapComponent,
  CanvasMinimapItem,
  CanvasMinimapLink,
  CanvasPoint
} from '../../../../../shared/ui/canvas-minimap/canvas-minimap.component';
import { ProjectApiService } from '../../../../work/data-access/project-api.service';
import { EmployeeDirectoryStore } from '../../../../work/state/employee-directory.store';
import { EmployeeWorkGraphResponse, WorkGraphNode } from '../../../models/work-graph.model';
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  CardPlacement,
  ExplorerLayout,
  ExplorerLink,
  ExplorerNode,
  MAX_CARDS,
  TASK_TONE_LABELS,
  TaskTone,
  buildExplorerLayout,
  createExplorerSimulation,
  placeCards,
  progressPercent,
  settleExplorerLayout,
  shorten,
  taskStatusDot,
  taskTone,
  tasksByParent
} from './explorer-layout';

type Point = CanvasPoint;
type Box = CanvasBox;
interface Camera extends Point { readonly scale: number; }

interface RenderedCard {
  readonly key: string;
  readonly task: WorkGraphNode | null;
  /** "+N more" card when the parent has more tasks than fit. */
  readonly moreCount: number;
  readonly x: number;
  readonly y: number;
  readonly side: 1 | -1;
  readonly tone: TaskTone | null;
  readonly path: string;
}

const MIN_ZOOM = 0.35;
const MAX_ZOOM = 2.5;
const VIEW_PADDING = 70;
const DRAG_THRESHOLD_PX = 4;
/** Grace period for moving the pointer from a module onto its preview cards. */
const PREVIEW_LEAVE_MS = 260;
const TWEEN_CAMERA_MS = 320;
const TWEEN_LAYOUT_MS = 650;

/**
 * The full Work Network drawing: employee in the centre, projects and modules around it, and task
 * cards beside a module that is hovered (preview) or locked (click). Locking pins the module and
 * drops invisible spacers where its cards go, so neighbouring nodes ease out of the way.
 */
@Component({
  selector: 'app-work-network-explorer-canvas',
  standalone: true,
  imports: [CanvasGridComponent, CanvasMinimapComponent],
  template: `
    <app-canvas-grid />
    <svg
      #svg
      class="wgx-svg"
      [attr.viewBox]="baseViewBox()"
      preserveAspectRatio="xMidYMid meet"
      role="group"
      aria-label="Work network"
      (pointerdown)="startPan($event)"
      (pointermove)="onPointerMove($event)"
      (pointerup)="endPan($event)"
      (pointercancel)="endPan($event)"
      (wheel)="onWheel($event)"
    >
      <defs>
        <radialGradient id="wgx-employee" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stop-color="#3b82f6" /><stop offset="100%" stop-color="#1d4ed8" />
        </radialGradient>
        <radialGradient id="wgx-project" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stop-color="#4f8bff" /><stop offset="100%" stop-color="#2563eb" />
        </radialGradient>
        <radialGradient id="wgx-module" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stop-color="#a26bff" /><stop offset="100%" stop-color="#7c3aed" />
        </radialGradient>
        <linearGradient id="wgx-works-on" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#60a5fa" /><stop offset="100%" stop-color="#a78bfa" />
        </linearGradient>
      </defs>

      <g [attr.transform]="cameraTransform()">
        @for (link of links(); track link.source.id + link.target.id) {
          <path
            class="wgx-link"
            [class]="'wgx-link wgx-link--' + link.kind"
            [class.wgx-link--dim]="isLinkDimmed(link)"
            [class.wgx-link--lit]="isLinkLit(link)"
            [attr.d]="linkPath(link)"
          />
        }

        @for (card of cards(); track card.key) {
          <path class="wgx-connector" [class.wgx-connector--locked]="!!locked()" [attr.d]="card.path" />
        }

        @for (node of visibleNodes(); track node.id; let i = $index) {
          <g
            class="wgx-node"
            [class]="'wgx-node wgx-node--' + kindClass(node)"
            [class.wgx-node--dim]="isDimmed(node)"
            [class.wgx-node--locked]="locked() === node.id"
            [class.wgx-node--focus]="focusId() === node.id"
            [class.wgx-node--alert]="hasAlert(node)"
            [attr.data-node-id]="node.id"
            [attr.transform]="'translate(' + node.x + ',' + node.y + ')'"
            [style.animation-delay.ms]="enterDelay(node)"
            tabindex="0"
            role="button"
            [attr.aria-label]="ariaLabel(node)"
            [attr.aria-pressed]="node.data.kind === 'employee' ? null : locked() === node.id"
            (pointerenter)="onNodeEnter(node)"
            (pointerleave)="onNodeLeave()"
            (focus)="onNodeEnter(node)"
            (blur)="onNodeLeave()"
            (click)="onNodeClick($event, node)"
            (keydown.enter)="onNodeClick($event, node)"
          >
            <title>{{ node.data.label }}</title>
            <g class="wgx-node__body">
              <circle class="wgx-halo" [attr.r]="node.radius + 9" />
              @if (showProgressRing() && node.data.kind === 'module') {
                <circle class="wgx-ring-track" [attr.r]="ringRadius(node)" />
                <circle
                  class="wgx-ring-fill"
                  [attr.r]="ringRadius(node)"
                  [attr.stroke-dasharray]="ringDash(node)"
                  transform="rotate(-90)"
                >
                  <title>{{ progressOf(node) }}% of allocated hours completed</title>
                </circle>
              }
              <circle class="wgx-core" [attr.r]="node.radius" />
              @if (imageOf(node); as src) {
                <!-- Photo / project logo; the coloured circle and code underneath stay as the placeholder. -->
                <clipPath [attr.id]="clipId(node)"><circle [attr.r]="node.radius - 2" /></clipPath>
                <image
                  class="wgx-photo"
                  [attr.href]="src"
                  [attr.x]="-(node.radius - 2)"
                  [attr.y]="-(node.radius - 2)"
                  [attr.width]="(node.radius - 2) * 2"
                  [attr.height]="(node.radius - 2) * 2"
                  preserveAspectRatio="xMidYMid slice"
                  [attr.clip-path]="'url(#' + clipId(node) + ')'"
                  (error)="markBroken(src)"
                />
              } @else if (node.data.kind === 'project') {
                <g class="wgx-icon" transform="translate(-6,-15)">
                  <path d="M1 1h7l4 4v8H1z" />
                </g>
                <text class="wgx-code" text-anchor="middle" dy="0.95em" y="-2">{{ node.code }}</text>
              } @else {
                <text class="wgx-code" text-anchor="middle" dy="0.35em">{{ node.code }}</text>
              }
              @if (badgeOf(node); as badge) {
                <g class="wgx-badge" [attr.transform]="'translate(' + node.radius * 0.74 + ',' + -node.radius * 0.74 + ')'">
                  <title>{{ badgeTitle(node, badge) }}</title>
                  <circle r="9" />
                  <text text-anchor="middle" dy="0.35em">{{ badge }}</text>
                </g>
              }
            </g>
            @switch (node.data.kind) {
              @case ('employee') {
                <text class="wgx-label wgx-label--hero" text-anchor="middle" [attr.y]="node.radius + 22">{{ node.data.label }}</text>
                @if (node.data.sublabel) {
                  <text class="wgx-sub" text-anchor="middle" [attr.y]="node.radius + 39">{{ node.data.sublabel }}</text>
                }
              }
              @case ('project') {
                <text class="wgx-label wgx-label--strong" text-anchor="middle" [attr.y]="node.radius + 20">{{ short(node.data.label, 28) }}</text>
                <text class="wgx-sub" text-anchor="middle" [attr.y]="node.radius + 36">{{ projectSummary(node) }}</text>
                <g [attr.transform]="'translate(-58,' + (node.radius + 46) + ')'">
                  <rect class="wgx-bar-track" width="86" height="5" rx="2.5" />
                  <rect class="wgx-bar-fill" [attr.width]="0.86 * progressOf(node)" height="5" rx="2.5" [class.wgx-bar-fill--low]="progressOf(node) < 35" />
                  <text class="wgx-pct" x="94" y="5">{{ progressOf(node) }}%</text>
                </g>
              }
              @default {
                <text class="wgx-label" text-anchor="middle" [attr.y]="node.radius + 18">{{ short(node.data.label, 24) }}</text>
                <text class="wgx-sub" text-anchor="middle" [attr.y]="node.radius + 33">{{ moduleSummary(node) }}</text>
              }
            }
          </g>
        }

        @for (card of cards(); track card.key) {
          <g
            class="wgx-card"
            [class.wgx-card--more]="!card.task"
            [attr.transform]="'translate(' + (card.x - cardW / 2) + ',' + (card.y - cardH / 2) + ')'"
            [attr.data-task-id]="card.task?.id ?? null"
            [attr.tabindex]="card.task ? 0 : null"
            [attr.role]="card.task ? 'button' : null"
            [attr.aria-label]="card.task ? 'Task ' + card.task.label + ', ' + toneLabel(card.tone) : null"
            (pointerenter)="onCardEnter()"
            (pointerleave)="onNodeLeave()"
            (click)="onCardClick($event, card)"
            (keydown.enter)="onCardClick($event, card)"
          >
            <rect class="wgx-card__box" [attr.width]="cardW" [attr.height]="cardH" rx="9" />
            @if (card.task; as task) {
              <title>{{ task.label }}</title>
              <circle [class]="cardDotClass(card)" cx="16" [attr.cy]="cardH / 2" r="5" />
              <text class="wgx-card__title" x="30" y="17">{{ short(task.label, 22) }}</text>
              <text class="wgx-card__code" x="30" y="32">{{ task.sublabel }}</text>
            } @else {
              <text class="wgx-card__title" [attr.x]="cardW / 2" [attr.y]="cardH / 2" dy="0.35em" text-anchor="middle">+{{ card.moreCount }} more tasks</text>
            }
          </g>
        }
      </g>
    </svg>

    <app-canvas-minimap
      label="Work network overview"
      [world]="worldBox()"
      [items]="miniItems()"
      [links]="miniLinks()"
      [viewport]="visibleBox()"
      [canZoomIn]="camera().scale < maxZoom"
      [canZoomOut]="camera().scale > minZoom"
      (navigate)="centerOnPoint($event)"
      (zoomIn)="zoomIn()"
      (zoomOut)="zoomOut()"
      (fit)="fit()"
    />
  `,
  styles: [`
    :host { position: relative; isolation: isolate; display: block; width: 100%; height: 100%; min-height: 0; overflow: hidden; }
    .wgx-svg { display: block; width: 100%; height: 100%; touch-action: none; user-select: none; cursor: grab; }
    .wgx-svg:active { cursor: grabbing; }

    .wgx-link { fill: none; stroke-linecap: round; transition: opacity 180ms, stroke-width 180ms; }
    .wgx-link--works_on { stroke: url(#wgx-works-on); stroke-width: 2.4; opacity: 0.75; }
    .wgx-link--contains { stroke: #c4b5fd; stroke-width: 1.6; opacity: 0.85; }
    .wgx-link--dim { opacity: 0.12; }
    .wgx-link--lit { opacity: 1; stroke-width: 3; }
    .wgx-connector { fill: none; stroke: #c084fc; stroke-width: 1.4; stroke-dasharray: 4 4; opacity: 0.8; animation: wgx-fade 200ms ease-out both; }
    .wgx-connector--locked { opacity: 1; }

    .wgx-node { cursor: pointer; outline: none; transition: opacity 180ms; animation: wgx-pop 420ms cubic-bezier(0.16, 1, 0.3, 1) both; }
    .wgx-node__body { transition: transform 180ms ease-out; transform-box: fill-box; transform-origin: center; }
    .wgx-node:hover .wgx-node__body, .wgx-node:focus-visible .wgx-node__body { transform: scale(1.06); }
    .wgx-node--dim { opacity: 0.32; }
    .wgx-halo { fill: currentColor; opacity: 0.12; transition: opacity 180ms; }
    .wgx-node:hover .wgx-halo, .wgx-node--locked .wgx-halo { opacity: 0.26; }
    .wgx-node--locked .wgx-core { stroke: #fff; stroke-width: 3; }
    .wgx-node--focus .wgx-halo { animation: wgx-ping 900ms ease-out 2; }
    .wgx-node--employee { color: #2563eb; }
    .wgx-node--employee .wgx-core { fill: url(#wgx-employee); }
    .wgx-node--project { color: #3b82f6; }
    .wgx-node--project .wgx-core { fill: url(#wgx-project); }
    .wgx-node--module-owner { color: #8b5cf6; }
    .wgx-node--module-owner .wgx-core { fill: url(#wgx-module); }
    .wgx-node--module-member, .wgx-node--module-contributor { color: #8b5cf6; }
    .wgx-node--module-member .wgx-core { fill: #fff; stroke: #8b5cf6; stroke-width: 3; }
    .wgx-node--module-contributor .wgx-core { fill: #fff; stroke: #8b5cf6; stroke-width: 2; stroke-dasharray: 4 3; }
    .wgx-code { fill: #fff; font-size: 14px; font-weight: 700; pointer-events: none; }
    .wgx-node--employee .wgx-code { font-size: 20px; }
    .wgx-node--module-member .wgx-code, .wgx-node--module-contributor .wgx-code { fill: #7c3aed; }
    /* Project mode: modules are not viewer-relative - one purple fill for all of them, and blue for
       the project's default (root) module. */
    .wgx-node--module-neutral { color: #8b5cf6; }
    .wgx-node--module-neutral .wgx-core { fill: url(#wgx-module); }
    .wgx-node--module-default { color: #2563eb; }
    .wgx-node--module-default .wgx-core { fill: url(#wgx-project); }
    /* Project mode sprints (purple): active = empty, draft = filled, complete/achieved = gray. */
    .wgx-node--sprint-active, .wgx-node--sprint-draft { color: #8b5cf6; }
    .wgx-node--sprint-active .wgx-core { fill: #fff; stroke: #8b5cf6; stroke-width: 3; }
    .wgx-node--sprint-active .wgx-code { fill: #7c3aed; }
    .wgx-node--sprint-draft .wgx-core { fill: url(#wgx-module); }
    .wgx-node--sprint-done { color: #94a3b8; }
    .wgx-node--sprint-done .wgx-core { fill: #cbd5e1; }
    /* Project mode task status dots (light blue): not started = empty, started = filled, done = gray. */
    .wgx-dot--empty { fill: #fff; stroke: #38bdf8; stroke-width: 2; }
    .wgx-dot--filled { fill: #38bdf8; }
    .wgx-dot--done { fill: #cbd5e1; }
    /* A module the project monitor raised an alert on - the tree's red dot, as a whole circle. */
    .wgx-node--alert .wgx-core { fill: #ef4444; stroke: #b91c1c; stroke-width: 2; stroke-dasharray: none; }
    .wgx-node--alert .wgx-code { fill: #fff; }
    .wgx-ring-track { fill: none; stroke: #e2e8f0; stroke-width: 4; }
    .wgx-ring-fill { fill: none; stroke: currentColor; stroke-width: 4; stroke-linecap: round; }
    .wgx-icon path { fill: rgb(255 255 255 / 0.9); }
    .wgx-photo { pointer-events: none; }
    .wgx-badge circle { fill: #fff; stroke: #c7d2fe; stroke-width: 1; }
    .wgx-badge text { fill: #1e3a8a; font-size: 10px; font-weight: 700; }
    .wgx-label { fill: var(--color-text-primary); font-size: 12px; font-weight: 600; pointer-events: none; }
    .wgx-label--strong { font-size: 12.5px; font-weight: 700; }
    .wgx-label--hero { font-size: 14px; font-weight: 700; }
    .wgx-sub { fill: var(--color-text-secondary); font-size: 10.5px; pointer-events: none; }
    .wgx-bar-track { fill: #e2e8f0; }
    .wgx-bar-fill { fill: #22c55e; transition: width 400ms ease-out; }
    .wgx-bar-fill--low { fill: #f59e0b; }
    .wgx-pct { fill: var(--color-text-secondary); font-size: 10px; font-weight: 600; }

    .wgx-card { cursor: pointer; outline: none; animation: wgx-card-in 260ms cubic-bezier(0.16, 1, 0.3, 1) both; }
    .wgx-card--more { cursor: default; }
    .wgx-card__box { fill: var(--color-surface); stroke: #e2e8f0; filter: drop-shadow(0 2px 4px rgb(15 23 42 / 0.08)); transition: stroke 150ms; }
    .wgx-card:hover .wgx-card__box, .wgx-card:focus-visible .wgx-card__box { stroke: #a78bfa; }
    .wgx-card__title { fill: var(--color-text-primary); font-size: 11px; font-weight: 600; pointer-events: none; }
    .wgx-card__code { fill: var(--color-text-secondary); font-size: 10px; pointer-events: none; }
    .wgx-tone--progress { fill: #2563eb; }
    .wgx-tone--not-started { fill: #94a3b8; }
    .wgx-tone--overdue { fill: #ef4444; }

    @keyframes wgx-pop { from { opacity: 0; transform: scale(0.6); } }
    @keyframes wgx-card-in { from { opacity: 0; } }
    @keyframes wgx-fade { from { opacity: 0; } }
    @keyframes wgx-ping { 0% { opacity: 0.5; } 100% { opacity: 0.12; } }
    @media (prefers-reduced-motion: reduce) {
      .wgx-node, .wgx-card, .wgx-connector, .wgx-node--focus .wgx-halo { animation: none; }
      .wgx-node__body, .wgx-link, .wgx-bar-fill { transition: none; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkNetworkExplorerCanvasComponent implements OnDestroy {
  private readonly directory = inject(EmployeeDirectoryStore);
  private readonly projectApi = inject(ProjectApiService);
  readonly graph = input.required<EmployeeWorkGraphResponse>();
  /** The module/project whose task cards stay open (click to lock). */
  readonly locked = input<string | null>(null);
  /** A node to highlight briefly (search result). */
  readonly focusId = input<string | null>(null);
  readonly animated = input(true);
  /**
   * Project mode. All four default to the employee-rooted behaviour, so the employee Work Network
   * passes none of them and renders exactly as it did before they existed.
   */
  readonly rootId = input<string | null>(null);
  /** Draws each module's completed/allocated share as a ring on the circle's outline. */
  readonly showProgressRing = input(false);
  /** Nodes whose circle is drawn in the alert colour (the red dots of the Work Management tree). */
  readonly alertNodeIds = input<ReadonlySet<string>>(new Set<string>());
  /** Modules with no viewer-relative role draw in one neutral fill instead of the contributor one. */
  readonly neutralModuleFill = input(false);
  /** 'status': task card dots show light-blue empty / filled / gray-done instead of the tone colour. */
  readonly taskDotStyle = input<'tone' | 'status'>('tone');
  /** Sprints stay hidden until their module is hovered or locked (project graph only). */
  readonly revealSprintsOnHover = input(false);

  readonly nodeClicked = output<WorkGraphNode>();
  readonly taskClicked = output<WorkGraphNode>();
  readonly backgroundClicked = output<void>();

  readonly cardW = CARD_WIDTH;
  readonly cardH = CARD_HEIGHT;
  readonly minZoom = MIN_ZOOM;
  readonly maxZoom = MAX_ZOOM;

  readonly hovered = signal<string | null>(null);
  /** Image URLs that failed to load (no access, deleted file): those nodes keep the placeholder. */
  private readonly brokenImages = signal<ReadonlySet<string>>(new Set());
  /** The module/project previewed by hover (cards shown, nothing moves). */
  readonly previewed = signal<string | null>(null);
  readonly camera = signal<Camera>({ x: 0, y: 0, scale: 1 });
  readonly baseViewBox = signal('-400 -300 800 600');

  private readonly svg = viewChild<ElementRef<SVGSVGElement>>('svg');
  private readonly version = signal(0);
  private layout: ExplorerLayout = { nodes: [], links: [] };
  private simulation: Simulation<ExplorerNode, ExplorerLink> | null = null;
  private previewTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly frames = new Set<number>();
  private cameraTween: (() => void) | null = null;
  private pan: { startClient: Point; startCamera: Camera; moved: boolean; pointerId: number } | null = null;

  readonly tasks = computed(() => tasksByParent(this.graph()));
  private readonly employeeId = computed(() => {
    const node = this.graph().nodes.find((n) => n.kind === 'employee');
    return node ? node.id.replace(/^employee:/, '') : null;
  });

  /** Project mode: each sprint's parent modules, from the graph's module -> sprint links. */
  private readonly sprintParents = computed(() => {
    const parents = new Map<string, Set<string>>();
    for (const link of this.graph().links) {
      if (link.kind !== 'contains' || !link.target.startsWith('sprint:')) continue;
      parents.set(link.target, (parents.get(link.target) ?? new Set()).add(link.source));
    }
    return parents;
  });

  /**
   * With revealSprintsOnHover, the sprints on screen: those of the module that is hovered or locked,
   * or the siblings of a sprint that is (so moving from a module onto one of its sprints keeps the
   * rest). Null means "no filtering" - every sprint is drawn, as it always was.
   */
  private readonly openSprints = computed<ReadonlySet<string> | null>(() => {
    if (!this.revealSprintsOnHover()) return null;
    const parents = this.sprintParents();
    const modules = new Set<string>();
    for (const id of [this.locked(), this.previewed()]) {
      if (!id) continue;
      if (id.startsWith('sprint:')) parents.get(id)?.forEach((m) => modules.add(m));
      else modules.add(id);
    }
    const open = new Set<string>();
    for (const [sprintId, sprintModules] of parents) {
      if ([...sprintModules].some((m) => modules.has(m))) open.add(sprintId);
    }
    return open;
  });

  private isHiddenSprint(node: ExplorerNode, open: ReadonlySet<string> | null): boolean {
    return open !== null && node.data.kind === 'sprint' && !open.has(node.id);
  }

  readonly visibleNodes = computed(() => {
    this.version();
    const open = this.openSprints();
    return this.layout.nodes.filter((n) => !n.spacer && !this.isHiddenSprint(n, open));
  });
  readonly links = computed(() => {
    this.version();
    const open = this.openSprints();
    return this.layout.links.filter((l) => !this.isHiddenSprint(l.source, open) && !this.isHiddenSprint(l.target, open));
  });

  /** Locked parent wins; otherwise whatever is being previewed. */
  readonly revealed = computed(() => this.locked() ?? this.previewed());

  readonly cards = computed<RenderedCard[]>(() => {
    this.version();
    const parentId = this.revealed();
    if (!parentId) return [];
    const parent = this.layout.nodes.find((n) => n.id === parentId);
    const tasks = this.tasks().get(parentId) ?? [];
    if (!parent || tasks.length === 0) return [];
    const shown = tasks.length > MAX_CARDS ? tasks.slice(0, MAX_CARDS - 1) : tasks;
    const more = tasks.length - shown.length;
    const places = placeCards({ x: parent.x ?? 0, y: parent.y ?? 0, radius: parent.radius }, shown.length + (more > 0 ? 1 : 0));
    return places.map((place, i) => {
      const task = shown[i] ?? null;
      return {
        key: task ? task.id : `${parentId}:more`,
        task,
        moreCount: task ? 0 : more,
        x: place.x,
        y: place.y,
        side: place.side,
        tone: task ? taskTone(task) : null,
        path: this.connectorPath(parent, place)
      };
    });
  });

  private readonly neighbours = computed(() => {
    const id = this.hovered();
    if (!id) return null;
    const set = new Set<string>([id]);
    for (const link of this.links()) {
      if (link.source.id === id) set.add(link.target.id);
      if (link.target.id === id) set.add(link.source.id);
    }
    return set;
  });

  readonly cameraTransform = computed(() => {
    const c = this.camera();
    return `translate(${c.x} ${c.y}) scale(${c.scale})`;
  });

  /** Bounding box of everything drawn (minimap world). */
  readonly worldBox = computed<Box>(() => this.boundsOf(this.visibleNodes(), this.cards()));

  readonly miniItems = computed<CanvasMinimapItem[]>(() =>
    this.visibleNodes().map((n) => ({
      shape: 'circle',
      x: n.x ?? 0,
      y: n.y ?? 0,
      r: n.radius * 0.9,
      tone: n.data.kind === 'module' ? 'secondary' : 'primary'
    }))
  );

  readonly miniLinks = computed<CanvasMinimapLink[]>(() =>
    this.links().map((l) => ({ x1: l.source.x ?? 0, y1: l.source.y ?? 0, x2: l.target.x ?? 0, y2: l.target.y ?? 0 }))
  );

  /** The part of the world currently on screen, for the minimap's viewport rectangle. */
  readonly visibleBox = computed<Box | null>(() => {
    const vb = this.parseBox(this.baseViewBox());
    const c = this.camera();
    return { x: (vb.x - c.x) / c.scale, y: (vb.y - c.y) / c.scale, width: vb.width / c.scale, height: vb.height / c.scale };
  });

  constructor() {
    // The employee's photo normally comes from the directory cache the detail page already filled.
    effect(() => {
      const id = this.employeeId();
      if (id) untracked(() => void this.directory.ensureLoaded([id]));
    });

    effect((onCleanup) => {
      const graph = this.graph();
      untracked(() => this.rebuild(graph));
      onCleanup(() => this.stopSimulation());
    });

    // Locking makes room for the cards; unlocking gives the space back.
    effect(() => {
      const lockedId = this.locked();
      this.graph();
      untracked(() => this.applyLock(lockedId));
    });
  }

  ngOnDestroy(): void {
    this.cancelTween();
    this.clearPreviewTimer();
    this.stopSimulation();
  }

  // ── Public controls ────────────────────────────────────────────────────

  zoomIn(): void { this.zoomBy(1.2); }
  zoomOut(): void { this.zoomBy(1 / 1.2); }

  /** Fit everything currently drawn (including open task cards) into view. */
  /**
   * Fit everything currently drawn (including open task cards) into the view: zoom and pan glide to
   * the framing that fills the canvas, whatever the user zoomed or dragged to before.
   */
  fit(): void {
    this.animateCamera(this.fitCamera(this.boundsOf(this.visibleNodes(), this.cards())));
  }

  /**
   * Reset button: drops any spacers, lays the network out again and replays the opening - nodes
   * spread out from the employee - then fits it to the view.
   */
  relayout(): void {
    this.stopSimulation();
    this.cancelTween();
    const fresh = settleExplorerLayout(buildExplorerLayout(this.graph(), this.rootId() ?? undefined), 320);
    const targets = fresh.nodes.map((n) => ({ node: n, x: n.x ?? 0, y: n.y ?? 0 }));
    this.layout = fresh;
    this.animateCamera(this.fitCamera(this.boundsOf(fresh.nodes, [])));
    this.tween(TWEEN_LAYOUT_MS, (t) => {
      for (const { node, x, y } of targets) {
        node.x = x * t;
        node.y = y * t;
      }
      this.version.update((v) => v + 1);
    });
  }

  /** Pans so the node sits in the middle of the view, zooming in a little if far out. */
  centerOn(id: string): void {
    const node = this.layout.nodes.find((n) => n.id === id);
    if (!node) return;
    const vb = this.parseBox(this.baseViewBox());
    const scale = Math.max(this.camera().scale, 1);
    const cx = vb.x + vb.width / 2;
    const cy = vb.y + vb.height / 2;
    this.camera.set({ scale, x: cx - (node.x ?? 0) * scale, y: cy - (node.y ?? 0) * scale });
  }

  // ── Interaction ────────────────────────────────────────────────────────

  onNodeEnter(node: ExplorerNode): void {
    this.hovered.set(node.id);
    this.clearPreviewTimer();
    if (node.data.kind === 'module' || node.data.kind === 'project' || node.data.kind === 'sprint') this.previewed.set(node.id);
    else this.previewed.set(null);
  }

  onCardEnter(): void {
    this.clearPreviewTimer();
  }

  onNodeLeave(): void {
    this.hovered.set(null);
    this.clearPreviewTimer();
    this.previewTimer = setTimeout(() => {
      this.previewTimer = null;
      this.previewed.set(null);
    }, PREVIEW_LEAVE_MS);
  }

  onNodeClick(event: Event, node: ExplorerNode): void {
    event.stopPropagation();
    if (node.data.kind !== 'employee') this.nodeClicked.emit(node.data);
  }

  onCardClick(event: Event, card: RenderedCard): void {
    event.stopPropagation();
    if (card.task) this.taskClicked.emit(card.task);
  }

  startPan(event: PointerEvent): void {
    const target = event.target as Element;
    if (target !== event.currentTarget) return;
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    this.pan = { startClient: { x: event.clientX, y: event.clientY }, startCamera: this.camera(), moved: false, pointerId: event.pointerId };
  }

  onPointerMove(event: PointerEvent): void {
    const pan = this.pan;
    if (!pan) return;
    const dxPx = event.clientX - pan.startClient.x;
    const dyPx = event.clientY - pan.startClient.y;
    if (!pan.moved && Math.hypot(dxPx, dyPx) < DRAG_THRESHOLD_PX) return;
    pan.moved = true;
    const svg = this.svg()?.nativeElement;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const vb = this.parseBox(this.baseViewBox());
    const ratio = Math.max(vb.width / Math.max(rect.width, 1), vb.height / Math.max(rect.height, 1));
    this.camera.set({ ...pan.startCamera, x: pan.startCamera.x + dxPx * ratio, y: pan.startCamera.y + dyPx * ratio });
  }

  endPan(event: PointerEvent): void {
    const pan = this.pan;
    this.pan = null;
    // A plain click on the empty canvas closes whatever is locked.
    if (pan && !pan.moved && event.type === 'pointerup') this.backgroundClicked.emit();
  }

  onWheel(event: WheelEvent): void {
    event.preventDefault();
    const anchor = this.toSvgPoint(event.clientX, event.clientY);
    this.zoomBy(event.deltaY < 0 ? 1.12 : 1 / 1.12, anchor ?? undefined);
  }

  /** Minimap click/drag: keeps the zoom and moves the camera so `world` sits in the middle. */
  centerOnPoint(world: Point): void {
    const vb = this.parseBox(this.baseViewBox());
    const scale = this.camera().scale;
    this.camera.set({ scale, x: vb.x + vb.width / 2 - world.x * scale, y: vb.y + vb.height / 2 - world.y * scale });
  }

  // ── Template helpers ───────────────────────────────────────────────────

  /** Employee photo (cached directory) or project logo; null shows the coloured placeholder. */
  imageOf(node: ExplorerNode): string | null {
    let url: string | null = null;
    if (node.data.kind === 'employee') {
      const id = this.employeeId();
      url = id ? this.directory.get(id)?.avatarUrl ?? null : null;
    } else if (node.data.kind === 'project' && node.data.projectId && node.data.logoFileId) {
      url = this.projectApi.getLogoUrl(node.data.projectId, node.data.logoFileId);
    }
    return url && !this.brokenImages().has(url) ? url : null;
  }

  markBroken(url: string): void {
    this.brokenImages.update((set) => new Set(set).add(url));
  }

  clipId(node: ExplorerNode): string {
    return `wgx-clip-${node.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  }

  kindClass(node: ExplorerNode): string {
    if (node.data.kind === 'sprint') {
      const status = node.data.status;
      return `sprint-${status === 'active' ? 'active' : status === 'draft' ? 'draft' : 'done'}`;
    }
    if (node.data.kind !== 'module') return node.data.kind;
    if (node.data.role) return `module-${node.data.role}`;
    if (!this.neutralModuleFill()) return 'module-contributor';
    // Project mode: the pinned root is the project's default module and gets its own colour.
    return node.isRoot ? 'module-default' : 'module-neutral';
  }

  hasAlert(node: ExplorerNode): boolean {
    return this.alertNodeIds().has(node.id);
  }

  /** Circumference of the ring, and the completed arc inside it. */
  ringRadius(node: ExplorerNode): number {
    return node.radius + 5;
  }

  /** "<arc> <rest>": progressPercent already returns 0 for a module with no allocated hours. */
  ringDash(node: ExplorerNode): string {
    const circumference = 2 * Math.PI * this.ringRadius(node);
    const drawn = (circumference * this.progressOf(node)) / 100;
    return `${drawn} ${circumference - drawn}`;
  }

  isDimmed(node: ExplorerNode): boolean {
    const set = this.neighbours();
    if (set) return !set.has(node.id);
    const lockedId = this.locked();
    if (!lockedId) return false;
    // While a module is locked, quietly fade what is not on its path to the employee.
    return !this.pathIds(lockedId).has(node.id);
  }

  isLinkDimmed(link: ExplorerLink): boolean {
    const id = this.hovered();
    if (id) return link.source.id !== id && link.target.id !== id;
    const lockedId = this.locked();
    if (!lockedId) return false;
    const path = this.pathIds(lockedId);
    return !(path.has(link.source.id) && path.has(link.target.id));
  }

  isLinkLit(link: ExplorerLink): boolean {
    const id = this.hovered();
    return !!id && (link.source.id === id || link.target.id === id);
  }

  linkPath(link: ExplorerLink): string {
    const sx = link.source.x ?? 0, sy = link.source.y ?? 0, tx = link.target.x ?? 0, ty = link.target.y ?? 0;
    const mx = (sx + tx) / 2, my = (sy + ty) / 2;
    const dx = tx - sx, dy = ty - sy;
    // A gentle bend, always to the same side, so parallel links never cross into each other.
    const bend = 0.12;
    return `M${sx},${sy} Q${mx - dy * bend},${my + dx * bend} ${tx},${ty}`;
  }

  enterDelay(node: ExplorerNode): number {
    return node.data.kind === 'employee' ? 0 : node.data.kind === 'project' ? 120 : 260;
  }

  badgeOf(node: ExplorerNode): number | null {
    if (node.data.kind === 'project') {
      const n = this.graph().nodes.filter((m) => m.kind === 'module' && m.projectId === node.data.projectId).length;
      return n > 0 ? n : null;
    }
    if (node.data.kind === 'module') {
      const n = this.tasks().get(node.id)?.length ?? 0;
      return n > 0 ? n : null;
    }
    return null;
  }

  /** The badge counts this employee's slice; the label under the node counts the whole module/project. */
  badgeTitle(node: ExplorerNode, count: number): string {
    const first = this.graph().nodes.find((n) => n.kind === 'employee')?.label.split(/\s+/)[0] ?? 'Employee';
    return node.data.kind === 'project'
      ? `${count} of ${first}'s modules in this project`
      : `${count} open task${count === 1 ? '' : 's'} assigned to ${first}`;
  }

  projectSummary(node: ExplorerNode): string {
    const total = node.data.stats?.totalTasks ?? 0;
    const modules = this.graph().nodes.filter((m) => m.kind === 'module' && m.projectId === node.data.projectId).length;
    return `${total} task${total === 1 ? '' : 's'} • ${modules} module${modules === 1 ? '' : 's'}`;
  }

  moduleSummary(node: ExplorerNode): string {
    if (node.data.kind === 'sprint') {
      const count = tasksByParent(this.graph()).get(node.id)?.length ?? 0;
      return `${count} task${count === 1 ? '' : 's'}`;
    }
    const total = node.data.stats?.totalTasks ?? 0;
    return `${total} task${total === 1 ? '' : 's'} in module`;
  }

  /** Tone dot (employee view) or, with taskDotStyle 'status', the light-blue empty/filled/done dot. */
  cardDotClass(card: RenderedCard): string {
    if (this.taskDotStyle() === 'status' && card.task) return `wgx-card__dot wgx-dot--${taskStatusDot(card.task)}`;
    return 'wgx-card__dot wgx-tone--' + card.tone;
  }

  progressOf(node: ExplorerNode): number {
    return progressPercent(node.data.stats);
  }

  toneLabel(tone: TaskTone | null): string {
    return tone ? TASK_TONE_LABELS[tone] : '';
  }

  short(label: string, max: number): string {
    return shorten(label, max);
  }

  ariaLabel(node: ExplorerNode): string {
    switch (node.data.kind) {
      case 'employee': return `${node.data.label}${node.data.sublabel ? ', ' + node.data.sublabel : ''}`;
      case 'project': return `Project ${node.data.label}, ${this.projectSummary(node)}`;
      default: return `Module ${node.data.label}, ${node.data.role ?? 'contributor'}, ${this.moduleSummary(node)}`;
    }
  }

  // ── Internals ──────────────────────────────────────────────────────────

  private rebuild(graph: EmployeeWorkGraphResponse): void {
    this.stopSimulation();
    this.cancelTween();
    this.layout = settleExplorerLayout(buildExplorerLayout(graph, this.rootId() ?? undefined), 320);
    this.version.update((v) => v + 1);
    // The view box is set once per graph; Fit / zoom / pan only ever move the camera inside it.
    this.baseViewBox.set(this.boxToViewBox(this.boundsOf(this.visibleNodes(), [])));
    this.camera.set({ x: 0, y: 0, scale: 1 });
  }

  /** The camera that frames `box` (plus padding) inside the current view box, centred. */
  private fitCamera(box: Box): Camera {
    const vb = this.parseBox(this.baseViewBox());
    const width = box.width + VIEW_PADDING * 2;
    const height = box.height + VIEW_PADDING * 2;
    const scale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(vb.width / width, vb.height / height)));
    return {
      scale,
      x: vb.x + vb.width / 2 - scale * (box.x + box.width / 2),
      y: vb.y + vb.height / 2 - scale * (box.y + box.height / 2)
    };
  }

  private animateCamera(target: Camera): void {
    const from = this.camera();
    this.cameraTween?.();
    this.cameraTween = this.tween(TWEEN_CAMERA_MS, (t) =>
      this.camera.set({
        scale: from.scale + (target.scale - from.scale) * t,
        x: from.x + (target.x - from.x) * t,
        y: from.y + (target.y - from.y) * t
      })
    );
  }

  /**
   * Runs `step` with an eased 0..1 progress over `ms`, ending exactly at 1. Jumps straight to the
   * end when motion is reduced, animation is off, or there is no animation frame (tests).
   * Returns a cancel function.
   */
  private tween(ms: number, step: (t: number) => void): () => void {
    if (!this.animated() || this.prefersReducedMotion() || typeof requestAnimationFrame !== 'function') {
      step(1);
      return () => undefined;
    }
    const start = performance.now();
    let frame = 0;
    const schedule = () => {
      frame = requestAnimationFrame(tick);
      this.frames.add(frame);
    };
    const tick = (now: number) => {
      this.frames.delete(frame);
      const p = Math.min(1, (now - start) / ms);
      step(1 - Math.pow(1 - p, 3));
      if (p < 1) schedule();
    };
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      this.frames.delete(frame);
    };
  }

  private cancelTween(): void {
    for (const frame of this.frames) cancelAnimationFrame(frame);
    this.frames.clear();
    this.cameraTween = null;
  }

  private applyLock(lockedId: string | null): void {
    // Drop the previous spacers and release whatever was pinned for them.
    const kept = this.layout.nodes.filter((n) => !n.spacer);
    for (const node of kept) {
      if (node.data.kind !== 'employee') {
        node.fx = null;
        node.fy = null;
      }
    }
    const parent = lockedId ? kept.find((n) => n.id === lockedId) : undefined;
    const count = parent ? Math.min(this.tasks().get(parent.id)?.length ?? 0, MAX_CARDS) : 0;
    const spacers: ExplorerNode[] = [];
    if (parent && count > 0) {
      parent.fx = parent.x;
      parent.fy = parent.y;
      for (const [i, place] of placeCards({ x: parent.x ?? 0, y: parent.y ?? 0, radius: parent.radius }, count).entries()) {
        spacers.push({
          id: `spacer:${parent.id}:${i}`, data: parent.data, radius: 0, collide: CARD_WIDTH / 2 + 18, code: '',
          spacer: true, x: place.x, y: place.y, fx: place.x, fy: place.y
        });
      }
    }
    if (spacers.length === 0 && this.layout.nodes.length === kept.length) return;
    this.layout = { nodes: [...kept, ...spacers], links: this.layout.links };
    this.settle();
  }

  /** Animates neighbours into their new places, or jumps there when motion is reduced / off. */
  private settle(): void {
    this.stopSimulation();
    if (!this.animated() || this.prefersReducedMotion()) {
      createExplorerSimulation(this.layout).stop().tick(160);
      this.version.update((v) => v + 1);
      return;
    }
    this.simulation = createExplorerSimulation(this.layout)
      .alpha(0.5)
      .alphaDecay(0.06)
      .on('tick', () => this.version.update((v) => v + 1));
  }

  private connectorPath(parent: ExplorerNode, place: CardPlacement): string {
    const sx = (parent.x ?? 0) + place.side * parent.radius;
    const sy = parent.y ?? 0;
    const ex = place.x - place.side * (CARD_WIDTH / 2);
    const ey = place.y;
    const pull = Math.abs(ex - sx) * 0.5;
    return `M${sx},${sy} C${sx + place.side * pull},${sy} ${ex - place.side * pull},${ey} ${ex},${ey}`;
  }

  private pathIds(lockedId: string): Set<string> {
    const set = new Set<string>([lockedId]);
    const locked = this.layout.nodes.find((n) => n.id === lockedId);
    for (const link of this.links()) {
      if (link.target.id === lockedId) {
        set.add(link.source.id);
        for (const up of this.links()) if (up.target.id === link.source.id) set.add(up.source.id);
      }
      if (locked?.data.kind === 'project' && link.source.id === lockedId) set.add(link.target.id);
    }
    return set;
  }

  private boundsOf(nodes: readonly ExplorerNode[], cards: readonly RenderedCard[]): Box {
    if (nodes.length === 0) return { x: -400, y: -300, width: 800, height: 600 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      const x = n.x ?? 0, y = n.y ?? 0;
      minX = Math.min(minX, x - n.collide);
      maxX = Math.max(maxX, x + n.collide);
      minY = Math.min(minY, y - n.radius - 12);
      maxY = Math.max(maxY, y + n.radius + 58);
    }
    for (const c of cards) {
      minX = Math.min(minX, c.x - CARD_WIDTH / 2);
      maxX = Math.max(maxX, c.x + CARD_WIDTH / 2);
      minY = Math.min(minY, c.y - CARD_HEIGHT / 2);
      maxY = Math.max(maxY, c.y + CARD_HEIGHT / 2);
    }
    return { x: minX, y: minY, width: Math.max(maxX - minX, 1), height: Math.max(maxY - minY, 1) };
  }

  private boxToViewBox(box: Box): string {
    return `${box.x - VIEW_PADDING} ${box.y - VIEW_PADDING} ${box.width + VIEW_PADDING * 2} ${box.height + VIEW_PADDING * 2}`;
  }

  private parseBox(viewBox: string): Box {
    const [x, y, width, height] = viewBox.split(' ').map(Number);
    return { x, y, width, height };
  }

  private zoomBy(factor: number, anchor?: Point): void {
    const c = this.camera();
    const scale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, c.scale * factor));
    const vb = this.parseBox(this.baseViewBox());
    const centre = anchor ?? { x: vb.x + vb.width / 2, y: vb.y + vb.height / 2 };
    const ratio = scale / c.scale;
    this.camera.set({ scale, x: centre.x - (centre.x - c.x) * ratio, y: centre.y - (centre.y - c.y) * ratio });
  }

  private toSvgPoint(clientX: number, clientY: number): Point | null {
    const svg = this.svg()?.nativeElement;
    const ctm = svg?.getScreenCTM?.();
    if (!svg || !ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const local = pt.matrixTransform(ctm.inverse());
    return { x: local.x, y: local.y };
  }

  private clearPreviewTimer(): void {
    if (this.previewTimer !== null) clearTimeout(this.previewTimer);
    this.previewTimer = null;
  }

  private prefersReducedMotion(): boolean {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;
  }

  private stopSimulation(): void {
    this.simulation?.stop();
    this.simulation = null;
  }
}
