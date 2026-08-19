import { Component, OnInit, effect, inject, input, output, signal } from '@angular/core';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ProjectCategoryStore } from '../../state/project-category.store';
import { validateProjectForm, ProjectFormFields } from '../../utils/project-form.validator';
import { CreateProjectPayload } from '../../models/project.model';

@Component({
  selector: 'app-project-form-modal',
  standalone: true,
  imports: [ModalComponent, InputComponent, SelectComponent, ButtonComponent],
  template: `
    <app-modal [open]="open()" title="Create project" size="xl" (closed)="closed.emit()">
      <div class="flex flex-col gap-4">
        <!-- Row 1: Name + Identifier -->
        <div class="grid grid-cols-2 gap-4">
          <span data-testid="name-field">
            <app-input label="Name" [value]="name()" [error]="errors()['name'] ?? ''" (valueChange)="name.set($event)" />
          </span>
          <span data-testid="identifier-field">
            <app-input label="Identifier" [value]="identifier()" [error]="errors()['identifier'] ?? ''" (valueChange)="identifier.set($event)" />
          </span>
        </div>

        <!-- Row 2: Category + Description -->
        <div class="grid grid-cols-2 gap-4">
          <span data-testid="category-field">
            <app-select label="Category" placeholder="Select a category" [options]="categoryOptions()" [value]="categoryId()" [error]="errors()['categoryId'] ?? ''" (valueChange)="categoryId.set($event)" />
          </span>
          <span data-testid="description-field">
            <app-input label="Description" [value]="description()" (valueChange)="description.set($event)" />
          </span>
        </div>

        <!-- Row 3: Start + Target + Release dates -->
        <div class="grid grid-cols-3 gap-4">
          <span data-testid="start-date-field">
            <app-input label="Start date" type="date" [value]="startDate()" [error]="errors()['startDate'] ?? ''" (valueChange)="startDate.set($event)" />
          </span>
          <span data-testid="target-date-field">
            <app-input label="Target date" type="date" [value]="targetDate()" [error]="errors()['targetDate'] ?? ''" (valueChange)="targetDate.set($event)" />
          </span>
          <span data-testid="release-date-field">
            <app-input label="Release date" type="date" [value]="releaseDate()" [error]="errors()['releaseDate'] ?? ''" (valueChange)="releaseDate.set($event)" />
          </span>
        </div>

        <!-- Row 4: Allocated hours + Color + Logo -->
        <div class="grid grid-cols-3 gap-4">
          <span data-testid="allocated-hours-field">
            <app-input label="Allocated hours" type="number" [value]="allocatedHoursDisplay()" [error]="errors()['allocatedHours'] ?? ''" (valueChange)="onAllocatedHoursChange($event)" />
          </span>
          <span data-testid="color-field">
            <app-input label="Color" placeholder="#2563EB" [value]="color()" (valueChange)="color.set($event)" />
          </span>
          <span data-testid="logo-field" class="flex flex-col gap-1">
            <label class="text-xs font-medium text-[var(--color-text-secondary)]">Logo</label>
            <input type="file" accept="image/png,image/jpeg,image/webp" (change)="onLogoFileSelected($event)" class="text-sm text-[var(--color-text-secondary)]" />
            @if (logoFile(); as file) {
              <span class="text-xs text-[var(--color-text-secondary)]">{{ file.name }}</span>
            }
          </span>
        </div>

        @if (errorMessage()) {
          <p class="text-sm text-[var(--color-danger-text)]" role="alert">{{ errorMessage() }}</p>
        }

        <div class="mt-1 flex justify-end gap-2">
          <span data-testid="cancel-button">
            <app-button variant="secondary" [disabled]="submitting()" (pressed)="closed.emit()">Cancel</app-button>
          </span>
          <span data-testid="submit-button">
            <app-button variant="primary" [loading]="submitting()" (pressed)="submit()">Create</app-button>
          </span>
        </div>
      </div>
    </app-modal>
  `
})
export class ProjectFormModalComponent implements OnInit {
  private readonly categoryStore = inject(ProjectCategoryStore);

  open = input(false);
  submitting = input(false);
  errorMessage = input<string>('');

  createSubmitted = output<CreateProjectPayload>();
  closed = output<void>();

  name = signal('');
  identifier = signal('');
  categoryId = signal('');
  description = signal('');
  startDate = signal('');
  targetDate = signal('');
  releaseDate = signal('');
  allocatedHours = signal(0);
  color = signal('');
  logoFile = signal<File | null>(null);
  errors = signal<Record<string, string>>({});

  constructor() {
    effect(() => {
      if (this.open()) {
        this.name.set('');
        this.identifier.set('');
        this.categoryId.set('');
        this.description.set('');
        this.startDate.set('');
        this.targetDate.set('');
        this.releaseDate.set('');
        this.allocatedHours.set(0);
        this.color.set('');
        this.logoFile.set(null);
        this.errors.set({});
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

  onLogoFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.logoFile.set(input.files?.[0] ?? null);
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
    const errors = validateProjectForm(fields, 'create');
    this.errors.set(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    this.createSubmitted.emit({
      categoryId: fields.categoryId, name: fields.name, identifier: fields.identifier,
      description: this.description(), startDate: fields.startDate, targetDate: fields.targetDate,
      releaseDate: fields.releaseDate, color: this.color(), actualHours: 0,
      defaultObjectiveAllocatedHours: fields.allocatedHours, logoFile: this.logoFile()
    });
  }
}
