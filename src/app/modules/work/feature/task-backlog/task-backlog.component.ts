import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { TaskBoardStore } from '../../state/task-board.store';
import { SprintListStore } from '../../state/sprint-list.store';
import { ObjectiveMemberApiService } from '../../data-access/objective-member-api.service';
import { EmployeeDirectoryStore } from '../../state/employee-directory.store';
import { TaskCreateModalComponent } from '../../ui/task-create-modal/task-create-modal.component';
import { TaskDetailModalComponent } from '../../ui/task-detail-modal/task-detail-modal.component';
import { SprintTabComponent } from '../../ui/sprint-tab/sprint-tab.component';
import { SprintCreateFormComponent } from '../../ui/sprint-create-form/sprint-create-form.component';
import { TaskTableComponent } from '../../ui/task-table/task-table.component';
import { WorkTask } from '../../models/task.model';

@Component({
  selector: 'app-task-backlog',
  standalone: true,
  imports: [TaskCreateModalComponent, TaskDetailModalComponent, SprintTabComponent, SprintCreateFormComponent, TaskTableComponent, ButtonComponent],
  template: `
    @if (milestoneId(); as mId) {
      @if (isObjectiveOwner()) {
        <div class="task-backlog__toolbar">
          <app-button variant="primary" (pressed)="createSprintOpen.set(true)">Create Sprint</app-button>
        </div>

        <app-sprint-create-form
          [open]="createSprintOpen()"
          [objectiveId]="mId"
          [isObjectiveOwner]="isObjectiveOwner()"
          (created)="createSprintOpen.set(false)"
          (cancelled)="createSprintOpen.set(false)"
        />
      }
    }

    @if (sprintStore.error() || sprintActionMessage()) {
      <p class="task-backlog__sprint-message" role="alert">{{ sprintStore.error() ?? sprintActionMessage() }}</p>
    }

    @if (store.loading() || sprintStore.loading()) {
      <p>Loading…</p>
    } @else if (store.error()) {
      <p class="task-backlog__error">{{ store.error() }}</p>
    } @else {
      @for (sprint of sprintStore.sprints(); track sprint.id) {
        <app-sprint-tab
          [sprint]="sprint"
          [isObjectiveOwner]="isObjectiveOwner()"
          [tasks]="tasksForSprint(sprint.id)"
          [statusNames]="statusNames()"
          [expanded]="expandedSprintId() === sprint.id"
          (toggled)="toggleExpanded(sprint.id)"
          (statusChangeRequested)="onSprintStatusChangeRequested(sprint.id, $event)"
          (createTaskRequested)="onCreateTaskForSprint(sprint.id)"
          (taskViewed)="onTaskViewed($event)"
        />
      }

      @if (unsortedTasks().length > 0) {
        <div class="task-backlog__unsorted">
          <h3 class="task-backlog__unsorted-title">Unsorted</h3>
          <app-task-table [tasks]="unsortedTasks()" [statusNames]="statusNames()" (viewed)="onTaskViewed($event)" />
        </div>
      }
    }

    @if (milestoneId(); as mId) {
      <app-task-create-modal
        [open]="createOpen()"
        [objectiveId]="mId"
        [isObjectiveOwner]="isObjectiveOwner()"
        [activeSprints]="createModalSprints()"
        [assignableMembers]="assignableMembers()"
        (closed)="createOpen.set(false)"
        (created)="onTaskCreated()"
      />
      <app-task-detail-modal
        [open]="detailOpen()"
        [task]="selectedTask()"
        [isObjectiveOwner]="isObjectiveOwner()"
        [statuses]="store.statuses()"
        (closed)="detailOpen.set(false)"
        (saved)="reloadTasks()"
        (statusChangeRequested)="onTaskStatusChangeRequested($event)"
      />
    }
  `,
  styles: [`
    .task-backlog__toolbar { display: flex; justify-content: flex-end; margin-bottom: 12px; }
    .task-backlog__error { color: var(--color-danger); }
    .task-backlog__sprint-message { color: var(--color-danger-text, var(--color-danger)); font-size: 12px; margin-bottom: 8px; }
    .task-backlog__unsorted { margin-top: 16px; }
    .task-backlog__unsorted-title { font-size: 13px; font-weight: 600; color: var(--color-text-primary); margin: 0 0 8px; }
  `]
})
export class TaskBacklogComponent implements OnInit {
  protected readonly store = inject(TaskBoardStore);
  protected readonly sprintStore = inject(SprintListStore);
  private readonly projectStore = inject(ProjectDetailStore);
  private readonly memberApi = inject(ObjectiveMemberApiService);
  private readonly directory = inject(EmployeeDirectoryStore);
  private readonly route = inject(ActivatedRoute);

