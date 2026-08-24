import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { Component, input, output } from '@angular/core';
import { TaskStatusColumn, WorkTask } from '../../models/task.model';
import { TaskCardComponent } from '../task-card/task-card.component';

@Component({
  selector: 'app-task-board-column',
  standalone: true,
  imports: [CdkDropList, CdkDrag, TaskCardComponent],
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
          <div cdkDrag [cdkDragData]="task">
            <app-task-card [task]="task" (viewed)="taskViewed.emit($event)" />
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .task-board-column {
      background: var(--color-surface-secondary);
      border-radius: 10px;
      padding: 10px;
      min-width: 260px;
    }
    .task-board-column__title {
      font-size: 13px;
      font-weight: 600;
      color: var(--color-text-primary);
      margin-bottom: 8px;
    }
    .task-board-column__list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-height: 40px;
    }
  `]
})
export class TaskBoardColumnComponent {
  status = input.required<TaskStatusColumn>();
  tasks = input.required<WorkTask[]>();
  connectedListIds = input<string[]>([]);
  taskDropped = output<{ taskId: string; newStatusId: string }>();
  taskViewed = output<WorkTask>();

  onDrop(event: CdkDragDrop<WorkTask[]>): void {
    if (event.previousContainer === event.container) return;
    const task = event.item.data as WorkTask;
    this.taskDropped.emit({ taskId: task.id, newStatusId: event.container.id });
  }
}
