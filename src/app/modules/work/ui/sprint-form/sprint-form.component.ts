import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { DateRangePickerComponent } from '../../../../shared/ui/date-range-picker/date-range-picker.component';
import { ModuleTaskPickerComponent } from '../module-task-picker/module-task-picker.component';
import { SprintListStore } from '../../state/sprint-list.store';
import { Sprint } from '../../models/sprint.model';
import { TaskApiService } from '../../data-access/task-api.service';

export interface SprintFormModuleOption {
  objectiveId: string;
  title: string;
  isEffectiveOwner: boolean;
}

@Component({
  selector: 'app-sprint-form',
  standalone: true,
  imports: [ModalComponent, InputComponent, ButtonComponent, DateRangePickerComponent, ModuleTaskPickerComponent],
  template: `
    <app-modal [open]="open()" [title]="mode() === 'edit' ? 'Edit sprint' : 'Create sprint'" size="lg" (closed)="cancelled.emit()">
      <div class="sprint-form">
        <app-input label="Sprint name" [value]="name()" (valueChange)="name.set($event)" />
        @if (nameError()) {
          <p class="sprint-form__error" role="alert">{{ nameError() }}</p>
        }
        <app-input label="Sprint goal (optional)" [value]="goal()" (valueChange)="goal.set($event)" />
        @if (mode() === 'edit' && sprint()?.status === 'active') {
          <div class="sprint-form__date-range" data-testid="sprint-date-range">
            <label class="sprint-form__label">Sprint dates</label>
            <app-date-range-picker
              [from]="startDate()"
              [to]="endDate()"
              placeholder="Select start and end date"
              (rangeChange)="onDateRangeChange($event)"
            />
          </div>
        }

        <div class="sprint-form__tasks">
          <label class="sprint-form__label">Tasks</label>
          <p class="sprint-form__hint">You can add tasks from modules you own. A task already in another sprint will move here.</p>
          <div class="sprint-form__picker">
            <app-module-task-picker
              moduleMode="bulk"
              [modules]="modules()"
              [allowedObjectiveIds]="allowedObjectiveIds()"
              [sprintNames]="sprintNames()"
              [frozenSprintIds]="frozenSprintIds()"
              [currentSprintId]="sprint()?.id ?? null"
              [selectedTaskIds]="selectedTaskIds()"
              (selectedTaskIdsChange)="selectedTaskIds.set($event)"
            />
          </div>
          <p class="sprint-form__hint">{{ selectedTaskIds().size }} task(s) selected</p>
        </div>

        @if (store.error()) {
          <p class="sprint-form__error" role="alert">{{ store.error() }}</p>
        }

        <div class="sprint-form__actions">
          <app-button variant="secondary" [disabled]="submitting()" (pressed)="cancelled.emit()">Cancel</app-button>
          <app-button variant="primary" [loading]="submitting()" (pressed)="submit()">
            {{ mode() === 'edit' ? 'Save changes' : 'Create sprint' }}
          </app-button>
        </div>
      </div>
    </app-modal>
  `,
  styles: [`
    .sprint-form { display: flex; flex-direction: column; gap: 8px; }
    .sprint-form__error { color: var(--color-danger-text); font-size: 12px; }
    .sprint-form__actions { display: flex; justify-content: flex-end; gap: 8px; }
    .sprint-form__date-range { display: flex; flex-direction: column; gap: 4px; }
    .sprint-form__label { font-size: 12px; font-weight: 500; color: var(--color-text-secondary); }
    .sprint-form__tasks { display: flex; flex-direction: column; gap: 4px; }
    .sprint-form__picker { max-height: 18rem; overflow-y: auto; border: 1px solid var(--color-border); border-radius: 6px; padding: 8px; }
    .sprint-form__hint { font-size: 12px; color: var(--color-text-secondary); margin: 0; }
    :host ::ng-deep .sprint-form__date-range app-date-range-picker { width: 100%; display: block; }
    :host ::ng-deep .sprint-form__date-range .drp-container { width: 100%; display: flex; }
    :host ::ng-deep .sprint-form__date-range .drp-trigger {
      width: 100%;
      min-height: 38px;
      padding: 0.375rem 0.75rem;
      border-radius: 6px;
      font-size: 0.875rem;
      font-weight: 400;
      justify-content: flex-start;
      gap: 0.5rem;
      border: 1px solid var(--color-border);
      background-color: var(--color-surface);
      color: var(--color-text-primary);
    }
    :host ::ng-deep .sprint-form__date-range .drp-popover { z-index: 100; }
  `]
})
export class SprintFormComponent {
  protected readonly store = inject(SprintListStore);
  private readonly taskApi = inject(TaskApiService);

