import { Component, OnInit, computed, effect, inject, input, output, signal } from '@angular/core';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';
import { EntityIconComponent } from '../../../../shared/ui/entity-icon/entity-icon.component';
import { IconPickerComponent } from '../../../../shared/ui/icon-picker/icon-picker.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { ProjectApiService } from '../../data-access/project-api.service';
import { EditProjectPayload, ProjectDetail } from '../../models/project.model';
import { ProjectCategoryStore } from '../../state/project-category.store';
import { ProjectFormFields, validateProjectForm } from '../../utils/project-form.validator';
import { WorkDropdownComponent, WorkDropdownOption } from '../../ui/work-dropdown/work-dropdown.component';
import { TEXT_LIMITS } from '../../../../shared/constants/text-limits';

export interface ProjectGeneralSettingsSave {
  fields: EditProjectPayload;
  achievedChanged: boolean;
  achieved: boolean;
  /** A new logo to upload; it replaces the icon. */
  logoFile: File | null;
  /** Delete the current logo. */
  removeLogo: boolean;
}

@Component({
  selector: 'app-project-general-settings',
  standalone: true,
  imports: [ButtonComponent, DatePickerComponent, EntityIconComponent, IconPickerComponent, InputComponent, WorkDropdownComponent],
  template: `
    <section class="project-general-settings" data-testid="project-general-settings">
      <div class="project-general-settings__header">
        <div class="project-general-settings__heading">
          <span class="project-general-settings__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="8" cy="6" r="1.5" /><circle cx="15" cy="12" r="1.5" /><circle cx="10" cy="18" r="1.5" /></svg>
          </span>
          <div>
            <h2 class="project-general-settings__title">Project details</h2>
            <p class="project-general-settings__description">Manage the core information, schedule, effort, and lifecycle of this project.</p>
          </div>
        </div>
      </div>

      @if (!canEdit()) {
        <p class="project-general-settings__notice">Only the project lead can change these details.</p>
      }

      <div class="project-general-settings__form">
        <span data-testid="name-field">
          <app-input label="Name" [value]="name()" [error]="errors()['name']" [disabled]="!canEdit() || submitting()" (valueChange)="name.set($event)" />
        </span>

        <span data-testid="category-field">
          <app-work-dropdown fieldLabel="Category" accessibleLabel="Project category" placeholder="Select a category" [options]="categoryOptions()" [selected]="categoryId()" [error]="errors()['categoryId']" leadingIcon="category" [fullWidth]="true" [disabled]="!canEdit() || submitting()" (selectionChanged)="categoryId.set($event)" />
        </span>

        <span class="project-general-settings__wide" data-testid="description-field">
          <app-input label="Description" [maxlength]="limits.projectDescription" [value]="description()" [disabled]="!canEdit() || submitting()" [multiline]="true" [rows]="3" (valueChange)="description.set($event)" />
        </span>

        <span data-testid="start-date-field">
          <app-date-picker label="Start date" [value]="startDate()" [error]="errors()['startDate']" [disabled]="!canEdit() || submitting()" (valueChange)="startDate.set($event)" />
        </span>

        <span data-testid="target-date-field">
          <app-date-picker label="Target date" [value]="targetDate()" [error]="errors()['targetDate']" [disabled]="!canEdit() || submitting()" (valueChange)="targetDate.set($event)" />
        </span>

        <span data-testid="allocated-hours-field">
          <app-input label="Allocated hours" type="number" [value]="allocatedHoursDisplay()" [error]="errors()['allocatedHours']" [disabled]="!canEdit() || submitting()" (valueChange)="onAllocatedHoursChange($event)" />
        </span>

        <!-- One picture per project: picking an icon or emoji replaces the logo, and uploading a logo replaces the icon. -->
        <div class="project-general-settings__wide project-general-settings__picture" data-testid="icon-field" role="group" aria-label="Project icon">
          <span class="project-general-settings__picture-label">Project icon</span>
          <div class="project-general-settings__picture-row">
            @if (logoPreviewUrl(); as url) {
              <img data-testid="logo-preview" class="project-general-settings__logo" [src]="url" alt="" />
            } @else {
              <app-entity-icon data-testid="icon-preview" class="project-general-settings__entity-icon" [icon]="icon()" [color]="project().color" [name]="name()" />
            }
            @if (canEdit()) {
              <app-icon-picker linkLabel="Icon or emoji" [icon]="icon()" [name]="name()" [showColors]="false" [disabled]="submitting()" (iconChange)="onIconChange($event)" />
              <span data-testid="logo-field" class="project-general-settings__upload">
                <input id="project-settings-logo-input" type="file" accept="image/png,image/jpeg,image/webp" class="project-general-settings__logo-input sr-only" [disabled]="submitting()" (change)="onLogoFileSelected($event)" />
                <label for="project-settings-logo-input" class="project-general-settings__logo-link">Upload logo</label>
              </span>
              @if (icon() || logoPreviewUrl()) {
                <button type="button" data-testid="remove-picture" class="project-general-settings__picture-remove" [disabled]="submitting()" (click)="removePicture()">Remove</button>
              }
            }
          </div>
        </div>

        <label class="project-general-settings__toggle" data-testid="achieved-field">
          <input type="checkbox" [checked]="achieved()" [disabled]="!canEdit() || submitting()" (change)="onAchievedChange($event)" />
          <span>
            <strong>Achieved</strong>
            <small>Mark this project as completed.</small>
          </span>
        </label>
      </div>

      @if (errorMessage()) {
        <p class="project-general-settings__error" role="alert">{{ errorMessage() }}</p>
      }

      @if (canEdit()) {
        <div class="project-general-settings__actions">
          <app-button variant="secondary" [disabled]="submitting()" (pressed)="reset()">Discard changes</app-button>
          <span data-testid="submit-button">
            <app-button variant="primary" [loading]="submitting()" (pressed)="submit()">Save changes</app-button>
          </span>
        </div>
      }
    </section>
  `,
  styles: [`
    .project-general-settings { border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-surface); padding: 22px 24px; box-shadow: 0 1px 3px color-mix(in srgb, var(--color-text-primary) 7%, transparent); }
    .project-general-settings__header { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    .project-general-settings__heading { display: flex; min-width: 0; align-items: center; gap: 14px; }
    .project-general-settings__icon { display: inline-flex; width: 42px; height: 42px; flex: 0 0 auto; align-items: center; justify-content: center; border-radius: 11px; background: color-mix(in srgb, var(--color-accent) 10%, var(--color-surface)); color: var(--color-accent); }
    .project-general-settings__icon svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .project-general-settings__title { margin: 0; color: var(--color-text-primary); font-size: 15px; font-weight: 600; }
    .project-general-settings__description { margin: 3px 0 0; color: var(--color-text-secondary); font-size: 12.5px; }
    .project-general-settings__notice { margin: 18px 0 0; padding: 10px 12px; border-radius: 8px; background: var(--color-surface-secondary); color: var(--color-text-secondary); font-size: 12px; }
    .project-general-settings__form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--color-border); }
    .project-general-settings__wide { grid-column: 1 / -1; }
    .project-general-settings__picture { display: flex; flex-direction: column; gap: 6px; }
    .project-general-settings__picture-label { color: var(--color-text-secondary); font-size: 12px; font-weight: 600; }
    .project-general-settings__picture-row { display: flex; min-height: 36px; align-items: center; gap: 8px; }
    .project-general-settings__logo { width: 36px; height: 36px; flex: 0 0 auto; border: 1px solid var(--color-border); border-radius: 12px; object-fit: cover; }
    .project-general-settings__entity-icon { flex: 0 0 auto; --entity-icon-size: 2.25rem; }
    .project-general-settings__upload { display: inline-flex; }
    .project-general-settings__logo-link, .project-general-settings__picture-remove { padding: 2px 4px; border: 0; border-radius: 6px; background: none; font-size: 13px; font-weight: 500; white-space: nowrap; cursor: pointer; }
    .project-general-settings__logo-link { color: var(--color-accent); }
    .project-general-settings__logo-link:hover { text-decoration: underline; }
    .project-general-settings__logo-input:focus-visible + .project-general-settings__logo-link { outline: 2px solid var(--color-accent); outline-offset: 2px; }
    .project-general-settings__picture-remove { color: var(--color-text-secondary); }
    .project-general-settings__picture-remove:hover { color: var(--color-danger-text); }
    .project-general-settings__toggle { grid-column: 1 / -1; display: flex; align-items: flex-start; gap: 10px; width: fit-content; color: var(--color-text-primary); cursor: pointer; }
    .project-general-settings__toggle input { width: 16px; height: 16px; margin-top: 2px; accent-color: var(--color-accent); }
    .project-general-settings__toggle span { display: flex; flex-direction: column; gap: 2px; }
    .project-general-settings__toggle strong { font-size: 13px; font-weight: 600; }
    .project-general-settings__toggle small { color: var(--color-text-secondary); font-size: 12px; }
    .project-general-settings__error { margin: 14px 0 0; color: var(--color-danger-text); font-size: 13px; }
    .project-general-settings__actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--color-border); }
    @media (max-width: 640px) { .project-general-settings { padding: 16px; } .project-general-settings__form { grid-template-columns: 1fr; } .project-general-settings__wide, .project-general-settings__toggle { grid-column: auto; } }
  `]
})
export class ProjectGeneralSettingsComponent implements OnInit {
  readonly limits = TEXT_LIMITS;
  private readonly categoryStore = inject(ProjectCategoryStore);
  private readonly projectApi = inject(ProjectApiService);

