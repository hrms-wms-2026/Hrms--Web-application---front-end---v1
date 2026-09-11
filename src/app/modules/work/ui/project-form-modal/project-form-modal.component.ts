import { Component, OnInit, effect, inject, input, output, signal } from '@angular/core';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ProjectCategoryStore } from '../../state/project-category.store';
import { EmployeeDirectoryStore } from '../../state/employee-directory.store';
import { EmployeePickerComponent } from '../employee-picker/employee-picker.component';
import { validateProjectForm, ProjectFormFields } from '../../utils/project-form.validator';
import { CreateProjectPayload } from '../../models/project.model';

const STEP_ITEMS = [
  { id: 1, label: 'Category', desc: 'Select category' },
  { id: 2, label: 'Details', desc: 'Basic info & dates' },
  { id: 3, label: 'Members', desc: 'Assign team' },
  { id: 4, label: 'Preview', desc: 'Review & create' }
] as const;

@Component({
  selector: 'app-project-form-modal',
  standalone: true,
  imports: [ModalComponent, InputComponent, ButtonComponent, EmployeePickerComponent],
  template: `
    <app-modal [open]="open()" title="Create New Project" size="2xl" (closed)="closed.emit()">
      <div class="flex flex-col gap-6 py-1">
        <!-- Modern Stepper Header -->
        <div class="relative flex items-center justify-between border-b border-[var(--color-border)] pb-5 px-1">
          @for (item of steps; track item.id; let i = $index) {
            <div
              class="flex items-center gap-2.5 z-10 cursor-pointer group"
              (click)="navigateToStep(item.id)"
            >
              <!-- Step Number Badge -->
              <div
                class="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-all shadow-xs"
                [class]="step() === item.id
                  ? 'bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-900/30'
                  : step() > item.id
                    ? 'bg-emerald-500 text-white'
                    : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] border border-[var(--color-border)]'"
              >
                @if (step() > item.id) {
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                } @else {
                  {{ item.id }}
                }
              </div>

              <!-- Step Label -->
              <div class="hidden sm:flex flex-col">
                <span
                  class="text-xs font-bold transition-colors"
                  [class]="step() === item.id ? 'text-blue-600' : 'text-[var(--color-text-primary)]'"
                >
                  {{ item.label }}
                </span>
                <span class="text-[10px] text-[var(--color-text-secondary)] font-normal">
                  {{ item.desc }}
                </span>
              </div>
            </div>

            <!-- Step Connector Line -->
            @if (i < steps.length - 1) {
              <div class="flex-1 h-0.5 mx-2 bg-[var(--color-border)] relative">
                <div
                  class="h-full bg-blue-600 transition-all duration-300"
                  [style.width]="step() > item.id ? '100%' : '0%'"
                ></div>
              </div>
            }
          }
        </div>

        <!-- Wizard Step Body Container (Fixed Static Height) -->
        <div class="h-[425px] overflow-y-auto pr-1">
          <!-- STEP 1: Category Selection -->
          @if (step() === 1) {
            <div data-testid="wizard-step-category" class="flex flex-col gap-4">
              <div>
                <h3 class="text-sm font-bold text-[var(--color-text-primary)]">Choose Project Category</h3>
                <p class="text-xs text-[var(--color-text-secondary)] mt-0.5">Select a category to organize and classify your new project.</p>
              </div>

              <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                @for (category of categoryStore.categories(); track category.id) {
                  <button
                    type="button"
                    data-testid="category-pill"
                    [attr.data-category-id]="category.id"
                    class="flex items-center justify-between rounded-xl border p-3.5 text-left text-sm font-semibold transition-all hover:border-blue-500 hover:shadow-xs"
                    [class]="categoryId() === category.id
                      ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 text-blue-700 ring-2 ring-blue-500/20'
                      : 'border-[var(--color-border)] bg-white text-[var(--color-text-primary)] hover:bg-[var(--color-surface-secondary)]'"
                    (click)="categoryId.set(category.id)"
                  >
                    <span>{{ category.name }}</span>
                    @if (categoryId() === category.id) {
                      <svg class="h-4 w-4 text-blue-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                      </svg>
                    }
                  </button>
                }
              </div>

              @if (errors()['categoryId']) {
                <p class="text-xs font-medium text-[var(--color-danger-text)] mt-1 flex items-center gap-1" role="alert">
                  <svg class="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  <span>{{ errors()['categoryId'] }}</span>
                </p>
              }
            </div>
          }

          <!-- STEP 2: Project Details -->
          @if (step() === 2) {
            <div data-testid="wizard-step-details" class="flex flex-col gap-4">
              <div>
                <h3 class="text-sm font-bold text-[var(--color-text-primary)]">Project Information & Dates</h3>
                <p class="text-xs text-[var(--color-text-secondary)] mt-0.5">Enter key details, timeline, allocated budget hours, and branding.</p>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <span data-testid="name-field">
                  <app-input label="Project Name *" [value]="name()" [error]="errors()['name']" (valueChange)="name.set($event)" />
                </span>
                <span data-testid="identifier-field">
                  <app-input label="Key / Identifier *" [value]="identifier()" [error]="errors()['identifier']" (valueChange)="identifier.set($event)" />
                </span>
              </div>

              <span data-testid="description-field">
                <app-input label="Description" [value]="description()" (valueChange)="description.set($event)" />
              </span>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <span data-testid="start-date-field">
                  <app-input label="Start Date *" type="date" [value]="startDate()" [error]="errors()['startDate']" (valueChange)="startDate.set($event)" />
                </span>
                <span data-testid="target-date-field">
                  <app-input label="Target Date *" type="date" [value]="targetDate()" [error]="errors()['targetDate']" (valueChange)="targetDate.set($event)" />
                </span>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <span data-testid="allocated-hours-field">
                  <app-input label="Allocated Hours" type="number" [value]="allocatedHoursDisplay()" [error]="errors()['allocatedHours']" (valueChange)="onAllocatedHoursChange($event)" />
                </span>
                <span data-testid="color-field">
                  <app-input label="Color Hex Code" placeholder="#2563EB" [value]="color()" (valueChange)="color.set($event)" />
                </span>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <span data-testid="logo-field" class="flex flex-col gap-1.5">
                  <label class="text-xs font-semibold text-[var(--color-text-secondary)]">Project Logo</label>
                  <div class="relative flex items-center justify-between rounded-xl border border-dashed border-[var(--color-border)] p-3 hover:border-blue-500 bg-[var(--color-surface-secondary)]/30 transition-colors">
                    <input type="file" accept="image/png,image/jpeg,image/webp" (change)="onLogoFileSelected($event)" class="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                    <div class="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] min-w-0">
                      <svg class="h-4 w-4 text-blue-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                      <span class="truncate font-medium">{{ logoFile() ? logoFile()!.name : 'Choose Logo image' }}</span>
                    </div>
                    <span class="text-[10px] font-bold text-blue-600 uppercase shrink-0 ml-1">Browse</span>
                  </div>
                </span>

                <span data-testid="banner-field" class="flex flex-col gap-1.5">
                  <label class="text-xs font-semibold text-[var(--color-text-secondary)]">Project Banner</label>
                  <div class="relative flex items-center justify-between rounded-xl border border-dashed border-[var(--color-border)] p-3 hover:border-blue-500 bg-[var(--color-surface-secondary)]/30 transition-colors">
                    <input type="file" accept="image/png,image/jpeg,image/webp" (change)="onBannerFileSelected($event)" class="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                    <div class="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] min-w-0">
                      <svg class="h-4 w-4 text-blue-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                      <span class="truncate font-medium">{{ bannerFile() ? bannerFile()!.name : 'Choose Banner image' }}</span>
                    </div>
                    <span class="text-[10px] font-bold text-blue-600 uppercase shrink-0 ml-1">Browse</span>
                  </div>
                </span>
              </div>
            </div>
          }

          <!-- STEP 3: Assign Members -->
          @if (step() === 3) {
            <div data-testid="wizard-step-members" class="flex flex-col gap-4">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="text-sm font-bold text-[var(--color-text-primary)]">Assign Team Members</h3>
                  <p class="text-xs text-[var(--color-text-secondary)] mt-0.5">Add people who will participate and contribute to this project.</p>
                </div>
                <span data-testid="add-member-button">
                  <app-button variant="secondary" size="sm" (pressed)="pickerOpen.set(true)">
                    + Add member
                  </app-button>
                </span>
              </div>

              <div class="flex flex-col gap-2">
                @for (id of memberEmployeeIds(); track id) {
                  <div data-testid="staged-member" class="flex items-center justify-between rounded-xl border border-[var(--color-border)] p-3 text-xs bg-white">
                    <div class="flex items-center gap-2.5">
                      <div class="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-[11px]">
                        {{ (directory.get(id)?.name || id).substring(0, 2).toUpperCase() }}
                      </div>
                      <span class="font-semibold text-[var(--color-text-primary)]">{{ directory.get(id)?.name ?? id }}</span>
                    </div>
                    <button
                      type="button"
                      class="text-xs text-[var(--color-danger-text)] hover:underline font-medium"
                      (click)="removeMember(id)"
                    >
                      Remove
                    </button>
                  </div>
                }

                @if (memberEmployeeIds().length === 0) {
                  <div class="rounded-xl border border-dashed border-[var(--color-border)] p-8 text-center bg-[var(--color-surface-secondary)]/30">
                    <svg class="mx-auto h-8 w-8 text-[var(--color-text-secondary)] opacity-50 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                    <p class="text-xs text-[var(--color-text-secondary)] font-medium">No team members added yet.</p>
                    <p class="text-[11px] text-[var(--color-text-secondary)] opacity-75 mt-0.5">Optional — skip if you will add people later.</p>
                  </div>
                }
              </div>
            </div>
          }

          <!-- STEP 4: Review & Preview -->
          @if (step() === 4) {
            <div data-testid="wizard-step-preview" class="flex flex-col gap-4">
              <div>
                <h3 class="text-sm font-bold text-[var(--color-text-primary)]">Review & Confirm</h3>
                <p class="text-xs text-[var(--color-text-secondary)] mt-0.5">Please review your project details before creating.</p>
              </div>

              <div class="rounded-xl border border-[var(--color-border)] p-4 bg-white flex flex-col gap-3">
                <div class="flex items-center gap-3 border-b border-[var(--color-border)] pb-3">
                  <div
                    class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg font-bold text-white text-base shadow-xs"
                    [style.background]="color() || 'linear-gradient(135deg, #2563eb, #4f46e5)'"
                  >
                    {{ name().substring(0, 1).toUpperCase() || 'P' }}
                  </div>
                  <div>
                    <div class="text-sm font-bold text-[var(--color-text-primary)]">{{ name() }}</div>
                    <div class="text-xs font-medium text-[var(--color-text-secondary)]">{{ identifier() }} &bull; {{ selectedCategoryName() }}</div>
                  </div>
                </div>

                <dl class="grid grid-cols-2 gap-3 text-xs">
                  <div><dt class="text-[var(--color-text-secondary)] font-medium">Start Date</dt><dd class="font-bold text-[var(--color-text-primary)] mt-0.5">{{ startDate() }}</dd></div>
                  <div><dt class="text-[var(--color-text-secondary)] font-medium">Target Date</dt><dd class="font-bold text-[var(--color-text-primary)] mt-0.5">{{ targetDate() }}</dd></div>
                  <div><dt class="text-[var(--color-text-secondary)] font-medium">Allocated Hours</dt><dd class="font-bold text-[var(--color-text-primary)] mt-0.5">{{ allocatedHours() }}h</dd></div>
                  <div><dt class="text-[var(--color-text-secondary)] font-medium">Team Members</dt><dd class="font-bold text-[var(--color-text-primary)] mt-0.5">{{ memberEmployeeIds().length }} member(s)</dd></div>
                  @if (logoFile(); as file) {
                    <div><dt class="text-[var(--color-text-secondary)] font-medium">Logo</dt><dd class="font-semibold text-blue-600 mt-0.5">{{ file.name }}</dd></div>
                  }
                  @if (bannerFile(); as file) {
                    <div><dt class="text-[var(--color-text-secondary)] font-medium">Banner</dt><dd class="font-semibold text-blue-600 mt-0.5">{{ file.name }}</dd></div>
                  }
                </dl>
              </div>
            </div>
          }
        </div>

        @if (errorMessage()) {
          <p class="text-xs font-medium text-[var(--color-danger-text)] bg-red-50 p-2.5 rounded-lg border border-red-200" role="alert">
            {{ errorMessage() }}
          </p>
        }

        <!-- Wizard Footer Navigation -->
        <div class="mt-2 flex items-center justify-between border-t border-[var(--color-border)] pt-4">
          <span data-testid="cancel-button">
            <app-button variant="secondary" [disabled]="submitting()" (pressed)="closed.emit()">Cancel</app-button>
          </span>

          <div class="flex items-center gap-2">
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

  readonly steps = STEP_ITEMS;

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

  navigateToStep(targetStep: number): void {
    if (targetStep < this.step()) {
      this.step.set(targetStep);
    }
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

  removeMember(employeeId: string): void {
    this.memberEmployeeIds.update((ids) => ids.filter((id) => id !== employeeId));
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

