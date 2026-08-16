import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TaskBoardStore } from '../../state/task-board.store';
import { TaskBoardColumnComponent } from '../../ui/task-board-column/task-board-column.component';

@Component({
  selector: 'app-task-board',
  standalone: true,
  imports: [TaskBoardColumnComponent],
  template: `
    @if (store.loading()) {
      <p>Loading board…</p>
    } @else if (store.error()) {
      <p class="task-board__error">{{ store.error() }}</p>
    } @else {
      <div class="task-board">
        @for (column of store.columnsWithTasks(); track column.status.id) {
          <app-task-board-column
            [status]="column.status"
            [tasks]="column.tasks"
            [connectedListIds]="columnIds()"
            (taskDropped)="onTaskDropped($event)"
          />
        }
      </div>
    }
  `,
  styles: [`
    .task-board { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 8px; }
    .task-board__error { color: var(--color-danger); }
  `]
})
export class TaskBoardComponent implements OnInit {
  protected readonly store = inject(TaskBoardStore);
  private readonly route = inject(ActivatedRoute);

  columnIds(): string[] {
    return this.store.columnsWithTasks().map((c) => c.status.id);
  }

  ngOnInit(): void {
    const milestoneId = this.route.parent?.snapshot.paramMap.get('milestoneId');
    if (milestoneId) void this.store.loadBoard(milestoneId);
  }

  onTaskDropped(event: { taskId: string; newStatusId: string }): void {
    void this.store.moveTask(event.taskId, event.newStatusId);
  }
}
