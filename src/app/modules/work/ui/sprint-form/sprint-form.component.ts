import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { WorkDropdownComponent, WorkDropdownOption } from '../work-dropdown/work-dropdown.component';
import { DateRangePickerComponent } from '../../../../shared/ui/date-range-picker/date-range-picker.component';
import { SprintListStore } from '../../state/sprint-list.store';
import { Sprint } from '../../models/sprint.model';

export interface SprintFormModuleOption {
  objectiveId: string;
  title: string;
  isOwner: boolean;
}

@Component({
  selector: 'app-sprint-form',
  standalone: true,
  imports: [ModalComponent, InputComponent, ButtonComponent, WorkDropdownComponent, DateRangePickerComponent],
  template: `
    <app-modal [open]="open()" [title]="mode() === 'edit' ? 'Edit sprint' : 'Create sprint'" (closed)="cancelled.emit()">
      <div class="sprint-form">
        @if (mode() === 'create' && modules().length > 0) {
          <app-work-dropdown
            [options]="moduleOptions()"
            [selected]="selectedObjectiveId()"
            fieldLabel="Module"
            placeholder="Select a module"
            [error]="moduleError() || ''"
            leadingIcon="module"
            [fullWidth]="true"
            (selectionChanged)="selectedObjectiveId.set($event)"
          />
        }
        <app-input label="Sprint name" [value]="name()" (valueChange)="name.set($event)" />
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

        @if (store.error()) {
          <p class="sprint-form__error" role="alert">{{ store.error() }}</p>
        }
        @if (moduleError()) {
          <p class="sprint-form__error" role="alert">{{ moduleError() }}</p>
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

  mode = input<'create' | 'edit'>('create');
  open = input(false);
  objectiveId = input<string>('');
  projectId = input<string>('');
  modules = input<readonly SprintFormModuleOption[]>([]);
  isObjectiveOwner = input(false);
  sprint = input<Sprint | null>(null);

  created = output<void>();
  saved = output<void>();
  cancelled = output<void>();

  protected readonly name = signal('');
  protected readonly goal = signal('');
  protected readonly startDate = signal('');
  protected readonly endDate = signal('');
  protected readonly submitting = signal(false);
  protected readonly selectedObjectiveId = signal('');
  protected readonly moduleError = signal<string | null>(null);

  protected readonly moduleOptions = computed<WorkDropdownOption[]>(() =>
    this.modules().map((module) => ({ value: module.objectiveId, label: module.title }))
  );

  protected readonly effectiveObjectiveId = computed(() =>
    this.modules().length > 0 ? this.selectedObjectiveId() : this.objectiveId()
  );

  constructor() {
    effect(() => {
      this.open();
      const current = this.sprint();
      if (this.mode() === 'edit' && current) {
        this.name.set(current.name);
        this.goal.set(current.goal ?? '');
        this.startDate.set(current.startDate ? current.startDate.toISOString().slice(0, 10) : '');
        this.endDate.set(current.endDate ? current.endDate.toISOString().slice(0, 10) : '');
      } else if (this.mode() === 'create') {
        this.name.set('');
        this.goal.set('');
        this.selectedObjectiveId.set('');
      }
      this.moduleError.set(null);
    });
  }

  onDateRangeChange(range: { from: string; to: string }): void {
    this.startDate.set(range.from);
    this.endDate.set(range.to);
  }

  async submit(): Promise<void> {
    this.moduleError.set(null);
    if (this.mode() === 'create') {
      const objectiveId = this.effectiveObjectiveId();
      if (!objectiveId) {
        this.moduleError.set('Select a module first.');
        return;
      }

      this.submitting.set(true);
      try {
        const ok = await this.store.create(this.projectId(), {
          name: this.name().trim(),
          goal: this.goal().trim() || undefined
        });
        if (ok) {
          this.name.set('');
          this.goal.set('');
          this.selectedObjectiveId.set('');
          this.created.emit();
        }
      } finally {
        this.submitting.set(false);
      }
      return;
    }

    const current = this.sprint();
    if (!current) return;
    this.submitting.set(true);
    try {
      const isActive = current.status === 'active';
      const ok = await this.store.edit(current.id, {
        name: this.name().trim(),
        goal: this.goal().trim() || null,
        startDate: isActive ? this.startDate() : undefined,
        endDate: isActive ? this.endDate() : undefined
      }, this.projectId());
      if (ok) this.saved.emit();
    } finally {
      this.submitting.set(false);
    }
  }
}
