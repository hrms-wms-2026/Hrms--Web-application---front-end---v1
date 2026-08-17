import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { TaskBoardStore } from '../../state/task-board.store';
import { TaskCreateModalComponent } from '../../ui/task-create-modal/task-create-modal.component';
import { TaskDetailModalComponent } from '../../ui/task-detail-modal/task-detail-modal.component';
import { TaskTableComponent } from '../../ui/task-table/task-table.component';
import { SprintListComponent } from '../../ui/sprint-list/sprint-list.component';
import { SprintApiService } from '../../data-access/sprint-api.service';
import { ObjectiveMemberApiService } from '../../data-access/objective-member-api.service';
import { EmployeeDirectoryStore } from '../../state/employee-directory.store';
import { toSprint } from '../../utils/sprint.mapper';
import { Sprint } from '../../models/sprint.model';
import { WorkTask } from '../../models/task.model';

@Component({
  selector: 'app-task-backlog',
  standalone: true,
  imports: [TaskTableComponent, TaskCreateModalComponent, TaskDetailModalComponent, SprintListComponent, ButtonComponent],
  template: `
    <div class="task-backlog__toolbar">
      <app-button variant="primary" (pressed)="createOpen.set(true)">Create task</app-button>
    </div>

    @if (milestoneId()) {
      <app-sprint-list
        [objectiveId]="milestoneId()!"
        [isObjectiveOwner]="isObjectiveOwner()"
        (sprintSelected)="filterSprint.set($event)"
      />
    }

    @if (store.loading()) {
      <p>Loading backlog…</p>
    } @else if (store.error()) {
      <p class="task-backlog__error">{{ store.error() }}</p>
    } @else {
      <app-task-table [tasks]="visibleTasks()" [statusNames]="statusNames()" (viewed)="onTaskViewed($event)" />
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
      (closed)="detailOpen.set(false)"
    />
  `,
  styles: [`
    .task-backlog__toolbar { display: flex; justify-content: flex-end; margin-bottom: 12px; }
    .task-backlog__error { color: var(--color-danger); }
  `]
})
export class TaskBacklogComponent implements OnInit {
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
  protected readonly filterSprint = signal<Sprint | null>(null);

  protected readonly statusNames = computed(() =>
    Object.fromEntries(this.store.statuses().map((s) => [s.id, s.name]))
  );

  protected readonly visibleTasks = computed(() => {
    const filter = this.filterSprint();
    return filter ? this.store.tasks().filter((t) => t.sprintId === filter.id) : this.store.tasks();
  });

  ngOnInit(): void {
    const id = this.route.parent?.snapshot.paramMap.get('milestoneId') ?? null;
    this.milestoneId.set(id);
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

  onTaskViewed(task: WorkTask): void {
    this.selectedTask.set(task);
    this.detailOpen.set(true);
  }
}