  protected readonly createOpen = signal(false);
  protected readonly createSprintOpen = signal(false);
  protected readonly detailOpen = signal(false);
  protected readonly selectedTask = signal<WorkTask | null>(null);
  protected readonly milestoneId = signal<string | null>(null);
  protected readonly isObjectiveOwner = signal(false);
  protected readonly expandedSprintId = signal<string | null>(null);
  protected readonly createForSprintId = signal<string | null>(null);
  protected readonly assignableMembers = signal<{ employeeId: string; name: string }[]>([]);
  protected readonly sprintActionMessage = signal<string | null>(null);

  protected readonly statusNames = computed(() => Object.fromEntries(this.store.statuses().map((s) => [s.id, s.name])));
  protected readonly createModalSprints = computed(() =>
    this.createForSprintId() ? this.sprintStore.sprints().filter((s) => s.id === this.createForSprintId()) : this.sprintStore.sprints()
  );
  // Tasks with no sprint, or whose sprint isn't among the currently-loaded sprints (e.g. an
  // orphaned reference to a deleted sprint), have nowhere to render inside the per-sprint tabs.
  protected readonly unsortedTasks = computed(() => {
    const knownSprintIds = new Set(this.sprintStore.sprints().map((s) => s.id));
    return this.store.tasks().filter((t) => t.sprintId == null || !knownSprintIds.has(t.sprintId));
  });

  ngOnInit(): void {
    const id = this.route.parent?.snapshot.paramMap.get('milestoneId') ?? null;
    this.milestoneId.set(id);
    if (!id) return;

    const fromList = this.projectStore.milestones().find((m) => m.objectiveId === id);
    this.isObjectiveOwner.set(fromList?.isOwner ?? false);
    void this.store.loadBoard(id);
    void this.sprintStore.load(id, !this.isObjectiveOwner());
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

  tasksForSprint(sprintId: string): WorkTask[] {
    return this.store.tasks().filter((t) => t.sprintId === sprintId);
  }

  toggleExpanded(sprintId: string): void {
    this.expandedSprintId.set(this.expandedSprintId() === sprintId ? null : sprintId);
  }

  onCreateTaskForSprint(sprintId: string): void {
    this.createForSprintId.set(sprintId);
    this.createOpen.set(true);
  }

  onTaskCreated(): void {
    this.createOpen.set(false);
    this.createForSprintId.set(null);
    void this.reloadTasks();
  }

  async reloadTasks(): Promise<void> {
    const id = this.milestoneId();
    if (id) await this.store.loadBoard(id);
  }

  onTaskViewed(task: WorkTask): void {
    this.selectedTask.set(task);
    this.detailOpen.set(true);
  }

  async onSprintStatusChangeRequested(sprintId: string, newStatus: string): Promise<void> {
    const id = this.milestoneId();
    if (!id) return;
    // Only Complete and Achieve are owner-settable actions - Future/Active/Incomplete are date-driven
    // by SprintLifecycleJob (see the note in Part 7's plan doc). Picking anything else here is a
    // no-op with a message, not a call to a non-existent endpoint.
    if (newStatus === 'complete') {
      this.sprintActionMessage.set(null);
      await this.sprintStore.complete(sprintId, id, !this.isObjectiveOwner());
    } else if (newStatus === 'achieved') {
      this.sprintActionMessage.set(null);
      await this.sprintStore.achieve(sprintId, id, !this.isObjectiveOwner());
    } else {
      this.sprintActionMessage.set("This status changes automatically and can't be set manually.");
    }
  }

  onTaskStatusChangeRequested(newStatusId: string): void {
    const taskId = this.selectedTask()?.id;
    if (taskId) void this.store.moveTask(taskId, newStatusId);
  }
}
