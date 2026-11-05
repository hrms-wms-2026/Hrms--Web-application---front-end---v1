import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
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
import { EMPTY, Observable, expand, reduce } from 'rxjs';
import { FileApiService } from '../../../../shared/data-access/file-api.service';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { PanZoomCanvasComponent } from '../../../../shared/ui/pan-zoom-canvas/pan-zoom-canvas.component';
import { TidyTreeComponent } from '../../../../shared/ui/tidy-tree/tidy-tree.component';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeListItemResponse, EmployeeListPageResponse } from '../../models/employee.model';
import { PersonTreeNode, buildPeopleBranch, personChildren, personKey } from './people-branch';

type HierarchyState = 'idle' | 'loading' | 'ready' | 'forbidden' | 'error';

/** The backend caps the employee list at 100 rows a page. */
export const PEOPLE_PAGE_SIZE = 100;
/** Stop paging after this many pages (10,000 people) so a huge tenant cannot loop forever. */
const MAX_PAGES = 100;

export const PERSON_CARD_WIDTH = 240;
export const PERSON_CARD_HEIGHT = 72;

/**
 * An employee's reporting structure by people: their reporting managers up to the top, then the
 * employee (highlighted) with everyone who reports to them, and their reports below. Read-only, on
 * the same pan/zoom canvas (grid, minimap, fit) as the Positions page. Built from the
 * visibility-scoped employee list, fetched the first time the dialog opens and reused after that.
 */
