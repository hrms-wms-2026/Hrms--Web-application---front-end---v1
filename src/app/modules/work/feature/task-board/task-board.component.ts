import { AfterViewChecked, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TaskBoardStore } from '../../state/task-board.store';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { TaskBoardColumnComponent } from '../../ui/task-board-column/task-board-column.component';
import { TaskCreateModalComponent } from '../../ui/task-create-modal/task-create-modal.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';

@Component({
  selector: 'app-task-board',
  standalone: true,
  imports: [TaskBoardColumnComponent, TaskCreateModalComponent, ButtonComponent],
  template: `
    <div class="task-board__toolbar">
      <app-button variant="primary" (pressed)="createOpen.set(true)">Create task</app-button>
    </div>

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

    @if (milestoneId()) {
      <app-task-create-modal
        [open]="createOpen()"
        [objectiveId]="milestoneId()!"
        [isObjectiveOwner]="isObjectiveOwner()"
        (closed)="createOpen.set(false)"
        (created)="createOpen.set(false)"
      />
    }
  `,
  styles: [`
    .task-board__toolbar { display: flex; justify-content: flex-end; margin-bottom: 12px; }
    .task-board { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 8px; }
    .task-board__error { color: var(--color-danger); }
    :host ::ng-deep .task-card--highlighted {
      outline: 2px solid var(--color-focus-ring, var(--color-danger));
      outline-offset: 2px;
    }
  `]
})
export class TaskBoardComponent implements OnInit, AfterViewChecked {
  protected readonly store = inject(TaskBoardStore);
  private readonly projectStore = inject(ProjectDetailStore);
  private readonly route = inject(ActivatedRoute);

  protected readonly createOpen = signal(false);
  protected readonly milestoneId = signal<string | null>(null);
  protected readonly isObjectiveOwner = signal(false);
  private highlightTaskId: string | null = null;
  private didScrollToHighlight = false;

  columnIds(): string[] {
    return this.store.columnsWithTasks().map((c) => c.status.id);
  }

  ngOnInit(): void {
    const id = this.route.parent?.snapshot.paramMap.get('milestoneId') ?? null;
    this.milestoneId.set(id);
    this.highlightTaskId = this.route.snapshot.queryParamMap.get('highlightTaskId');
    if (!id) return;

    const fromList = this.projectStore.milestones().find((m) => m.objectiveId === id);
    this.isObjectiveOwner.set(fromList?.isOwner ?? false);
    void this.store.loadBoard(id);

    if (!fromList) {
      void this.projectStore.getMilestoneDetail(id).then((detail) => {
        if (detail) this.isObjectiveOwner.set(detail.isOwner);
      });
    }
  }

  ngAfterViewChecked(): void {
    if (!this.highlightTaskId || this.didScrollToHighlight || this.store.loading()) return;
    const el = document.querySelector(`[data-testid="task-card-${this.highlightTaskId}"]`) as HTMLElement | null;
    if (!el) return;
    this.didScrollToHighlight = true;
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    el.classList.add('task-card--highlighted');
  }

  onTaskDropped(event: { taskId: string; newStatusId: string }): void {
    void this.store.moveTask(event.taskId, event.newStatusId);
  }
}
