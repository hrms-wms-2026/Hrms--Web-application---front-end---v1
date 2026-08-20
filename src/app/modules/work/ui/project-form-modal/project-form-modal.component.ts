import { Component, OnInit, effect, inject, input, output, signal } from '@angular/core';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ProjectCategoryStore } from '../../state/project-category.store';
import { EmployeeDirectoryStore } from '../../state/employee-directory.store';
import { EmployeePickerComponent } from '../employee-picker/employee-picker.component';
import { validateProjectForm, ProjectFormFields } from '../../utils/project-form.validator';
import { CreateProjectPayload } from '../../models/project.model';

const STEP_LABELS = ['Category', 'Details', 'Members', 'Preview'] as const;

@Component({
  selector: 'app-project-form-modal',
  standalone: true,
  imports: [ModalComponent, InputComponent, ButtonComponent, EmployeePickerComponent],
  template: `
    <app-modal [open]="open()" title="Create project" size="xl" (closed)="closed.emit()">
      <div class="flex flex-col gap-4">
        <ol class="flex gap-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
          @for (label of stepLabels; track label; let i = $index) {
            <li [class.text-[var(--color-accent)]]="step() === i + 1">{{ i + 1 }}. {{ label }}</li>
          }
        </ol>

        @if (step() === 1) {
          <div data-testid="wizard-step-category" class="flex flex-wrap gap-2">
            @for (category of categoryStore.categories(); track category.id) {
              <button
                type="button"
                data-testid="category-pill"
                [attr.data-category-id]="category.id"
                class="rounded-full border px-3 py-1.5 text-sm"
                [class.border-[var(--color-accent)]]="categoryId() === category.id"
                [class.bg-[var(--color-accent)]/10]="categoryId() === category.id"
                [class.border-[var(--color-border)]]="categoryId() !== category.id"
                (click)="categoryId.set(category.id)"
              >{{ category.name }}</button>
            }
          </div>
          @if (errors()['categoryId']) {
            <p class="text-sm text-[var(--color-danger-text)]" role="alert">{{ errors()['categoryId'] }}</p>
          }
        }

        @if (step() === 2) {
          <div data-testid="wizard-step-details" class="flex flex-col gap-4">
            <div class="grid grid-cols-2 gap-4">
              <span data-testid="name-field">
                <app-input label="Name" [value]="name()" [error]="errors()['name'] ?? ''" (valueChange)="name.set($event)" />
              </span>
              <span data-testid="identifier-field">
                <app-input label="Identifier" [value]="identifier()" [error]="errors()['identifier'] ?? ''" (valueChange)="identifier.set($event)" />
              </span>
            </div>
            <span data-testid="description-field">
              <app-input label="Description" [value]="description()" (valueChange)="description.set($event)" />
            </span>
            <div class="grid grid-cols-2 gap-4">
              <span data-testid="start-date-field">
                <app-input label="Start date" type="date" [value]="startDate()" [error]="errors()['startDate'] ?? ''" (valueChange)="startDate.set($event)" />
              </span>
              <span data-testid="target-date-field">
                <app-input label="Target date" type="date" [value]="targetDate()" [error]="errors()['targetDate'] ?? ''" (valueChange)="targetDate.set($event)" />
              </span>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <span data-testid="allocated-hours-field">
                <app-input label="Allocated hours" type="number" [value]="allocatedHoursDisplay()" [error]="errors()['allocatedHours'] ?? ''" (valueChange)="onAllocatedHoursChange($event)" />
              </span>
              <span data-testid="color-field">
                <app-input label="Color" placeholder="#2563EB" [value]="color()" (valueChange)="color.set($event)" />
              </span>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <span data-testid="logo-field" class="flex flex-col gap-1">
                <label class="text-xs font-medium text-[var(--color-text-secondary)]">Logo</label>
                <input type="file" accept="image/png,image/jpeg,image/webp" (change)="onLogoFileSelected($event)" class="text-sm text-[var(--color-text-secondary)]" />
                @if (logoFile(); as file) {
                  <span class="text-xs text-[var(--color-text-secondary)]">{{ file.name }}</span>
                }
              </span>
              <span data-testid="banner-field" class="flex flex-col gap-1">
                <label class="text-xs font-medium text-[var(--color-text-secondary)]">Banner</label>
                <input type="file" accept="image/png,image/jpeg,image/webp" (change)="onBannerFileSelected($event)" class="text-sm text-[var(--color-text-secondary)]" />
                @if (bannerFile(); as file) {
                  <span class="text-xs text-[var(--color-text-secondary)]">{{ file.name }}</span>
                }
              </span>
            </div>
          </div>
        }

        @if (step() === 3) {
          <div data-testid="wizard-step-members" class="flex flex-col gap-2">
            <span data-testid="add-member-button">
              <app-button variant="secondary" size="sm" (pressed)="pickerOpen.set(true)">+ Add member</app-button>
            </span>
            @for (id of memberEmployeeIds(); track id) {
              <div data-testid="staged-member" class="rounded-md border border-[var(--color-border)] px-2.5 py-1.5 text-xs">
                {{ directory.get(id)?.name ?? id }}
              </div>
            }
            @if (memberEmployeeIds().length === 0) {
              <p class="text-xs text-[var(--color-text-secondary)]">Optional — skip if you will add people later.</p>
            }
          </div>
        }

        @if (step() === 4) {
          <dl data-testid="wizard-step-preview" class="grid grid-cols-2 gap-2 text-xs">
            <div><dt class="text-[var(--color-text-secondary)]">Name</dt><dd class="font-medium">{{ name() }}</dd></div>
            <div><dt class="text-[var(--color-text-secondary)]">Identifier</dt><dd class="font-medium">{{ identifier() }}</dd></div>
            <div><dt class="text-[var(--color-text-secondary)]">Category</dt><dd class="font-medium">{{ selectedCategoryName() }}</dd></div>
            <div><dt class="text-[var(--color-text-secondary)]">Start</dt><dd class="font-medium">{{ startDate() }}</dd></div>
            <div><dt class="text-[var(--color-text-secondary)]">Target</dt><dd class="font-medium">{{ targetDate() }}</dd></div>
            <div><dt class="text-[var(--color-text-secondary)]">Members</dt><dd class="font-medium">{{ memberEmployeeIds().length }}</dd></div>
            @if (logoFile(); as file) {
              <div><dt class="text-[var(--color-text-secondary)]">Logo</dt><dd class="font-medium">{{ file.name }}</dd></div>
            }
            @if (bannerFile(); as file) {
              <div><dt class="text-[var(--color-text-secondary)]">Banner</dt><dd class="font-medium">{{ file.name }}</dd></div>
            }
          </dl>
        }

        @if (errorMessage()) {
          <p class="text-sm text-[var(--color-danger-text)]" role="alert">{{ errorMessage() }}</p>
        }

        <div class="mt-1 flex justify-end gap-2">
          <span data-testid="cancel-button">
            <app-button variant="secondary" [disabled]="submitting()" (pressed)="closed.emit()">Cancel</app-button>
          </span>
          @if (step() > 1) {
            <span data-testid="back-button">
              <app-button variant="secondary" [disabled]="submitting()" (pressed)="goBack()">Back</app-button>
            </span>
          }
          @if (step() < 4) {
            <span data-testid="next-button">
              <app-button variant="primary" [disabled]="submitting()" (pressed)="goNext()">Next</app-button>
            </span>
          } @else {
            <span data-testid="submit-button">
              <app-button variant="primary" [loading]="submitting()" (pressed)="submit()">Create</app-button>
            </span>
          }
        </div>
      </div>
    </app-modal>
    <app-employee-picker
      [open]="pickerOpen()"
      (selected)="onMemberPicked($event)"
      (closed)="pickerOpen.set(false)"
    />
  `
})
export class ProjectFormModalComponent implements OnInit {
  protected readonly categoryStore = inject(ProjectCategoryStore);
  protected readonly directory = inject(EmployeeDirectoryStore);

