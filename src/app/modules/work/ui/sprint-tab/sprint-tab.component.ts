import { DatePipe } from '@angular/common';
import { Component, ElementRef, HostListener, OutputEmitterRef, computed, inject, input, output, signal } from '@angular/core';
import { TaskTableComponent } from '../task-table/task-table.component';
import { SprintHistoryComponent } from '../sprint-history/sprint-history.component';
import { Sprint } from '../../models/sprint.model';
import { TaskStatusColumn, WorkTask } from '../../models/task.model';
import { formatPercent } from '../../../../shared/utils/format-percent.util';

/** Shared across every sprint row so only one action capsule is open at a time. */
const openSprintMenuId = signal<string | null>(null);

@Component({
  selector: 'app-sprint-tab',
  standalone: true,
  imports: [DatePipe, TaskTableComponent, SprintHistoryComponent],
  template: `
    <div class="sprint-tab" [attr.data-status]="sprint().status">
      <div class="sprint-tab__header">
        <div class="sprint-tab__ring" [style.--progress]="progressPercent()" role="img" [attr.aria-label]="progressText() + ' complete'">
          <span class="sprint-tab__ring-label">{{ progressText() }}</span>
        </div>

        <button type="button" class="sprint-tab__expand" (click)="toggled.emit()" [attr.aria-expanded]="expanded()">
          <svg class="sprint-tab__expand-icon" [class.rotate-90]="expanded()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
          <span class="min-w-0 truncate">{{ sprint().name }}</span>
        </button>

        <span class="sprint-tab__status-badge" [attr.data-status]="sprint().status">{{ statusLabel() }}</span>

        @if (sprint().status === 'draft') {
          <span class="sprint-tab__dates">No dates set</span>
        } @else if (sprint().startDate && sprint().endDate) {
          <span class="sprint-tab__dates">{{ sprint().startDate | date: 'MMM d, y' }} – {{ sprint().endDate | date: 'MMM d, y' }}</span>
          @if (isOverdue()) {
            <span class="sprint-tab__overdue">{{ daysOverdue() }} day{{ daysOverdue() === 1 ? '' : 's' }} overdue</span>
          } @else if (sprint().status === 'active' && daysRemaining() != null) {
            <span class="sprint-tab__remaining">{{ daysRemaining() }} day{{ daysRemaining() === 1 ? '' : 's' }} remaining</span>
          }
        }

        <span class="sprint-tab__counts">{{ tasks().length }} tasks · {{ totalEstimatedHours() }}h</span>

        @if (hasActions()) {
          <div class="sprint-tab__actions" [class.is-open]="menuOpen()">
            @if (hasMenuActions()) {
              <div class="sprint-tab__capsule" [id]="'sprint-actions-' + sprint().id" [attr.inert]="menuOpen() ? null : ''" [attr.aria-hidden]="!menuOpen()">
                @if (canEdit()) {
                  <button type="button" class="sprint-tab__icon-btn sprint-tab__edit" data-tooltip="Edit sprint" aria-label="Edit sprint" (click)="runMenuAction(editRequested)">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                  </button>
                }
                @if (canAddTask()) {
                  <button type="button" class="sprint-tab__icon-btn sprint-tab__add-task" data-tooltip="Add task in sprint" aria-label="Add task in sprint" (click)="runMenuAction(createTaskRequested)">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                  </button>
                }
                @if (canClose()) {
                  <button type="button" class="sprint-tab__icon-btn sprint-tab__close-sprint" data-testid="complete-sprint" data-tooltip="Close sprint" aria-label="Close sprint" (click)="runMenuAction(completeRequested)">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.5 2.5 4.5-5" /></svg>
                  </button>
                }
              </div>
            }

            @if (canStart()) {
              <button type="button" class="sprint-tab__circle sprint-tab__primary" data-testid="start-sprint" data-tooltip="Start sprint" aria-label="Start sprint" (click)="startRequested.emit()">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path class="sprint-tab__play" d="M8.5 5.8v12.4a.8.8 0 0 0 1.2.7l9.8-6.2a.8.8 0 0 0 0-1.4L9.7 5.1a.8.8 0 0 0-1.2.7Z" /></svg>
              </button>
            }

            @if (hasMenuActions()) {
              <button type="button" class="sprint-tab__circle sprint-tab__more" data-testid="sprint-more-actions"
                [attr.data-tooltip]="menuOpen() ? 'Close menu' : 'More actions'"
                [attr.aria-label]="menuOpen() ? 'Close sprint actions' : 'More sprint actions'"
                [attr.aria-expanded]="menuOpen()" [attr.aria-controls]="'sprint-actions-' + sprint().id"
                (click)="toggleMenu()">
                @if (menuOpen()) {
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
                } @else {
                  <svg viewBox="0 0 24 24" aria-hidden="true"><circle class="sprint-tab__dot" cx="12" cy="5.5" r="1.6" /><circle class="sprint-tab__dot" cx="12" cy="12" r="1.6" /><circle class="sprint-tab__dot" cx="12" cy="18.5" r="1.6" /></svg>
                }
              </button>
            }
          </div>
        }
      </div>

      <div class="sprint-tab__progress-bar" aria-hidden="true">
        <div class="sprint-tab__progress-fill" [style.width.%]="progressPercent()"></div>
      </div>

      @if (expanded() && sprint().status !== 'complete') {
        <div class="sprint-tab__body">
          <app-task-table
            [tasks]="tasks()"
            [statusNames]="statusNames()"
            [categoryNames]="categoryNames()"
            [moduleNames]="moduleNames()"
            [statuses]="statuses()"
            [objectiveOwners]="objectiveOwners()"
            [currentEmployeeId]="currentEmployeeId()"
            [selectable]="selectable()"
            [selectedIds]="selectedIds()"
            (viewed)="taskViewed.emit($event)"
            (statusChangeRequested)="taskStatusChangeRequested.emit($event)"
            (taskChanged)="taskChanged.emit()"
            (selectionChanged)="taskSelectionChanged.emit($event)"
            (selectAllChanged)="taskSelectAllChanged.emit($event)"
          />
          <button type="button" class="sprint-tab__footer-add" data-testid="sprint-footer-add-task" (click)="createTaskRequested.emit()">
            <span class="sprint-tab__footer-add-icon" aria-hidden="true">+</span>
            <span>Add Task</span>
          </button>
          <app-sprint-history [sprintId]="sprint().id" />
        </div>
      } @else if (expanded() && sprint().status === 'complete') {
        <div class="sprint-tab__body sprint-tab__body--readonly">
          {{ tasks().length }} tasks in this completed sprint.
          <app-sprint-history [sprintId]="sprint().id" />
        </div>
      }
    </div>
  `,
  styles: [`
    .sprint-tab { border: 1px solid var(--color-border); border-radius: 12px; margin-bottom: 10px; background: var(--color-surface); }
    .sprint-tab[data-status="complete"] { opacity: 0.75; }
    .sprint-tab__header { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; min-height: 52px; padding: 10px 14px; border-radius: 11px 11px 0 0; background: var(--color-surface); }
    .sprint-tab__ring { position: relative; flex: 0 0 auto; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: conic-gradient(var(--color-widget-shade-1) calc(var(--progress) * 1%), var(--color-widget-track) 0); }
    .sprint-tab__ring::before { content: ''; position: absolute; inset: 3px; border-radius: 50%; background: var(--color-surface); }
    .sprint-tab__ring-label { position: relative; font-size: 9px; font-weight: 700; color: var(--color-text-primary); }
    .sprint-tab__expand { display: inline-flex; min-width: 0; flex: 1; align-items: center; gap: 7px; text-align: left; background: none; border: none; cursor: pointer; font-size: 13px; font-weight: 600; color: var(--color-text-primary); }
    .sprint-tab__expand:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
    .sprint-tab__expand-icon { width: 15px; height: 15px; flex: 0 0 auto; color: var(--color-accent); transition: transform 180ms ease; }
    .sprint-tab__status-badge { flex: 0 0 auto; font-size: 11px; font-weight: 600; text-transform: capitalize; padding: 3px 9px; border-radius: 999px; background: var(--color-surface-secondary); color: var(--color-text-secondary); }
    .sprint-tab__status-badge[data-status="active"] { background: color-mix(in srgb, var(--color-accent) 14%, var(--color-surface)); color: var(--color-accent); }
    .sprint-tab__status-badge[data-status="complete"], .sprint-tab__status-badge[data-status="achieved"] { background: color-mix(in srgb, var(--color-success) 14%, var(--color-surface)); color: var(--color-success); }
    .sprint-tab__dates, .sprint-tab__counts { flex: 0 0 auto; font-size: 11px; color: var(--color-text-secondary); }
    .sprint-tab__overdue { flex: 0 0 auto; font-size: 11px; font-weight: 600; color: var(--color-danger-text, #b91c1c); }
    .sprint-tab__remaining { flex: 0 0 auto; font-size: 11px; color: var(--color-text-secondary); }
    .sprint-tab__actions { display: flex; flex: 0 0 auto; align-items: center; gap: 6px; margin-left: auto; }
    .sprint-tab__circle, .sprint-tab__icon-btn { position: relative; display: inline-flex; flex: 0 0 auto; align-items: center; justify-content: center; border-radius: 50%; cursor: pointer; transition: background-color 120ms ease, border-color 120ms ease, color 120ms ease, transform 120ms ease; }
    .sprint-tab__circle { width: 32px; height: 32px; border: 1px solid transparent; }
    .sprint-tab__circle svg, .sprint-tab__icon-btn svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .sprint-tab__circle:active, .sprint-tab__icon-btn:active { transform: scale(0.94); }
    .sprint-tab__primary { background: var(--color-accent); color: var(--color-text-on-solid); }
    .sprint-tab__primary:hover { background: color-mix(in srgb, var(--color-accent) 86%, #000); }
    .sprint-tab__play { fill: currentColor; stroke: none; }
    .sprint-tab__more { background: var(--color-surface-secondary); border-color: var(--color-border); color: var(--color-text-secondary); }
    .sprint-tab__more:hover, .sprint-tab__actions.is-open .sprint-tab__more { border-color: var(--color-accent); color: var(--color-text-primary); }
    .sprint-tab__dot { fill: currentColor; stroke: none; }
    /* Grows in the header flow (not floating), so the sprint name and info shift left to make room. */
    .sprint-tab__capsule { display: flex; flex: 0 0 auto; align-items: center; gap: 2px; height: 36px; max-width: 0; margin-right: -6px; padding: 0; overflow: hidden; border: 1px solid transparent; border-radius: 999px; background: var(--color-surface); opacity: 0; transition: max-width 150ms ease-in, padding 150ms ease-in, margin 150ms ease-in, opacity 120ms ease-in, border-color 150ms ease-in, box-shadow 150ms ease-in; }
    .sprint-tab__capsule > .sprint-tab__icon-btn { opacity: 0; transition: opacity 100ms ease-in; }
    .sprint-tab__actions.is-open .sprint-tab__capsule { max-width: 140px; margin-right: 0; padding: 0 3px; overflow: visible; opacity: 1; border-color: var(--color-border); box-shadow: var(--shadow-popover); transition: max-width 180ms ease-out, padding 180ms ease-out, margin 180ms ease-out, opacity 120ms ease-out, border-color 180ms ease-out, box-shadow 180ms ease-out; }
    .sprint-tab__actions.is-open .sprint-tab__capsule > .sprint-tab__icon-btn { opacity: 1; transition: opacity 120ms ease-out 80ms; }
    .sprint-tab__icon-btn { width: 30px; height: 30px; border: none; background: transparent; color: var(--color-text-secondary); }
    .sprint-tab__icon-btn:hover { background: var(--color-surface-secondary); color: var(--color-accent); }
    .sprint-tab__close-sprint:hover { color: var(--color-success); }
    [data-tooltip]::after { content: attr(data-tooltip); position: absolute; bottom: calc(100% + 8px); left: 50%; z-index: 10; padding: 4px 8px; border-radius: 6px; background: #1f2937; color: var(--color-text-on-solid); font-size: 11px; font-weight: 500; line-height: 1.3; white-space: nowrap; pointer-events: none; opacity: 0; transform: translate(-50%, 3px); transition: opacity 120ms ease, transform 120ms ease; }
    [data-tooltip]:hover::after, [data-tooltip]:focus-visible::after { opacity: 1; transform: translate(-50%, 0); }
    .sprint-tab__circle:focus-visible, .sprint-tab__icon-btn:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
    .sprint-tab__progress-bar { height: 3px; background: var(--color-widget-track); }
    .sprint-tab__progress-bar:last-child { border-radius: 0 0 11px 11px; }
    .sprint-tab__progress-fill { height: 100%; background: var(--color-widget-shade-1); transition: width 200ms ease; }
    .sprint-tab__body { border-top: 1px solid var(--color-border); padding: 12px 14px; }
    /* Mirrors the board column's always-visible '+ Add Task'. */
    .sprint-tab__footer-add { display: flex; align-items: center; gap: 6px; width: 100%; margin-top: 8px; padding: 7px 10px; border: none; border-radius: 8px; background: transparent; color: var(--color-accent); font: inherit; font-size: 13px; font-weight: 500; text-align: left; cursor: pointer; transition: background-color 140ms ease; }
    .sprint-tab__footer-add:hover { background: color-mix(in srgb, var(--color-accent) 8%, transparent); }
    .sprint-tab__footer-add:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
    .sprint-tab__footer-add-icon { font-size: 15px; line-height: 1; }
    .sprint-tab__body--readonly { font-size: 12px; color: var(--color-text-secondary); }
    @media (max-width: 640px) { .sprint-tab__header { flex-wrap: wrap; } }
  `]
})
export class SprintTabComponent {
  sprint = input.required<Sprint>();
  canManage = input.required<boolean>();
  tasks = input.required<readonly WorkTask[]>();
  statusNames = input.required<Record<string, string>>();
  categoryNames = input<Record<string, string>>({});
  moduleNames = input<Record<string, string>>({});
  statuses = input<readonly TaskStatusColumn[]>([]);
  objectiveOwners = input<Record<string, boolean>>({});
  currentEmployeeId = input('');
  expanded = input(false);
  selectable = input(false);
  selectedIds = input<ReadonlySet<string>>(new Set());

