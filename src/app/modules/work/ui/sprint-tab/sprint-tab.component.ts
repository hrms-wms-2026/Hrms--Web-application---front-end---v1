import { DatePipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { TaskTableComponent } from '../task-table/task-table.component';
import { Sprint } from '../../models/sprint.model';
import { TaskStatusColumn, WorkTask } from '../../models/task.model';

@Component({
  selector: 'app-sprint-tab',
  standalone: true,
  imports: [DatePipe, TaskTableComponent],
  template: `
    <div class="sprint-tab" [attr.data-status]="sprint().status">
      <div class="sprint-tab__header">
        <button type="button" class="sprint-tab__expand" (click)="toggled.emit()" [attr.aria-expanded]="expanded()">
          <svg class="sprint-tab__expand-icon" [class.rotate-90]="expanded()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
          <span class="min-w-0 truncate">{{ sprint().name }}</span>
        </button>

        @if (sprint().status === 'draft') {
          <span class="sprint-tab__dates">No dates set</span>
        } @else if (sprint().startDate && sprint().endDate) {
          <span class="sprint-tab__dates">{{ sprint().startDate | date: 'MMM d' }} – {{ sprint().endDate | date: 'MMM d' }}</span>
          @if (isOverdue()) {
            <span class="sprint-tab__overdue">{{ daysOverdue() }} day{{ daysOverdue() === 1 ? '' : 's' }} overdue</span>
          } @else if (sprint().status === 'active' && daysRemaining() !== null) {
            <span class="sprint-tab__remaining">{{ daysRemaining() }} day{{ daysRemaining() === 1 ? '' : 's' }} remaining</span>
          }
        }

        <span class="sprint-tab__counts">{{ tasks().length }} tasks · {{ totalEstimatedHours() }}h estimated</span>

        @if (isObjectiveOwner()) {
          @if (sprint().status === 'draft') {
            <button type="button" class="sprint-tab__edit" (click)="editRequested.emit()"><span>Edit sprint</span></button>
            <button type="button" class="sprint-tab__primary" data-testid="start-sprint" (click)="startRequested.emit()">Start sprint →</button>
          } @else if (sprint().status === 'active') {
            <button type="button" class="sprint-tab__edit" (click)="editRequested.emit()"><span>Edit</span></button>
            <button type="button" class="sprint-tab__primary" data-testid="complete-sprint" (click)="completeRequested.emit()">Complete Sprint</button>
          } @else {
            <span class="sprint-tab__status-text" [attr.data-status]="sprint().status">{{ sprint().status }}</span>
          }
        } @else {
          <span class="sprint-tab__status-text" [attr.data-status]="sprint().status"><span class="sprint-tab__status-dot" aria-hidden="true"></span>{{ sprint().status }}</span>
        }
      </div>

      @if (expanded() && sprint().status !== 'complete') {
        <div class="sprint-tab__body">
          <div class="sprint-tab__body-toolbar">
            <button type="button" class="sprint-tab__add-task" aria-label="Add task to this sprint" title="Add task to this sprint" (click)="createTaskRequested.emit()"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg></button>
          </div>
          <app-task-table
            [tasks]="tasks()"
            [statusNames]="statusNames()"
            [statuses]="statuses()"
            [objectiveOwners]="objectiveOwners()"
            [currentEmployeeId]="currentEmployeeId()"
            (viewed)="taskViewed.emit($event)"
            (statusChangeRequested)="taskStatusChangeRequested.emit($event)"
            (taskChanged)="taskChanged.emit()"
          />
        </div>
      } @else if (expanded() && sprint().status === 'complete') {
        <div class="sprint-tab__body sprint-tab__body--readonly">{{ tasks().length }} tasks in this completed sprint.</div>
      }
    </div>
  `,
  styles: [`
    .sprint-tab { border: 1px solid var(--color-border); border-radius: 12px; margin-bottom: 10px; overflow: hidden; background: var(--color-surface); box-shadow: 0 1px 2px rgb(15 23 42 / 0.03); }
    .sprint-tab[data-status="complete"] { opacity: 0.75; }
    .sprint-tab__header { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; min-height: 52px; padding: 10px 14px; background: var(--color-surface); }
    .sprint-tab__expand { display: inline-flex; min-width: 0; flex: 1; align-items: center; gap: 7px; text-align: left; background: none; border: none; cursor: pointer; font-size: 13px; font-weight: 600; color: var(--color-text-primary); }
    .sprint-tab__expand:focus-visible, .sprint-tab__edit:focus-visible, .sprint-tab__primary:focus-visible, .sprint-tab__add-task:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
    .sprint-tab__expand-icon { width: 15px; height: 15px; flex: 0 0 auto; color: var(--color-accent); transition: transform 180ms ease; }
    .sprint-tab__dates, .sprint-tab__counts { flex: 0 0 auto; font-size: 11px; color: var(--color-text-secondary); }
    .sprint-tab__overdue { flex: 0 0 auto; font-size: 11px; font-weight: 600; color: var(--color-danger-text, #b91c1c); }
    .sprint-tab__remaining { flex: 0 0 auto; font-size: 11px; color: var(--color-text-secondary); }
    .sprint-tab__edit, .sprint-tab__primary { display: inline-flex; align-items: center; gap: 5px; border: 1px solid var(--color-border); border-radius: 8px; padding: 7px 10px; background: var(--color-surface); color: var(--color-text-secondary); font-size: 12px; font-weight: 500; cursor: pointer; transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease; }
    .sprint-tab__primary { border-color: var(--color-accent); color: var(--color-accent); font-weight: 600; }
    .sprint-tab__edit:hover, .sprint-tab__primary:hover { border-color: var(--color-accent); background: var(--color-surface-secondary); color: var(--color-text-primary); }
    .sprint-tab__status-text { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--color-text-secondary); text-transform: capitalize; }
    .sprint-tab__status-dot { width: 7px; height: 7px; border-radius: 999px; background: var(--color-accent); }
    .sprint-tab__body { border-top: 1px solid var(--color-border); padding: 12px 14px; }
    .sprint-tab__body--readonly { font-size: 12px; color: var(--color-text-secondary); }
    .sprint-tab__body-toolbar { display: flex; justify-content: flex-end; margin-bottom: 8px; }
    .sprint-tab__add-task { display: inline-flex; width: 30px; height: 30px; align-items: center; justify-content: center; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-accent); cursor: pointer; transition: background-color 160ms ease, border-color 160ms ease; }
    .sprint-tab__add-task:hover { border-color: var(--color-accent); background: var(--color-surface-secondary); }
    .sprint-tab__add-task svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; }
    @media (max-width: 640px) { .sprint-tab__header { flex-wrap: wrap; } }
  `]
})
export class SprintTabComponent {
  sprint = input.required<Sprint>();
  isObjectiveOwner = input.required<boolean>();
  tasks = input.required<readonly WorkTask[]>();
  statusNames = input.required<Record<string, string>>();
  statuses = input<readonly TaskStatusColumn[]>([]);
  objectiveOwners = input<Record<string, boolean>>({});
  currentEmployeeId = input('');
  expanded = input(false);

  toggled = output<void>();
  editRequested = output<void>();
  startRequested = output<void>();
  completeRequested = output<void>();
  createTaskRequested = output<void>();
  taskViewed = output<WorkTask>();
  taskStatusChangeRequested = output<{ taskId: string; newStatusId: string }>();
  taskChanged = output<void>();

  protected readonly totalEstimatedHours = computed(() =>
    this.tasks().reduce((sum, t) => sum + (t.estimatedHours ?? 0), 0)
  );

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
