import { AfterViewChecked, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TaskBoardStore } from '../../state/task-board.store';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { TaskBoardColumnComponent } from '../../ui/task-board-column/task-board-column.component';
import { TaskCreateModalComponent } from '../../ui/task-create-modal/task-create-modal.component';
import { TaskDetailModalComponent } from '../../ui/task-detail-modal/task-detail-modal.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { SprintApiService } from '../../data-access/sprint-api.service';
import { ObjectiveMemberApiService } from '../../data-access/objective-member-api.service';
import { EmployeeDirectoryStore } from '../../state/employee-directory.store';
import { toSprint } from '../../utils/sprint.mapper';
import { Sprint } from '../../models/sprint.model';
import { WorkTask } from '../../models/task.model';

@Component({
  selector: 'app-task-board',
  standalone: true,
  imports: [TaskBoardColumnComponent, TaskCreateModalComponent, TaskDetailModalComponent, ButtonComponent],
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
        @for (column of columnsWithTasks(); track column.status.id) {
          <app-task-board-column
            [status]="column.status"
            [tasks]="column.tasks"
            [connectedListIds]="columnIds()"
            (taskDropped)="onTaskDropped($event)"
            (taskViewed)="onTaskViewed($event)"
          />
        }
      </div>
    }

    @if (milestoneId()) {
      <app-task-create-modal
        [open]="createOpen()"
        [objectiveId]="milestoneId()!"
        [isObjectiveOwner]="isObjectiveOwner()"
        [activeSprints]="activeSprints()"
        [assignableMembers]="assignableMembers()"
        (closed)="createOpen.set(false)"
        (created)="createOpen.set(false)"
      />
    }

    <app-task-detail-modal
      [open]="detailOpen()"
      [task]="selectedTask()"
      [isObjectiveOwner]="isObjectiveOwner()"
      [statuses]="store.statuses()"
      (closed)="detailOpen.set(false)"
      (saved)="onTaskSaved()"
      (statusChangeRequested)="onStatusChangeRequested($event)"
    />
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
  private readonly sprintApi = inject(SprintApiService);
  private readonly memberApi = inject(ObjectiveMemberApiService);
  private readonly directory = inject(EmployeeDirectoryStore);

  protected readonly createOpen = signal(false);
  protected readonly detailOpen = signal(false);
  protected readonly selectedTask = signal<WorkTask | null>(null);
  protected readonly milestoneId = signal<string | null>(null);
  protected readonly isObjectiveOwner = signal(false);
  protected readonly activeSprints = signal<Sprint[]>([]);
  protected readonly assignableMembers = signal<{ employeeId: string; name: string }[]>([]);
  private highlightTaskId: string | null = null;
  private didScrollToHighlight = false;

  protected readonly columnsWithTasks = computed(() => {
    const activeSprintIds = new Set(this.activeSprints().map((s) => s.id));
    return this.store.columnsWithTasks().map((column) => ({
      status: column.status,
      tasks: column.tasks.filter((t) => activeSprintIds.has(t.sprintId ?? ''))
    }));
  });

  columnIds(): string[] {
    return this.columnsWithTasks().map((c) => c.status.id);
  }

  ngOnInit(): void {
    const id = this.route.parent?.snapshot.paramMap.get('milestoneId') ?? null;
    this.milestoneId.set(id);
    this.highlightTaskId = this.route.snapshot.queryParamMap.get('highlightTaskId');
    if (!id) return;

    const fromList = this.projectStore.milestones().find((m) => m.objectiveId === id);
    this.isObjectiveOwner.set(fromList?.isOwner ?? false);
    void this.store.loadBoard(id);
    void firstValueFrom(this.sprintApi.getByObjective(id, true)).then((dtos) => this.activeSprints.set(dtos.map(toSprint)));
    void firstValueFrom(this.memberApi.getMembers(id)).then(async (list) => {
      const active = list.items.filter((m) => !m.pending);
      await this.directory.ensureLoaded(active.map((m) => m.employeeId));
      this.assignableMembers.set(
        active.map((m) => ({ employeeId: m.employeeId, name: this.directory.get(m.employeeId)?.name ?? 'Unknown employee' }))
      );
    });

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

  onTaskViewed(task: WorkTask): void {
    this.selectedTask.set(task);
    this.detailOpen.set(true);
  }

  protected onStatusChangeRequested(newStatusId: string): void {
    const taskId = this.selectedTask()?.id;
    if (taskId) void this.store.moveTask(taskId, newStatusId);
  }

  protected onTaskSaved(): void {
    if (this.milestoneId()) void this.store.loadBoard(this.milestoneId()!);
  }
}
