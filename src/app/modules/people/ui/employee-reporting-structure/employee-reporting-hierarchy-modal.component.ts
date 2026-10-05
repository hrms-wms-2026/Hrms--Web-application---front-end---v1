import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { PositionApiService } from '../../../organization/data-access/position-api.service';
import { PositionTreeNodeResponse } from '../../../organization/models/position.model';
import { PositionTreeNodeComponent } from '../../../organization/ui/position-tree-node/position-tree-node.component';
import { buildReportingBranch } from './reporting-branch';

type HierarchyState = 'idle' | 'loading' | 'ready' | 'not_found' | 'forbidden' | 'error';

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 1.5;
const ZOOM_STEP = 0.1;
const DEFAULT_ZOOM = 0.8;

/**
 * An employee's reporting structure drawn like Org → Positions: the positions above theirs up to
 * the top, then theirs (highlighted) with every position below it. Read-only. The position tree is
 * fetched the first time the dialog opens and reused after that.
 */
@Component({
  selector: 'app-employee-reporting-hierarchy-modal',
  standalone: true,
  imports: [ModalComponent, ErrorStateComponent, PositionTreeNodeComponent],
  template: `
    <app-modal [open]="open()" [title]="'Reporting structure · ' + employeeName()" customMaxWidth="max-w-none" panelClass="flex h-[calc(100vh-2rem)] flex-col !p-5" (closed)="closed.emit()">
      <div class="rh-canvas" #canvas data-testid="reporting-hierarchy">
        @switch (state()) {
          @case ('loading') {
            <p class="rh-message" data-testid="reporting-hierarchy-loading">Loading the reporting structure…</p>
          }
          @case ('error') {
            <div class="rh-message">
              <app-error-state message="Could not load the reporting structure." [retryable]="true" (retry)="load()" />
            </div>
          }
          @case ('forbidden') {
            <p class="rh-message" data-testid="reporting-hierarchy-forbidden">You need access to the organization structure to see the full reporting structure.</p>
          }
          @case ('not_found') {
            <p class="rh-message" data-testid="reporting-hierarchy-empty">This employee has no position in the organization structure yet.</p>
          }
          @case ('ready') {
            @if (branch(); as root) {
              <div class="rh-tree" [style.transform]="'scale(' + zoom() + ')'">
                <app-position-tree-node [node]="root" [isRoot]="true" [highlightPositionId]="positionId()" />
              </div>
            }
          }
        }

        @if (state() === 'ready') {
          <div class="rh-zoom" role="toolbar" aria-label="Zoom controls">
            <button type="button" class="rh-zoom-btn" aria-label="Zoom out" [disabled]="zoom() <= minZoom" (click)="zoomBy(-step)">−</button>
            <button type="button" class="rh-zoom-reset" title="Reset zoom" (click)="zoom.set(defaultZoom)">{{ zoomLabel() }}%</button>
            <button type="button" class="rh-zoom-btn" aria-label="Zoom in" [disabled]="zoom() >= maxZoom" (click)="zoomBy(step)">+</button>
          </div>
        }
      </div>
    </app-modal>
  `,
  styles: [`
    .rh-canvas {
      position: relative;
      flex: 1 1 auto;
      min-height: 0;
      overflow: auto;
      border-radius: 0.75rem;
      border: 1px solid var(--color-border);
      background-color: var(--color-surface);
      background-image: radial-gradient(color-mix(in srgb, var(--color-text-secondary) 18%, transparent) 1px, transparent 1px);
      background-size: 20px 20px;
    }
    .rh-tree {
      display: flex;
      justify-content: center;
      min-width: max-content;
      padding: 2rem;
      transform-origin: top center;
      transition: transform 0.15s ease-out;
    }
    .rh-message { padding: 3rem 1.5rem; text-align: center; font-size: 0.875rem; color: var(--color-text-secondary); }
    .rh-zoom {
      position: sticky; left: calc(100% - 9.5rem); bottom: 1rem;
      display: inline-flex; align-items: center; gap: 0.25rem;
      margin: 0 1rem 1rem 0; padding: 0.25rem;
      border-radius: 9999px; border: 1px solid var(--color-border);
      background: var(--color-surface); box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
    }
    .rh-zoom-btn, .rh-zoom-reset {
      height: 2rem; border: 0; border-radius: 9999px; background: transparent;
      color: var(--color-text-primary); cursor: pointer; font-weight: 600;
    }
    .rh-zoom-btn { width: 2rem; font-size: 1rem; }
    .rh-zoom-btn:disabled { opacity: 0.4; cursor: default; }
    .rh-zoom-reset { padding: 0 0.5rem; font-size: 0.75rem; }
    .rh-zoom-btn:hover:not(:disabled), .rh-zoom-reset:hover { background: var(--color-surface-secondary); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeReportingHierarchyModalComponent {
  private readonly positionsApi = inject(PositionApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly canvas = viewChild<ElementRef<HTMLElement>>('canvas');

  readonly open = input(false);
  readonly legalEntityId = input<string | null>(null);
  readonly positionId = input<string | null>(null);
  readonly employeeName = input('');
  readonly closed = output<void>();

  readonly minZoom = MIN_ZOOM;
  readonly maxZoom = MAX_ZOOM;
  readonly step = ZOOM_STEP;
  readonly defaultZoom = DEFAULT_ZOOM;

  readonly state = signal<HierarchyState>('idle');
  readonly zoom = signal(DEFAULT_ZOOM);
  readonly zoomLabel = computed(() => Math.round(this.zoom() * 100));
  private readonly tree = signal<readonly PositionTreeNodeResponse[] | null>(null);
  readonly branch = computed(() => {
    const tree = this.tree();
    const positionId = this.positionId();
    return tree && positionId ? buildReportingBranch(tree, positionId) : null;
  });
  /** The legal entity the cached tree belongs to. */
  private loadedFor: string | null = null;

  constructor() {
    effect(() => {
      if (!this.open()) return;
      untracked(() => {
        const entity = this.legalEntityId();
        if (this.state() === 'idle' || this.loadedFor !== entity) this.load();
        else this.centreOnEmployee();
      });
    });
  }

  zoomBy(delta: number): void {
    const next = Math.round((this.zoom() + delta) * 10) / 10;
    this.zoom.set(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next)));
  }

  load(): void {
    const entity = this.legalEntityId();
    if (!entity || !this.positionId()) {
      this.state.set('not_found');
      return;
    }
    this.state.set('loading');
    this.positionsApi
      .listTree(entity)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (tree) => {
          if (entity !== this.legalEntityId()) return;
          this.loadedFor = entity;
          this.tree.set(tree);
          this.state.set(this.branch() ? 'ready' : 'not_found');
          this.centreOnEmployee();
        },
        error: (err: unknown) => {
          if (entity !== this.legalEntityId()) return;
          this.state.set(err instanceof HttpErrorResponse && err.status === 403 ? 'forbidden' : 'error');
        }
      });
  }

  /** Wide trees overflow sideways; bring the employee's own card into view. */
  private centreOnEmployee(): void {
    afterNextRender(() => {
      const card = this.canvas()?.nativeElement.querySelector('.ptn-node-card--highlight');
      card?.scrollIntoView?.({ block: 'center', inline: 'center' });
    }, { injector: this.injector });
  }
}