  mode = input<'create' | 'edit'>('create');
  open = input(false);
  projectId = input.required<string>();
  modules = input<readonly SprintFormModuleOption[]>([]);
  sprint = input<Sprint | null>(null);
  allSprints = input<readonly Sprint[]>([]);

  created = output<void>();
  saved = output<void>();
  cancelled = output<void>();

  protected readonly name = signal('');
  protected readonly goal = signal('');
  protected readonly startDate = signal('');
  protected readonly endDate = signal('');
  protected readonly submitting = signal(false);
  protected readonly nameError = signal<string | null>(null);
  protected readonly selectedTaskIds = signal<Set<string>>(new Set());
  private initialTaskIds = new Set<string>();

  protected readonly allowedObjectiveIds = computed(() =>
    new Set(this.modules().filter((m) => m.isEffectiveOwner).map((m) => m.objectiveId))
  );
  protected readonly sprintNames = computed(() =>
    Object.fromEntries(this.allSprints().map((s) => [s.id, s.name]))
  );
  protected readonly frozenSprintIds = computed(() =>
    new Set(this.allSprints().filter((s) => s.status === 'achieved').map((s) => s.id))
  );

  constructor() {
    effect(() => {
      this.open();
      const current = this.sprint();
      this.nameError.set(null);
      if (this.mode() === 'edit' && current) {
        this.name.set(current.name);
        this.goal.set(current.goal ?? '');
        this.startDate.set(current.startDate ? current.startDate.toISOString().slice(0, 10) : '');
        this.endDate.set(current.endDate ? current.endDate.toISOString().slice(0, 10) : '');
        void this.loadCurrentTasks(current.id);
      } else if (this.mode() === 'create') {
        this.name.set('');
        this.goal.set('');
        this.initialTaskIds = new Set();
        this.selectedTaskIds.set(new Set());
      }
    });
  }

  onDateRangeChange(range: { from: string; to: string }): void {
    this.startDate.set(range.from);
    this.endDate.set(range.to);
  }

  private async loadCurrentTasks(sprintId: string): Promise<void> {
    try {
      const tasks = await firstValueFrom(this.taskApi.getBySprintId(sprintId));
      this.initialTaskIds = new Set(tasks.map((t) => t.id));
    } catch {
      this.initialTaskIds = new Set();
    }
    this.selectedTaskIds.set(new Set(this.initialTaskIds));
  }

  async submit(): Promise<void> {
    if (!this.name().trim()) {
      this.nameError.set('Sprint name is required.');
      return;
    }
    this.nameError.set(null);
    this.submitting.set(true);
    try {
      if (this.mode() === 'create') {
        const ok = await this.store.create(this.projectId(), {
          name: this.name().trim(),
          goal: this.goal().trim() || undefined,
          taskIds: [...this.selectedTaskIds()]
        });
        if (ok) this.created.emit();
        return;
      }

      const current = this.sprint();
      if (!current) return;
      const isActive = current.status === 'active';
      const edited = await this.store.edit(current.id, {
        name: this.name().trim(),
        goal: this.goal().trim() || null,
        startDate: isActive ? this.startDate() : undefined,
        endDate: isActive ? this.endDate() : undefined
      }, this.projectId());
      if (!edited) return;

      const selected = this.selectedTaskIds();
      const addTaskIds = [...selected].filter((id) => !this.initialTaskIds.has(id));
      const removeTaskIds = [...this.initialTaskIds].filter((id) => !selected.has(id));
      if (addTaskIds.length > 0 || removeTaskIds.length > 0) {
        const ok = await this.store.setTasks(current.id, { addTaskIds, removeTaskIds }, this.projectId());
        if (!ok) return;
      }
      this.saved.emit();
    } finally {
      this.submitting.set(false);
    }
  }
}