@Component({
  selector: 'app-employee-reporting-hierarchy-modal',
  standalone: true,
  imports: [AvatarComponent, ModalComponent, ErrorStateComponent, PanZoomCanvasComponent, TidyTreeComponent],
  template: `
    <app-modal [open]="open()" [title]="'Reporting structure · ' + employeeName()" customMaxWidth="max-w-none" panelClass="flex h-[calc(100vh-2rem)] flex-col !p-5" (closed)="closed.emit()">
      <app-pan-zoom-canvas class="rh-canvas" data-testid="reporting-hierarchy" label="Reporting structure" [initialZoom]="0.8">
        <div canvasOverlay>
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
              <p class="rh-message" data-testid="reporting-hierarchy-forbidden">You need access to the employee list to see the full reporting structure.</p>
            }
          }
        </div>
        @if (state() === 'ready') {
          @if (branch(); as root) {
            <div class="rh-tree">
              <app-tidy-tree
                label="Reporting structure"
                [root]="root"
                [childrenOf]="personChildren"
                [keyOf]="personKey"
                [nodeWidth]="cardWidth"
                [nodeHeight]="cardHeight"
                [dashedLink]="isPlaceholder"
              >
                <ng-template let-node>
                  <div
                    class="rh-card"
                    data-testid="reporting-person"
                    [class.rh-card--self]="node.id === employeeId()"
                    [class.rh-card--placeholder]="node.placeholder"
                  >
                    <app-avatar size="md" [avatarUrl]="avatarUrl(node)" [userName]="node.name" />
                    <div class="rh-card-text">
                      <p class="rh-card-name" [title]="node.name">{{ node.name }}</p>
                      <p class="rh-card-sub" [title]="subtitle(node)">{{ subtitle(node) }}</p>
                    </div>
                    @if (node.id === employeeId()) {
                      <span class="rh-card-badge">This employee</span>
                    } @else if (node.children.length && !node.placeholder) {
                      <span class="rh-card-count" [title]="node.children.length + ' direct reports'">{{ node.children.length }}</span>
                    }
                  </div>
                </ng-template>
              </app-tidy-tree>
            </div>
          }
        }
      </app-pan-zoom-canvas>
    </app-modal>
  `,
  styles: [`
    .rh-canvas {
      flex: 1 1 auto;
      min-height: 0;
      padding: 2rem;
      border-radius: 0.75rem;
      border: 1px solid var(--color-border);
      background-color: var(--color-surface);
    }
    .rh-tree { display: flex; justify-content: center; }
    .rh-message { padding: 3rem 1.5rem; text-align: center; font-size: 0.875rem; color: var(--color-text-secondary); }
    .rh-card {
      position: relative;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      width: 240px;
      height: 72px;
      padding: 0.75rem 0.875rem;
      border-radius: 10px;
      background: var(--color-surface);
      border: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent);
      box-shadow: var(--shadow-popover);
    }
    .rh-card--self {
      border: 2px solid var(--color-accent-strong);
      background: color-mix(in srgb, var(--color-accent-strong) 7%, var(--color-surface));
      box-shadow: 0 6px 16px rgba(37, 99, 235, 0.15);
    }
    .rh-card--placeholder { border-style: dashed; opacity: 0.75; }
    .rh-card-text { min-width: 0; flex: 1 1 auto; }
    .rh-card-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.8125rem; font-weight: 600; color: var(--color-text-primary); }
    .rh-card-sub { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.6875rem; color: var(--color-text-secondary); }
    .rh-card-badge {
      position: absolute;
      top: -0.55rem;
      right: 0.75rem;
      border-radius: 9999px;
      padding: 0.0625rem 0.5rem;
      font-size: 0.625rem;
      font-weight: 600;
      color: var(--color-text-on-solid);
      background: var(--color-accent-strong);
    }
    .rh-card-count {
      flex-shrink: 0;
      min-width: 1.5rem;
      border-radius: 9999px;
      padding: 0.0625rem 0.4rem;
      text-align: center;
      font-size: 0.6875rem;
      font-weight: 600;
      color: var(--color-accent-strong);
      background: color-mix(in srgb, var(--color-accent-strong) 10%, transparent);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeReportingHierarchyModalComponent {
  private readonly api = inject(PeopleApiService);
  private readonly fileApi = inject(FileApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly canvas = viewChild(PanZoomCanvasComponent);

  readonly open = input(false);
  readonly employeeId = input.required<string>();
  readonly employeeName = input('');
  readonly positionName = input<string | null>(null);
  readonly departmentName = input<string | null>(null);
  readonly managerId = input<string | null>(null);
  readonly managerName = input<string | null>(null);
  readonly closed = output<void>();

  readonly cardWidth = PERSON_CARD_WIDTH;
  readonly cardHeight = PERSON_CARD_HEIGHT;
  readonly personChildren = personChildren;
  readonly personKey = personKey;
  readonly isPlaceholder = (node: PersonTreeNode): boolean => node.placeholder;

  readonly state = signal<HierarchyState>('idle');
  private readonly employees = signal<readonly EmployeeListItemResponse[] | null>(null);
  readonly branch = computed(() => {
    const employees = this.employees();
    if (!employees) return null;
    return buildPeopleBranch(employees, {
      id: this.employeeId(),
      name: this.employeeName(),
      positionName: this.positionName(),
      departmentName: this.departmentName(),
      managerId: this.managerId(),
      managerName: this.managerName()
    });
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      untracked(() => {
        if (this.state() === 'idle') this.load();
        else this.centreOnEmployee();
      });
    });
  }

  load(): void {
    this.state.set('loading');
    this.fetchAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (employees) => {
          this.employees.set(employees);
          this.state.set('ready');
          this.centreOnEmployee();
        },
        error: (err: unknown) => {
          this.state.set(err instanceof HttpErrorResponse && err.status === 403 ? 'forbidden' : 'error');
        }
      });
  }

  avatarUrl(node: PersonTreeNode): string | null {
    return node.avatarFileId ? this.fileApi.getFileUrl(node.avatarFileId) : null;
  }

  subtitle(node: PersonTreeNode): string {
    if (node.placeholder) return 'Reporting manager';
    const parts = [node.positionName, node.departmentName].filter((p): p is string => !!p);
    return parts.length ? parts.join(' · ') : 'No position';
  }

  /** Every employee the viewer can see, page by page. */
  private fetchAll(): Observable<readonly EmployeeListItemResponse[]> {
    const page = (n: number): Observable<EmployeeListPageResponse> =>
      this.api.listEmployees({ page: n, pageSize: PEOPLE_PAGE_SIZE });
    return page(1).pipe(
      expand((res) =>
        res.page < MAX_PAGES && res.page * PEOPLE_PAGE_SIZE < res.totalCount && res.items.length > 0 ? page(res.page + 1) : EMPTY
      ),
      reduce<EmployeeListPageResponse, EmployeeListItemResponse[]>((all, res) => all.concat(res.items), [])
    );
  }

  /** Show the whole structure; if it is too big for that, centre on the employee's own card. */
  private centreOnEmployee(): void {
    afterNextRender(() => this.canvas()?.fitAndReveal('.rh-card--self'), { injector: this.injector });
  }
}
