import { Component, computed, input, output } from '@angular/core';
import { EmployeeAvatarComponent } from '../employee-avatar/employee-avatar.component';
import { ProgressBarComponent } from '../../../../shared/ui/progress-bar/progress-bar.component';
import { Project } from '../../models/project.model';

@Component({
  selector: 'app-project-list-row',
  standalone: true,
  imports: [EmployeeAvatarComponent, ProgressBarComponent],
  template: `
    <button
      type="button"
      data-testid="project-list-row"
      class="flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-all duration-150"
      [class]="selected()
        ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white shadow-sm'
        : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] hover:border-[var(--color-accent)]/50 hover:bg-[var(--color-surface-secondary)]'"
      (click)="selectedChange.emit()"
    >
      <span
        data-testid="project-row-name"
        class="min-w-0 flex-1 truncate text-sm font-bold"
        [class]="selected() ? 'text-white' : 'text-[var(--color-text-primary)]'"
      >
        {{ project().name }}
      </span>
      <span data-testid="project-row-owner" class="shrink-0 max-w-[140px]">
        <app-employee-avatar [employeeId]="project().leadId" [showName]="true" [invertText]="selected()" />
      </span>
      <span class="w-24 shrink-0">
        <app-progress-bar [progress]="hoursProgress()" />
      </span>
    </button>
  `
})
export class ProjectListRowComponent {
  project = input.required<Project>();
  selected = input(false);
  selectedChange = output<void>();

  readonly hoursProgress = computed(() => {
    const allocated = this.project().allocatedHours;
    if (allocated <= 0) return 0;
    return Math.round((this.project().completedHours / allocated) * 100);
  });
}