  toggled = output<void>();
  editRequested = output<void>();
  startRequested = output<void>();
  completeRequested = output<void>();
  createTaskRequested = output<void>();
  taskViewed = output<WorkTask>();
  taskStatusChangeRequested = output<{ taskId: string; newStatusId: string }>();
  taskChanged = output<void>();
  taskSelectionChanged = output<{ taskId: string; selected: boolean }>();
  taskSelectAllChanged = output<{ taskIds: string[]; selected: boolean }>();

  private readonly host = inject(ElementRef<HTMLElement>);

  protected readonly menuOpen = computed(() => openSprintMenuId() === this.sprint().id);

  // Same permission rules the old text buttons used — only the access point moved.
  protected readonly canStart = computed(() => this.canManage() && this.sprint().status === 'draft');
  protected readonly canEdit = computed(() => this.canManage() && (this.sprint().status === 'draft' || this.sprint().status === 'active'));
  protected readonly canClose = computed(() => this.canManage() && this.sprint().status === 'active');
  protected readonly canAddTask = computed(() => this.sprint().status !== 'complete');
  protected readonly hasMenuActions = computed(() => this.canEdit() || this.canAddTask() || this.canClose());
  protected readonly hasActions = computed(() => this.canStart() || this.hasMenuActions());

  protected toggleMenu(): void {
    openSprintMenuId.set(this.menuOpen() ? null : this.sprint().id);
  }

