import { CdkDrag, CdkDragDrop, CdkDragPlaceholder, CdkDragPreview, CdkDropList } from '@angular/cdk/drag-drop';
import { Component, input, output } from '@angular/core';
import { TaskStatusColumn, WorkTask } from '../../models/task.model';
import { TaskCardComponent } from '../task-card/task-card.component';

@Component({
  selector: 'app-task-board-column',
  standalone: true,
  imports: [CdkDropList, CdkDrag, CdkDragPlaceholder, CdkDragPreview, TaskCardComponent],
  template: `
    <div class="task-board-column">
      <h3 class="task-board-column__title">{{ status().name }} ({{ tasks().length }})</h3>
      <div
        cdkDropList
        [id]="status().id"
        [cdkDropListData]="tasks()"
        [cdkDropListConnectedTo]="connectedListIds()"
        (cdkDropListDropped)="onDrop($event)"
        class="task-board-column__list"
      >
        @for (task of tasks(); track task.id) {
          <div cdkDrag [cdkDragData]="task" class="task-board-column__drag-item">
            <app-task-card
              [task]="task"
              [statuses]="allStatuses()"
              [employeeNames]="employeeNames()"
              [currentEmployeeId]="currentEmployeeId()"
              (viewed)="taskViewed.emit($event)"
              (taskChanged)="taskChanged.emit()"
            />
            <div *cdkDragPreview class="task-board-column__drag-preview">
              <span class="task-board-column__drag-preview-id">{{ task.shortId }}</span>
              <span class="task-board-column__drag-preview-title">{{ task.title }}</span>
            </div>
            <div *cdkDragPlaceholder class="task-board-column__drag-placeholder"></div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .task-board-column {
      display: flex;
      flex-direction: column;
      background: var(--color-surface-secondary);
      border: 1px solid var(--color-border);
      border-radius: 12px;
      padding: 12px;
      min-width: 280px;
      min-height: 180px;
      box-shadow: 0 1px 2px rgb(15 23 42 / 0.03);
      scroll-snap-align: start;
    }
    .task-board-column__title {
      display: flex;
      align-items: center;
      min-height: 24px;
      font-size: 13px;
      font-weight: 600;
      color: var(--color-text-primary);
      margin: 0 0 10px;
    }
    .task-board-column__list {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 10px;
      min-height: 56px;
    }
    .task-board-column__drag-item { display: block; }
    .task-board-column__drag-preview {
      display: flex;
      width: 260px;
      flex-direction: column;
      gap: 6px;
      border: 1px solid var(--color-accent);
      border-radius: 12px;
      padding: 12px 14px;
      background: var(--color-surface);
      box-shadow: 0 14px 30px rgb(15 23 42 / 0.18);
      transform: rotate(1deg) scale(1.02);
      cursor: grabbing;
    }
    .task-board-column__drag-preview-id { font-size: 10px; color: var(--color-text-secondary); }
    .task-board-column__drag-preview-title { overflow: hidden; color: var(--color-text-primary); font-size: 13px; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
    .task-board-column__drag-placeholder {
      min-height: 78px;
      border: 1px dashed color-mix(in srgb, var(--color-accent) 55%, var(--color-border));
      border-radius: 12px;
      background: color-mix(in srgb, var(--color-accent) 8%, transparent);
      animation: task-drop-placeholder-in 180ms ease-out;
    }
    :host ::ng-deep .task-board-column__list.cdk-drop-list-dragging .task-board-column__drag-item:not(.cdk-drag-placeholder) {
      transition: transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    :host ::ng-deep .task-board-column__drag-item.cdk-drag-animating {
      transition: transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    @keyframes task-drop-placeholder-in {
      from { opacity: 0; transform: scaleY(0.82); }
      to { opacity: 1; transform: scaleY(1); }
    }
    @media (prefers-reduced-motion: reduce) {
      .task-board-column__drag-preview, .task-board-column__drag-placeholder { animation: none; transform: none; }
      :host ::ng-deep .task-board-column__list.cdk-drop-list-dragging .task-board-column__drag-item:not(.cdk-drag-placeholder),
      :host ::ng-deep .task-board-column__drag-item.cdk-drag-animating { transition: none; }
    }
  `]
})
export class TaskBoardColumnComponent {
  status = input.required<TaskStatusColumn>();
  tasks = input.required<WorkTask[]>();
  connectedListIds = input<string[]>([]);
  allStatuses = input<readonly TaskStatusColumn[]>([]);
  employeeNames = input<Record<string, string>>({});
  currentEmployeeId = input('');
  taskDropped = output<{ taskId: string; newStatusId: string }>();
  taskViewed = output<WorkTask>();
  taskChanged = output<void>();

  onDrop(event: CdkDragDrop<WorkTask[]>): void {
    if (event.previousContainer === event.container) return;
    const task = event.item.data as WorkTask;
    this.taskDropped.emit({ taskId: task.id, newStatusId: event.container.id });
  }
}
