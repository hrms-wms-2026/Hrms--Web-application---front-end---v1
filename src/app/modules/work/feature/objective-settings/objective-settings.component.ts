import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TaskApiService } from '../../data-access/task-api.service';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { BoardStructureEditorComponent } from '../../ui/board-structure-editor/board-structure-editor.component';
import { TaskStatusColumn } from '../../models/task.model';
import { toTaskStatusColumn } from '../../utils/task.mapper';

@Component({
  selector: 'app-objective-settings',
  standalone: true,
  imports: [InputComponent, ButtonComponent, BoardStructureEditorComponent],
  template: `
    <div class="objective-settings__header" data-testid="objective-settings-tab-task-statuses">
      <h2 class="objective-settings__title">Task statuses</h2>
      <app-button variant="secondary" (pressed)="editOpen.set(true)">Edit</app-button>
    </div>

    @if (loading()) {
      <p>Loading…</p>
    } @else {
      <table class="objective-settings__table">
        <thead>
          <tr><th>Name</th><th>Order</th><th>Visibility</th><th>Marks complete</th><th></th></tr>
        </thead>
        <tbody>
          @for (status of statuses(); track status.id) {
            <tr>
              <td>{{ status.name }}</td>
              <td>{{ status.displayOrder }}</td>
              <td>{{ status.visibility }}</td>
              <td>{{ status.marksTaskComplete ? 'Yes' : 'No' }}</td>
              <td><app-button variant="secondary" (pressed)="remove(status.id)">Delete</app-button></td>
            </tr>
          }
        </tbody>
      </table>

      <div class="mt-4 flex flex-col gap-2">
        <app-input label="New status name" [value]="newName()" (valueChange)="newName.set($event)" />
        <label class="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
          <input type="checkbox" [checked]="newIsPrivate()" (change)="newIsPrivate.set($any($event.target).checked)" />
          Private (only I can move a task into this status)
        </label>
        <label class="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
          <input type="checkbox" [checked]="newMarksComplete()" (change)="newMarksComplete.set($any($event.target).checked)" />
          Marks a task as complete
        </label>
        <app-button variant="primary" (pressed)="add()">Add status</app-button>
      </div>

      @if (errorMessage()) {
        <p class="mt-2 text-sm text-[var(--color-danger-text)]" role="alert">{{ errorMessage() }}</p>
      }
    }

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
    .objective-settings__table { width: 100%; border-collapse: collapse; }
    .objective-settings__table th, .objective-settings__table td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--color-border); font-size: 13px; }
  `]
})
export class ObjectiveSettingsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly taskApi = inject(TaskApiService);

  protected readonly editOpen = signal(false);
  protected readonly loading = signal(true);
  protected readonly statuses = signal<TaskStatusColumn[]>([]);
  protected readonly newName = signal('');
  protected readonly newIsPrivate = signal(false);
  protected readonly newMarksComplete = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected objectiveId = '';

  async ngOnInit(): Promise<void> {
    this.objectiveId = this.route.parent?.snapshot.paramMap.get('milestoneId') ?? '';
    await this.reload();
  }

  protected async reload(): Promise<void> {
    this.loading.set(true);
    const dtos = await firstValueFrom(this.taskApi.getStatuses(this.objectiveId));
    this.statuses.set(dtos.map(toTaskStatusColumn));
    this.loading.set(false);
  }

  async add(): Promise<void> {
    const name = this.newName().trim();
    if (!name) return;
    this.errorMessage.set(null);
    try {
      await firstValueFrom(this.taskApi.createStatus(this.objectiveId, {
        name,
        displayOrder: this.statuses().length,
        visibility: this.newIsPrivate() ? 'private' : 'public',
        marksTaskComplete: this.newMarksComplete(),
        requiresApproval: false
      }));
      this.newName.set('');
      this.newIsPrivate.set(false);
      this.newMarksComplete.set(false);
      await this.reload();
    } catch (err: unknown) {
      const detail = (err as { error?: { detail?: string } })?.error?.detail;
      this.errorMessage.set(detail || 'Failed to add the status.');
    }
  }

  async remove(statusId: string): Promise<void> {
    this.errorMessage.set(null);
    try {
      await firstValueFrom(this.taskApi.deleteStatus(statusId));
      await this.reload();
    } catch (err: unknown) {
      const detail = (err as { error?: { detail?: string } })?.error?.detail;
      this.errorMessage.set(detail || 'Move all tasks out of this status before deleting it.');
    }
  }
}
