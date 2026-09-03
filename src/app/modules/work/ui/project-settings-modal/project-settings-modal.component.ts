import { Component, OnInit, effect, inject, input, output, signal } from '@angular/core';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ProjectCategoryStore } from '../../state/project-category.store';
import { validateProjectForm, ProjectFormFields } from '../../utils/project-form.validator';
import { EditProjectPayload, ProjectDetail } from '../../models/project.model';

@Component({
  selector: 'app-project-settings-modal',
  standalone: true,
  imports: [ModalComponent, InputComponent, SelectComponent, ButtonComponent],
  template: `
    <app-modal [open]="open()" title="Project settings" (closed)="closed.emit()">
      <div class="flex flex-col gap-3">
        <span data-testid="name-field">
          <app-input label="Name" [value]="name()" [error]="errors()['name'] ?? ''" (valueChange)="name.set($event)" />
        </span>

        <span data-testid="category-field">
          <app-select label="Category" placeholder="Select a category" [options]="categoryOptions()" [value]="categoryId()" [error]="errors()['categoryId'] ?? ''" (valueChange)="categoryId.set($event)" />
        </span>

        <span data-testid="description-field">
          <app-input label="Description" [value]="description()" (valueChange)="description.set($event)" />
        </span>

        <span data-testid="start-date-field">
          <app-input label="Start date" type="date" [value]="startDate()" [error]="errors()['startDate'] ?? ''" (valueChange)="startDate.set($event)" />
        </span>

        <span data-testid="target-date-field">
          <app-input label="Target date" type="date" [value]="targetDate()" [error]="errors()['targetDate'] ?? ''" (valueChange)="targetDate.set($event)" />
        </span>

        <span data-testid="allocated-hours-field">
          <app-input label="Allocated hours" type="number" [value]="allocatedHoursDisplay()" [error]="errors()['allocatedHours'] ?? ''" (valueChange)="onAllocatedHoursChange($event)" />
        </span>

        <span data-testid="color-field">
          <app-input label="Color" placeholder="#2563EB" [value]="color()" (valueChange)="color.set($event)" />
        </span>

        <span data-testid="achieved-field" class="flex items-center gap-2">
          <input type="checkbox" id="project-achieved-toggle" [checked]="achieved()" (change)="onAchievedChange($event)" />
          <label for="project-achieved-toggle" class="text-sm text-[var(--color-text-primary)]">Achieved</label>
        </span>

        @if (errorMessage()) {
          <p class="text-sm text-[var(--color-danger-text)]" role="alert">{{ errorMessage() }}</p>
        }

        <div class="mt-2 flex justify-end gap-2">
          <span data-testid="cancel-button">
            <app-button variant="secondary" [disabled]="submitting()" (pressed)="closed.emit()">Cancel</app-button>
          </span>
          <span data-testid="submit-button">
            <app-button variant="primary" [loading]="submitting()" (pressed)="submit()">Save changes</app-button>
          </span>
        </div>
      </div>
    </app-modal>
  `
})
export class ProjectSettingsModalComponent implements OnInit {
  private readonly categoryStore = inject(ProjectCategoryStore);

  open = input(false);
  initialValue = input<ProjectDetail | null>(null);
  submitting = input(false);
  errorMessage = input<string>('');

  saved = output<{ fields: EditProjectPayload; achievedChanged: boolean; achieved: boolean }>();
  closed = output<void>();

  name = signal('');
  categoryId = signal('');
  description = signal('');
  startDate = signal('');
  targetDate = signal('');
  allocatedHours = signal(0);
  color = signal('');
  achieved = signal(false);
  errors = signal<Record<string, string>>({});

  constructor() {
    effect(() => {
      const value = this.initialValue();
      if (value) {
        this.name.set(value.name);
        this.categoryId.set(value.categoryId);
        this.description.set(value.description ?? '');
        this.startDate.set(value.startDate);
        this.targetDate.set(value.targetDate);
        this.allocatedHours.set(value.allocatedHours);
        this.color.set(value.color ?? '');
        this.achieved.set(value.isAchieved);
      } else {
        this.name.set('');
        this.categoryId.set('');
        this.description.set('');
        this.startDate.set('');
        this.targetDate.set('');
        this.allocatedHours.set(0);
        this.color.set('');
        this.achieved.set(false);
      }
      this.errors.set({});
    });
  }

  ngOnInit(): void {
    this.categoryStore.loadCategories();
  }

  categoryOptions(): SelectOption[] {
    return this.categoryStore.categories().map((c) => ({ value: c.id, label: c.name }));
  }

  allocatedHoursDisplay(): string {
    return String(this.allocatedHours());
  }

  onAllocatedHoursChange(value: string): void {
    this.allocatedHours.set(value === '' ? 0 : Number(value));
  }

  onAchievedChange(event: Event): void {
    this.achieved.set((event.target as HTMLInputElement).checked);
  }

  submit(): void {
    const fields: ProjectFormFields = {
      name: this.name(), identifier: '', categoryId: this.categoryId(),
      startDate: this.startDate(), targetDate: this.targetDate(), releaseDate: '',
      allocatedHours: this.allocatedHours()
    };
    const errors = validateProjectForm(fields, 'edit');
    this.errors.set(errors);
    if (Object.keys(errors).length > 0) return;

    const initial = this.initialValue();
    const achievedChanged = initial !== null && this.achieved() !== initial.isAchieved;

    this.saved.emit({
      fields: {
        name: fields.name, description: this.description(), categoryId: fields.categoryId,
        startDate: fields.startDate, targetDate: fields.targetDate, color: this.color(), actualHours: 0,
        allocatedHours: this.allocatedHours()
      },
      achievedChanged,
      achieved: this.achieved()
    });
  }
}