  project = input.required<ProjectDetail>();
  submitting = input(false);
  errorMessage = input('');

  saved = output<ProjectGeneralSettingsSave>();

  protected readonly name = signal('');
  protected readonly categoryId = signal('');
  protected readonly description = signal('');
  protected readonly startDate = signal('');
  protected readonly targetDate = signal('');
  protected readonly allocatedHours = signal(0);
  protected readonly icon = signal<string | null>(null);
  protected readonly logoFile = signal<File | null>(null);
  /** The saved logo is gone from the form: Remove deletes it on save, and a newly picked icon makes the server drop it. */
  protected readonly logoCleared = signal(false);
  private readonly newLogoUrl = signal<string | null>(null);
  protected readonly logoPreviewUrl = computed(() => {
    const { id, logoFileId } = this.project();
    return this.newLogoUrl() ?? (logoFileId && !this.logoCleared() ? this.projectApi.getLogoUrl(id, logoFileId) : null);
  });
  protected readonly achieved = signal(false);
  protected readonly errors = signal<Record<string, string>>({});

  constructor() {
    effect(() => this.patchForm(this.project()));

    effect((onCleanup) => {
      const file = this.logoFile();
      if (!file) {
        this.newLogoUrl.set(null);
        return;
      }
      const url = URL.createObjectURL(file);
      this.newLogoUrl.set(url);
      onCleanup(() => URL.revokeObjectURL(url));
    });
  }

