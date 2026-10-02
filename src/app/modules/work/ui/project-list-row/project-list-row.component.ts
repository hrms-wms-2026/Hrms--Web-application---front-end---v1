import { Component, computed, input, output } from '@angular/core';
import { EmployeeAvatarComponent } from '../employee-avatar/employee-avatar.component';
import { ProgressBarComponent } from '../../../../shared/ui/progress-bar/progress-bar.component';
import { Project } from '../../models/project.model';

@Component({
  selector: 'app-project-list-row',
  standalone: true,
  imports: [EmployeeAvatarComponent, ProgressBarComponent],
  template: `
    <div
      data-testid="project-list-row"
      class="group flex w-full items-center gap-4 rounded-xl border px-4 py-3.5 text-left transition-all duration-150 cursor-pointer min-h-[4.25rem]"
      [class]="selected()
        ? 'border-[var(--color-accent)] bg-color-mix(in srgb,var(--color-accent-subtle) 40%,var(--color-surface)) shadow-sm'
        : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-accent)]/50 hover:bg-[var(--color-surface-secondary)]/50'"
      (click)="selectedChange.emit()"
    >
      <!-- Logo Box -->
      <div
        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-bold text-base transition-all"
        [class]="selected()
          ? 'bg-[var(--color-accent)] text-white shadow-sm'
          : 'border border-[var(--color-border)] bg-[var(--color-surface-secondary)] text-[var(--color-accent)]'"
        [style.background]="selected() && project().color ? project().color : null"
      >
        {{ projectLogoInitial() }}
      </div>

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
  project = input.required<Project>();
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