  protected runMenuAction(action: OutputEmitterRef<void>): void {
    openSprintMenuId.set(null);
    action.emit();
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (!this.menuOpen()) return;
    const actions = this.host.nativeElement.querySelector('.sprint-tab__actions');
    if (actions && !actions.contains(event.target as Node)) openSprintMenuId.set(null);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.menuOpen()) openSprintMenuId.set(null);
  }

  protected readonly totalEstimatedHours = computed(() =>
    this.tasks().reduce((sum, t) => sum + (t.estimatedHours ?? 0), 0)
  );

  protected readonly totalCompletedHours = computed(() =>
    this.tasks().reduce((sum, t) => sum + (t.completedHours ?? 0), 0)
  );

  protected readonly progressPercent = computed(() => {
    const total = this.totalEstimatedHours();
    if (total <= 0) return 0;
    return Math.min(100, Math.round((this.totalCompletedHours() / total) * 100));
  });

  /** The ring's label: formatPercent, so a small share reads 0.5%, not 0%. */
  protected readonly progressText = computed(() => {
    const total = this.totalEstimatedHours();
    return formatPercent(Math.min(this.totalCompletedHours(), total), total);
  });

  protected readonly statusLabel = computed(() => {
    switch (this.sprint().status) {
      case 'active': return 'In Progress';
      case 'draft': return 'Planned';
      case 'complete': return 'Completed';
      case 'achieved': return 'Achieved';
      default: return this.sprint().status;
    }
  });

  protected readonly daysRemaining = computed(() => {
    const end = this.sprint().endDate;
    if (!end) return null;
    const diff = Math.ceil((end.getTime() - Date.now()) / 86_400_000);
    return diff >= 0 ? diff : null;
  });

  protected readonly isOverdue = computed(() => {
    const end = this.sprint().endDate;
    return this.sprint().status === 'active' && !!end && end.getTime() < Date.now();
  });

  protected readonly daysOverdue = computed(() => {
    const end = this.sprint().endDate;
    if (!end) return 0;
    return Math.max(0, Math.floor((Date.now() - end.getTime()) / 86_400_000));
  });
}