  ngOnInit(): void {
    void this.categoryStore.loadCategories();
  }

  protected canEdit(): boolean {
    return this.project().isLead;
  }

  protected categoryOptions(): WorkDropdownOption[] {
    return this.categoryStore.categories().map((category) => ({ value: category.id, label: category.name }));
  }

  protected allocatedHoursDisplay(): string {
    return String(this.allocatedHours());
  }

  protected onAllocatedHoursChange(value: string): void {
    this.allocatedHours.set(value === '' ? 0 : Number(value));
  }

  protected onAchievedChange(event: Event): void {
    this.achieved.set((event.target as HTMLInputElement).checked);
  }

  protected onLogoFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // so choosing the same file again after Remove still fires change
    if (!file) return;
    this.logoFile.set(file);
    this.icon.set(null);
  }

  protected onIconChange(icon: string | null): void {
    this.icon.set(icon);
    if (!icon) return;
    this.logoFile.set(null);
    this.logoCleared.set(true);
  }

  protected removePicture(): void {
    this.icon.set(null);
    this.logoFile.set(null);
    this.logoCleared.set(true);
  }

  protected reset(): void {
    this.patchForm(this.project());
  }

  protected submit(): void {
    if (!this.canEdit()) return;

    const fields: ProjectFormFields = {
      name: this.name(),
      identifier: '',
      categoryId: this.categoryId(),
      startDate: this.startDate(),
      targetDate: this.targetDate(),
      releaseDate: '',
      allocatedHours: this.allocatedHours()
    };
    const errors = validateProjectForm(fields, 'edit');
    this.errors.set(errors);
    if (Object.keys(errors).length > 0) return;

    const project = this.project();
    this.saved.emit({
      fields: {
        name: fields.name,
        description: this.description(),
        categoryId: fields.categoryId,
        startDate: fields.startDate,
        targetDate: fields.targetDate,
        color: project.color ?? '',
        actualHours: 0,
        allocatedHours: this.allocatedHours(),
        icon: this.icon() ?? ''
      },
      achievedChanged: this.achieved() !== project.isAchieved,
      achieved: this.achieved(),
      logoFile: this.logoFile(),
      removeLogo: this.logoCleared() && !this.logoFile() && !this.icon() && !!project.logoFileId
    });
  }

  private patchForm(project: ProjectDetail): void {
    this.name.set(project.name);
    this.categoryId.set(project.categoryId);
    this.description.set(project.description ?? '');
    this.startDate.set(project.startDate);
    this.targetDate.set(project.targetDate);
    this.allocatedHours.set(project.allocatedHours);
    // Older projects can have both; the logo is what they show, so it is the one the form keeps.
    this.icon.set(project.logoFileId ? null : project.icon ?? null);
    this.logoFile.set(null);
    this.logoCleared.set(false);
    this.achieved.set(project.isAchieved);
    this.errors.set({});
  }
}
