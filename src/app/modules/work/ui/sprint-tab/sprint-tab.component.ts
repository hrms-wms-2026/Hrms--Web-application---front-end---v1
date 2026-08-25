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
          <svg class="sprint-tab__expand-icon" [class.rotate-90]="expanded()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
          <span class="min-w-0 truncate">{{ sprint().name }}</span>
        </button>
        <span class="sprint-tab__dates">{{ sprint().startDate | date: 'MMM d' }} – {{ sprint().endDate | date: 'MMM d' }}</span>

        @if (isObjectiveOwner()) {
          <button type="button" class="sprint-tab__edit" aria-label="Edit sprint" title="Edit sprint" (click)="editRequested.emit()"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg><span>Edit</span></button>
          <span class="sprint-tab__status-wrap">
            <svg class="sprint-tab__status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="8" /><path d="M12 8v4l2.5 2" /></svg>
            <select #statusSelect class="sprint-tab__status-select" [value]="sprint().status" (change)="onStatusPicked(statusSelect)">
              <option value="future">Future</option>
              <option value="active">Active</option>
              <option value="complete">Complete</option>
              <option value="incomplete">Incomplete</option>
              <option value="achieved">Achieved</option>
            </select>
            <svg class="sprint-tab__status-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
          </span>
        } @else {
          <span class="sprint-tab__status-text" [attr.data-status]="sprint().status"><span class="sprint-tab__status-dot" aria-hidden="true"></span>{{ sprint().status }}</span>
        }
      </div>

      @if (expanded()) {
        <div class="sprint-tab__body">
          <div class="sprint-tab__body-toolbar">
            <button type="button" class="sprint-tab__add-task" aria-label="Add task to this sprint" title="Add task to this sprint" (click)="createTaskRequested.emit()"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg></button>
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
    .sprint-tab { border: 1px solid var(--color-border); border-radius: 12px; margin-bottom: 10px; overflow: hidden; background: var(--color-surface); box-shadow: 0 1px 2px rgb(15 23 42 / 0.03); }
    .sprint-tab__header { display: flex; align-items: center; gap: 12px; min-height: 52px; padding: 10px 14px; background: var(--color-surface); }
    .sprint-tab__expand { display: inline-flex; min-width: 0; flex: 1; align-items: center; gap: 7px; text-align: left; background: none; border: none; cursor: pointer; font-size: 13px; font-weight: 600; color: var(--color-text-primary); }
    .sprint-tab__expand:focus-visible, .sprint-tab__edit:focus-visible, .sprint-tab__add-task:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
    .sprint-tab__expand-icon { width: 15px; height: 15px; flex: 0 0 auto; color: var(--color-accent); transition: transform 180ms ease; }
    .sprint-tab__dates { flex: 0 0 auto; font-size: 11px; color: var(--color-text-secondary); }
    .sprint-tab__edit { display: inline-flex; align-items: center; gap: 5px; border: 1px solid var(--color-border); border-radius: 8px; padding: 7px 10px; background: var(--color-surface); color: var(--color-text-secondary); font-size: 12px; font-weight: 500; cursor: pointer; transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease; }
    .sprint-tab__edit:hover { border-color: var(--color-accent); background: var(--color-surface-secondary); color: var(--color-text-primary); }
    .sprint-tab__edit svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .sprint-tab__status-wrap { position: relative; display: inline-flex; align-items: center; }
    .sprint-tab__status-icon { pointer-events: none; position: absolute; left: 10px; width: 14px; height: 14px; color: var(--color-accent); }
    .sprint-tab__status-select { appearance: none; min-width: 118px; height: 34px; border: 1px solid var(--color-border); border-radius: 8px; padding: 0 28px 0 30px; background: var(--color-surface); color: var(--color-text-primary); font-size: 12px; font-weight: 500; cursor: pointer; }
    .sprint-tab__status-select:hover { border-color: var(--color-accent); }
    .sprint-tab__status-select:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
    .sprint-tab__status-chevron { pointer-events: none; position: absolute; right: 9px; width: 14px; height: 14px; color: var(--color-text-secondary); }
    .sprint-tab__status-text { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--color-text-secondary); text-transform: capitalize; }
    .sprint-tab__status-dot { width: 7px; height: 7px; border-radius: 999px; background: var(--color-accent); }
    .sprint-tab__body { border-top: 1px solid var(--color-border); padding: 12px 14px; }
    .sprint-tab__body-toolbar { display: flex; justify-content: flex-end; margin-bottom: 8px; }
    .sprint-tab__add-task { display: inline-flex; width: 30px; height: 30px; align-items: center; justify-content: center; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-accent); cursor: pointer; transition: background-color 160ms ease, border-color 160ms ease; }
    .sprint-tab__add-task:hover { border-color: var(--color-accent); background: var(--color-surface-secondary); }
    .sprint-tab__add-task svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; }
    @media (max-width: 640px) { .sprint-tab__header { flex-wrap: wrap; } .sprint-tab__dates { margin-left: 22px; } }
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
