import { Component, OnInit, inject, input, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TaskApiService } from '../../data-access/task-api.service';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { BoardStructureEditorComponent } from '../../ui/board-structure-editor/board-structure-editor.component';
import { TaskStatusColumn } from '../../models/task.model';
import { toTaskStatusColumn } from '../../utils/task.mapper';

@Component({
  selector: 'app-task-status-settings-tab',
  standalone: true,
  imports: [ButtonComponent, BoardStructureEditorComponent],
  template: `
    <div class="project-settings-tab__header" data-testid="project-settings-tab-task-statuses">
      <h2 class="project-settings-tab__title">Task statuses</h2>
      <app-button variant="secondary" (pressed)="editOpen.set(true)">Edit</app-button>
    </div>

    <app-board-structure-editor
      [open]="editOpen()"
      [projectId]="projectId()"
      [statuses]="statuses()"
      (closed)="editOpen.set(false)"
      (saved)="reload()"
    />
  `,
  styles: [`
    .project-settings-tab__header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .project-settings-tab__title { font-size: 15px; font-weight: 600; color: var(--color-text-primary); margin: 0; }
  `]
})
export class TaskStatusSettingsTabComponent implements OnInit {
  private readonly taskApi = inject(TaskApiService);

  readonly projectId = input.required<string>();
  protected readonly editOpen = signal(false);
  protected readonly statuses = signal<TaskStatusColumn[]>([]);

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  protected async reload(): Promise<void> {
    const dtos = await firstValueFrom(this.taskApi.getStatuses(this.projectId()));
    this.statuses.set(dtos.map(toTaskStatusColumn));
  }
}