  readonly stepLabels = STEP_LABELS;

  open = input(false);
  submitting = input(false);
  errorMessage = input<string>('');

  createSubmitted = output<CreateProjectPayload>();
  closed = output<void>();

  step = signal(1);
  name = signal('');
  identifier = signal('');
  categoryId = signal('');
  description = signal('');
  startDate = signal('');
  targetDate = signal('');
  allocatedHours = signal(0);
  color = signal('');
  logoFile = signal<File | null>(null);
  bannerFile = signal<File | null>(null);
  memberEmployeeIds = signal<readonly string[]>([]);
  pickerOpen = signal(false);
  errors = signal<Record<string, string>>({});

  constructor() {
    effect(() => {
      if (this.open()) {
        this.step.set(1);
        this.name.set('');
        this.identifier.set('');
        this.categoryId.set('');
        this.description.set('');
        this.startDate.set('');
        this.targetDate.set('');
        this.allocatedHours.set(0);
        this.color.set('');
        this.logoFile.set(null);
        this.bannerFile.set(null);
        this.memberEmployeeIds.set([]);
        this.pickerOpen.set(false);
        this.errors.set({});
      }
    });
  }

  ngOnInit(): void {
    this.categoryStore.loadCategories();
  }

  selectedCategoryName(): string {
    return this.categoryStore.categories().find((c) => c.id === this.categoryId())?.name ?? '';
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

  onBannerFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.bannerFile.set(input.files?.[0] ?? null);
  }

  onMemberPicked(employeeId: string): void {
    this.pickerOpen.set(false);
    if (this.memberEmployeeIds().includes(employeeId)) return;
    this.memberEmployeeIds.update((ids) => [...ids, employeeId]);
    void this.directory.ensureLoaded([employeeId]);
  }

  goBack(): void {
    this.step.update((s) => Math.max(1, s - 1));
  }

  goNext(): void {
    if (this.step() === 1) {
      if (!this.categoryId().trim()) {
        this.errors.set({ categoryId: 'Category is required.' });
        return;
      }
      this.errors.set({});
      this.step.set(2);
      return;
    }
    if (this.step() === 2) {
      const errors = validateProjectForm(this.buildFields(), 'create');
      this.errors.set(errors);
      if (Object.keys(errors).length > 0) return;
      this.step.set(3);
      return;
    }
    this.step.update((s) => Math.min(4, s + 1));
  }

  private buildFields(): ProjectFormFields {
    return {
      name: this.name(), identifier: this.identifier(), categoryId: this.categoryId(),
      startDate: this.startDate(), targetDate: this.targetDate(), releaseDate: '',
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
      releaseDate: null, color: this.color(), actualHours: 0,
      defaultObjectiveAllocatedHours: fields.allocatedHours,
      logoFile: this.logoFile(), bannerFile: this.bannerFile(),
      memberEmployeeIds: this.memberEmployeeIds()
    });
  }
}
