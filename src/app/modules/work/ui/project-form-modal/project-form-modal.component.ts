import { Component, OnInit, effect, inject, input, output, signal } from '@angular/core';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ProjectCategoryStore } from '../../state/project-category.store';
import { validateProjectForm, ProjectFormFields } from '../../utils/project-form.validator';
import { CreateProjectPayload, EditProjectPayload, Project } from '../../models/project.model';

@Component({
  selector: 'app-project-form-modal',
  standalone: true,
  imports: [ModalComponent, InputComponent, SelectComponent, ButtonComponent],
  template: `
    <app-modal [open]="open()" [title]="mode() === 'create' ? 'Create project' : 'Edit project'" (closed)="closed.emit()">
      <div class="flex flex-col gap-3">
        <span data-testid="name-field">
          <app-input label="Name" [value]="name()" [error]="errors()['name'] ?? ''" (valueChange)="name.set($event)" />
        </span>

        @if (mode() === 'create') {
          <span data-testid="identifier-field">
            <app-input label="Identifier" [value]="identifier()" [error]="errors()['identifier'] ?? ''" (valueChange)="identifier.set($event)" />
          </span>
        }

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

        @if (mode() === 'create') {
          <span data-testid="release-date-field">
            <app-input label="Release date" type="date" [value]="releaseDate()" [error]="errors()['releaseDate'] ?? ''" (valueChange)="releaseDate.set($event)" />
          </span>
        }

        <span data-testid="allocated-hours-field">
          <app-input label="Allocated hours" type="number" [value]="allocatedHoursDisplay()" [error]="errors()['allocatedHours'] ?? ''" (valueChange)="onAllocatedHoursChange($event)" />
        </span>

        @if (errorMessage()) {
          <p class="text-sm text-[var(--color-danger-text)]" role="alert">{{ errorMessage() }}</p>
        }

        <div class="mt-2 flex justify-end gap-2">
          <span data-testid="cancel-button">
            <app-button variant="secondary" [disabled]="submitting()" (pressed)="closed.emit()">Cancel</app-button>
          </span>
          <span data-testid="submit-button">
            <app-button variant="primary" [loading]="submitting()" (pressed)="submit()">
              {{ mode() === 'create' ? 'Create' : 'Save changes' }}
            </app-button>
          </span>
        </div>
      </div>
    </app-modal>
  `
})
export class ProjectFormModalComponent implements OnInit {
  private readonly categoryStore = inject(ProjectCategoryStore);

  open = input(false);
  mode = input.required<'create' | 'edit'>();
  /** Accepts either a list-page `Project` (no `description`) or a full `ProjectDetail` — whichever the caller has on hand. */
  initialValue = input<(Project & { description?: string | null }) | null>(null);
  submitting = input(false);
  errorMessage = input<string>('');

  createSubmitted = output<CreateProjectPayload>();
  editSubmitted = output<EditProjectPayload>();
  closed = output<void>();

  name = signal('');
  identifier = signal('');
  categoryId = signal('');
  description = signal('');
  startDate = signal('');
  targetDate = signal('');
  releaseDate = signal('');
  allocatedHours = signal(0);
  errors = signal<Record<string, string>>({});

  constructor() {
    effect(() => {
      const value = this.initialValue();
      if (value) {
        this.name.set(value.name);
        this.identifier.set(value.identifier);
        this.categoryId.set(value.categoryId);
        this.description.set(value.description ?? '');
        this.startDate.set(value.startDate);
        this.targetDate.set(value.targetDate);
        this.allocatedHours.set(value.allocatedHours);
      }
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

  private buildFields(): ProjectFormFields {
    return {
      name: this.name(), identifier: this.identifier(), categoryId: this.categoryId(),
      startDate: this.startDate(), targetDate: this.targetDate(), releaseDate: this.releaseDate(),
      allocatedHours: this.allocatedHours()
    };
  }

  submit(): void {
    const fields = this.buildFields();
    const errors = validateProjectForm(fields, this.mode());
    this.errors.set(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    if (this.mode() === 'create') {
      this.createSubmitted.emit({
        categoryId: fields.categoryId, name: fields.name, identifier: fields.identifier,
        description: this.description(), startDate: fields.startDate, targetDate: fields.targetDate,
        releaseDate: fields.releaseDate, color: '', actualHours: 0,
        defaultObjectiveAllocatedHours: fields.allocatedHours
      });
    } else {
      this.editSubmitted.emit({
        name: fields.name, description: this.description(), categoryId: fields.categoryId,
        startDate: fields.startDate, targetDate: fields.targetDate, color: '', actualHours: 0
      });
    }
  }
}
