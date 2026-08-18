import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TaskApiService } from '../../data-access/task-api.service';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { BoardStructureEditorComponent } from '../../ui/board-structure-editor/board-structure-editor.component';
import { TaskStatusColumn } from '../../models/task.model';
import { toTaskStatusColumn } from '../../utils/task.mapper';

@Component({
  selector: 'app-objective-settings',
  standalone: true,
  imports: [ButtonComponent, BoardStructureEditorComponent],
  template: `
    <div class="objective-settings__header" data-testid="objective-settings-tab-task-statuses">
      <h2 class="objective-settings__title">Task statuses</h2>
      <app-button variant="secondary" (pressed)="editOpen.set(true)">Edit</app-button>
    </div>

    <app-board-structure-editor
      [open]="editOpen()"
      [objectiveId]="objectiveId"
      [statuses]="statuses()"
      (closed)="editOpen.set(false)"
      (saved)="reload()"
    />
  `,
  styles: [`
    .objective-settings__header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .objective-settings__title { font-size: 15px; font-weight: 600; color: var(--color-text-primary); margin: 0; }
  `]
})
export class ObjectiveSettingsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly taskApi = inject(TaskApiService);

  protected readonly editOpen = signal(false);
  protected readonly statuses = signal<TaskStatusColumn[]>([]);
  protected objectiveId = '';

  async ngOnInit(): Promise<void> {
    this.objectiveId = this.route.parent?.snapshot.paramMap.get('milestoneId') ?? '';
    await this.reload();
  }

  protected async reload(): Promise<void> {
    const dtos = await firstValueFrom(this.taskApi.getStatuses(this.objectiveId));
    this.statuses.set(dtos.map(toTaskStatusColumn));
  }
}
