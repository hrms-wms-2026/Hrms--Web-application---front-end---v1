import { DatePipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { TaskTableComponent } from '../task-table/task-table.component';
import { Sprint } from '../../models/sprint.model';
import { TaskStatusColumn, WorkTask } from '../../models/task.model';

@Component({
  selector: 'app-sprint-tab',
  standalone: true,
  imports: [DatePipe, TaskTableComponent],
  template: `
    <div class="sprint-tab">
      <div class="sprint-tab__header">
        <button type="button" class="sprint-tab__expand" (click)="toggled.emit()" [attr.aria-expanded]="expanded()">
          {{ expanded() ? '▾' : '▸' }} {{ sprint().name }}
        </button>
        <span class="sprint-tab__dates">{{ sprint().startDate | date: 'MMM d' }} – {{ sprint().endDate | date: 'MMM d' }}</span>

        @if (isObjectiveOwner()) {
          <button type="button" class="sprint-tab__edit" aria-label="Edit sprint" (click)="editRequested.emit()">Edit</button>
          <select #statusSelect class="sprint-tab__status-select" [value]="sprint().status" (change)="onStatusPicked(statusSelect)">
            <option value="future">Future</option>
            <option value="active">Active</option>
            <option value="complete">Complete</option>
            <option value="incomplete">Incomplete</option>
            <option value="achieved">Achieved</option>
          </select>
        } @else {
          <span class="sprint-tab__status-text" [attr.data-status]="sprint().status">{{ sprint().status }}</span>
        }
      </div>

      @if (expanded()) {
        <div class="sprint-tab__body">
          <div class="sprint-tab__body-toolbar">
            <button type="button" class="sprint-tab__add-task" aria-label="Add task to this sprint" (click)="createTaskRequested.emit()">+</button>
          </div>
          <app-task-table
            [tasks]="tasks()"
            [statusNames]="statusNames()"
            [statuses]="statuses()"
            [objectiveOwners]="objectiveOwners()"
            (viewed)="taskViewed.emit($event)"
            (statusChangeRequested)="taskStatusChangeRequested.emit($event)"
          />
        </div>
      }
    </div>
  `,
  styles: [`
    .sprint-tab { border: 1px solid var(--color-border); border-radius: 8px; margin-bottom: 8px; overflow: hidden; }
    .sprint-tab__header { display: flex; align-items: center; gap: 12px; padding: 10px 12px; background: var(--color-surface); }
    .sprint-tab__expand { flex: 1; text-align: left; background: none; border: none; cursor: pointer; font-size: 13px; font-weight: 600; color: var(--color-text-primary); }
    .sprint-tab__dates { font-size: 11px; color: var(--color-text-secondary); }
    .sprint-tab__edit { border: 1px solid var(--color-border); border-radius: 6px; padding: 4px 8px; background: var(--color-surface); color: var(--color-text-primary); font-size: 12px; cursor: pointer; }
    .sprint-tab__status-select { border: 1px solid var(--color-border); border-radius: 6px; padding: 4px 6px; background: var(--color-surface); color: var(--color-text-primary); font-size: 12px; }
    .sprint-tab__status-text { font-size: 12px; color: var(--color-text-secondary); text-transform: capitalize; }
    .sprint-tab__body { border-top: 1px solid var(--color-border); padding: 8px 12px; }
    .sprint-tab__body-toolbar { display: flex; justify-content: flex-end; margin-bottom: 6px; }
    .sprint-tab__add-task { width: 24px; height: 24px; border-radius: 999px; border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text-primary); cursor: pointer; font-size: 14px; line-height: 1; }
  `]
})
export class SprintTabComponent {
  sprint = input.required<Sprint>();
  isObjectiveOwner = input.required<boolean>();
  tasks = input.required<readonly WorkTask[]>();
  statusNames = input.required<Record<string, string>>();
  statuses = input<readonly TaskStatusColumn[]>([]);
  objectiveOwners = input<Record<string, boolean>>({});
  expanded = input(false);

  toggled = output<void>();
  editRequested = output<void>();
  statusChangeRequested = output<string>();
  createTaskRequested = output<void>();
  taskViewed = output<WorkTask>();
  taskStatusChangeRequested = output<{ taskId: string; newStatusId: string }>();

  protected onStatusPicked(selectEl: HTMLSelectElement): void {
    const picked = selectEl.value;
    this.statusChangeRequested.emit(picked);
    // Always resync to the real status - Angular's [value] binding won't rewrite the DOM if the
    // bound value happens to be unchanged (e.g. the picked status was rejected or is a no-op), but
    // the browser's own native <select> state already changed the instant the user picked it.
    queueMicrotask(() => {
      selectEl.value = this.sprint().status;
    });
  }
}
