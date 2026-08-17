import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { TaskBoardStore } from '../../state/task-board.store';
import { TaskCreateModalComponent } from '../../ui/task-create-modal/task-create-modal.component';
import { TaskTableComponent } from '../../ui/task-table/task-table.component';
import { SprintApiService } from '../../data-access/sprint-api.service';
import { ObjectiveMemberApiService } from '../../data-access/objective-member-api.service';
import { toSprint } from '../../utils/sprint.mapper';
import { Sprint } from '../../models/sprint.model';

@Component({
  selector: 'app-task-backlog',
  standalone: true,
  imports: [TaskTableComponent, TaskCreateModalComponent, ButtonComponent],
  template: `
    <div class="task-backlog__toolbar">
      <app-button variant="primary" (pressed)="createOpen.set(true)">Create task</app-button>
    </div>

    @if (store.loading()) {
      <p>Loading backlog…</p>
    } @else if (store.error()) {
      <p class="task-backlog__error">{{ store.error() }}</p>
    } @else {
      <app-task-table [tasks]="store.tasks()" [statusNames]="statusNames()" />
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

  protected readonly createOpen = signal(false);
  protected readonly milestoneId = signal<string | null>(null);
  protected readonly isObjectiveOwner = signal(false);
  protected readonly activeSprints = signal<Sprint[]>([]);
  protected readonly assignableMembers = signal<{ employeeId: string; name: string }[]>([]);

  protected readonly statusNames = computed(() =>
    Object.fromEntries(this.store.statuses().map((s) => [s.id, s.name]))
  );

  ngOnInit(): void {
    const id = this.route.parent?.snapshot.paramMap.get('milestoneId') ?? null;
    this.milestoneId.set(id);
    if (!id) return;

    const fromList = this.projectStore.milestones().find((m) => m.objectiveId === id);
    this.isObjectiveOwner.set(fromList?.isOwner ?? false);
    void this.store.loadBoard(id);
    void firstValueFrom(this.sprintApi.getByObjective(id, true)).then((dtos) => this.activeSprints.set(dtos.map(toSprint)));
    void firstValueFrom(this.memberApi.getMembers(id)).then((list) =>
      this.assignableMembers.set(
        list.items.filter((m) => !m.pending).map((m) => ({ employeeId: m.employeeId, name: m.employeeId }))
      )
    );

    if (!fromList) {
      void this.projectStore.getMilestoneDetail(id).then((detail) => {
        if (detail) this.isObjectiveOwner.set(detail.isOwner);
      });
    }
  }
}
