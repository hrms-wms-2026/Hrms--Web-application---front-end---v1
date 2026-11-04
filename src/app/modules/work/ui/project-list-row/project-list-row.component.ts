import { Component, computed, inject, input, output, signal } from '@angular/core';
import { EmployeeAvatarComponent } from '../employee-avatar/employee-avatar.component';
import { ProgressBarComponent } from '../../../../shared/ui/progress-bar/progress-bar.component';
import { ProjectApiService } from '../../data-access/project-api.service';
import { Project } from '../../models/project.model';
import { KeyboardClickDirective } from '../../../../shared/directives/keyboard-click.directive';
import { EntityIconComponent } from '../../../../shared/ui/entity-icon/entity-icon.component';

@Component({
  selector: 'app-project-list-row',
  standalone: true,
  imports: [KeyboardClickDirective, EmployeeAvatarComponent, ProgressBarComponent, EntityIconComponent],
  template: `
    <div role="button" tabindex="0" appKeyboardClick
      data-testid="project-list-row"
      class="group flex w-full items-center gap-4 rounded-xl border bg-[var(--color-card-bg)] [box-shadow:var(--shadow-card)] px-4 py-3.5 text-left transition-all duration-150 cursor-pointer min-h-[4.25rem]"
      [class]="selected()
        ? 'border-[var(--color-selected-outline)]'
        : 'border-[var(--color-border)] hover:border-[var(--color-accent)]/50 hover:bg-[var(--color-surface-secondary)]/50'"
      (click)="selectedChange.emit()"
    >
      <!-- Logo Box -->
      @if (logoUrl(); as url) {
        <img
          data-testid="project-row-logo"
          class="h-11 w-11 shrink-0 rounded-xl object-cover border border-[var(--color-border)]"
          [class.ring-2]="selected()"
          [class.ring-[var(--color-accent)]]="selected()"
          [src]="url"
          alt=""
          (error)="logoBroken.set(true)"
        />
      } @else if (project().icon; as projectIcon) {
        <app-entity-icon data-testid="project-row-icon" class="[--entity-icon-size:2.75rem]" [icon]="projectIcon" [color]="project().color" [name]="project().name" />
      } @else {
        <div
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-bold text-base transition-all"
          [class]="selected()
            ? 'bg-[var(--color-accent)] text-white shadow-sm'
            : 'border border-[var(--color-border)] bg-[var(--color-surface-secondary)] text-[var(--color-accent)]'"
          [style.background]="selected() && project().color ? project().color : null"
        >
          {{ projectLogoInitial() }}
        </div>
      }

      <!-- Title & Key -->
      <div class="min-w-0 flex-1">
        <h3
          data-testid="project-row-name"
          class="truncate text-base font-bold text-[var(--color-text-primary)] leading-snug"
        >
          {{ project().name }}
        </h3>
        <p class="text-xs font-semibold text-[var(--color-text-secondary)] tracking-wide uppercase mt-0.5">
          {{ project().identifier }}
        </p>
      </div>

      <!-- Owner Avatar -->
      <div data-testid="project-row-owner" class="shrink-0">
        <app-employee-avatar [employeeId]="project().leadId" [showName]="true" />
      </div>

      <!-- Progress Bar + Percentage -->
      <div class="flex items-center gap-3 shrink-0 w-36 justify-end">
        <div class="flex-1">
          <app-progress-bar [progress]="hoursProgress()" />
        </div>
        <span class="text-xs font-bold text-[var(--color-text-secondary)] w-8 text-right">
          {{ hoursProgress() }}%
        </span>
      </div>
    </div>
  `
})
export class ProjectListRowComponent {
  private readonly projectApi = inject(ProjectApiService);

  project = input.required<Project>();
  /** Set when the image fails to load (no access, file gone): the initial shows instead. */
  readonly logoBroken = signal(false);

  /** Same URL as the project grid card, so a logo loaded there comes from the browser cache. */
  readonly logoUrl = computed(() => {
    const { id, logoFileId } = this.project();
    return logoFileId && !this.logoBroken() ? this.projectApi.getLogoUrl(id, logoFileId) : null;
  });
  selected = input(false);
  selectedChange = output<void>();

  readonly projectLogoInitial = computed(() => {
    const name = this.project().name?.trim();
    return name ? name.charAt(0).toUpperCase() : 'P';
  });

  readonly hoursProgress = computed(() => {
    const allocated = this.project().allocatedHours;
    if (allocated <= 0) return 0;
    return Math.round((this.project().completedHours / allocated) * 100);
  });
}
