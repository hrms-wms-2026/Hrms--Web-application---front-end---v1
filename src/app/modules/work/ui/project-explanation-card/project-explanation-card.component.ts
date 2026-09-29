import { Component, computed, inject, input, output } from '@angular/core';
import { Project } from '../../models/project.model';
import { ProjectCategoryStore } from '../../state/project-category.store';
import { getDeadlineStatus } from '../../utils/deadline.util';
import { EmployeeAvatarComponent } from '../employee-avatar/employee-avatar.component';
import { MemberButtonComponent } from '../member-button/member-button.component';

@Component({
  selector: 'app-project-explanation-card',
  standalone: true,
  host: { class: 'block self-start h-auto' },
  imports: [EmployeeAvatarComponent, MemberButtonComponent],
  template: `
    <section data-testid="project-explanation-card" class="flex flex-col gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 shadow-sm self-start h-auto">
      <!-- Card Header Subtitle -->
      <div class="flex items-center justify-between border-b border-[var(--color-border)] pb-2">
        <div class="flex items-center gap-2">
          <span class="h-2 w-2 shrink-0 rounded-full bg-[var(--color-accent)]" aria-hidden="true"></span>
          <span class="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
            Project Details
          </span>
        </div>
        @if (project().isLead) {
          <app-member-button [memberCount]="project().memberCount" (pressed)="membersRequested.emit()" />
        }
      </div>

      <!-- Project Logo & Title -->
      <div class="flex items-center gap-2.5 border-b border-[var(--color-border)] pb-2">
        <div
          class="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-lg font-bold text-white text-xs shadow-sm"
          [style.background]="project().color || 'linear-gradient(135deg, #2563eb, #4f46e5)'"
        >
          {{ projectLogoInitial() }}
        </div>
        <div class="min-w-0 flex-1">
          <h2 class="text-sm font-bold text-[var(--color-text-primary)] leading-tight truncate">
            {{ project().name }}
          </h2>
          <p class="text-[11px] font-semibold text-[var(--color-text-secondary)] mt-0.5">
            {{ project().identifier }}
          </p>
        </div>
      </div>

      <!-- Description -->
      @if (project().description; as description) {
        <p data-testid="explanation-description" class="text-xs leading-snug text-[var(--color-text-secondary)] line-clamp-2 border-b border-[var(--color-border)] pb-2">
          {{ description }}
        </p>
      }

      <!-- Details Key-Value List -->
      <div class="flex flex-col rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)]/30 px-3 py-0.5 text-xs">
        <div class="flex items-center justify-between py-1 border-b border-[var(--color-border)]/50 last:border-0">
          <span class="text-[var(--color-text-secondary)] font-medium">Owner</span>
          <app-employee-avatar [employeeId]="project().leadId" [showName]="true" />
        </div>
        <div class="flex items-center justify-between py-1 border-b border-[var(--color-border)]/50 last:border-0">
          <span class="text-[var(--color-text-secondary)] font-medium">Key</span>
          <span class="font-semibold text-[var(--color-text-primary)]">{{ project().identifier }}</span>
        </div>
        <div class="flex items-center justify-between py-1 border-b border-[var(--color-border)]/50 last:border-0">
          <span class="text-[var(--color-text-secondary)] font-medium">Category</span>
          <span class="font-semibold text-[var(--color-text-primary)]">{{ categoryName() }}</span>
        </div>
        <div class="flex items-center justify-between py-1 border-b border-[var(--color-border)]/50 last:border-0">
          <span class="text-[var(--color-text-secondary)] font-medium">Start Date</span>
          <span class="font-semibold text-[var(--color-text-primary)]">{{ project().startDate }}</span>
        </div>
        <div class="flex items-center justify-between py-1 border-b border-[var(--color-border)]/50 last:border-0">
          <span class="text-[var(--color-text-secondary)] font-medium">Target Date</span>
          <div class="text-right">
            <span class="font-semibold text-[var(--color-text-primary)] block">{{ project().targetDate }}</span>
            @if (deadlineStatus(); as status) {
              <span class="text-[10px] text-[var(--color-text-secondary)] block">{{ status.label }}</span>
            }
          </div>
        </div>
      </div>

      <!-- 3 KPI Metric Boxes -->
      <div class="grid grid-cols-3 gap-2">
        <div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5 text-center shadow-sm">
          <div class="text-sm font-bold text-[var(--color-text-primary)]">{{ project().allocatedHours }}h</div>
          <div class="text-[10px] font-medium text-[var(--color-text-secondary)] mt-0.5">Allocated</div>
        </div>
        <div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5 text-center shadow-sm">
          <div class="text-sm font-bold text-[var(--color-text-primary)]">{{ project().completedHours }}h</div>
          <div class="text-[10px] font-medium text-[var(--color-text-secondary)] mt-0.5">Completed</div>
        </div>
        <div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5 text-center shadow-sm">
          <div class="text-sm font-bold text-[var(--color-text-primary)]">{{ hoursProgress() }}%</div>
          <div class="text-[10px] font-medium text-[var(--color-text-secondary)] mt-0.5">Progress</div>
        </div>
      </div>

      <!-- Project actions -->
      <div class="border-t border-[var(--color-border)] pt-2">
        <div class="mb-1 text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Quick actions</div>
        <div class="flex flex-col gap-1.5">
          <span data-testid="view-button" class="w-full">
            <button
              type="button"
              class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-center text-xs font-semibold text-white shadow-sm transition-[filter,transform] hover:brightness-95 active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
              (click)="viewed.emit()"
            >
              <svg class="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v14H4z" /><path d="m8 9 3 3-3 3M13 15h3" /></svg>
              <span>Open project structure</span>
            </button>
          </span>

          @if (project().isLead) {
            <div class="flex gap-1.5">
              <span data-testid="settings-button" class="flex-1">
                <button
                  type="button"
                  class="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-center text-xs font-semibold text-[var(--color-text-secondary)] shadow-sm transition-colors hover:bg-[var(--color-surface-secondary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
                  (click)="settingsRequested.emit()"
                >
                  <svg class="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="8" cy="6" r="1.5" /><circle cx="15" cy="12" r="1.5" /><circle cx="10" cy="18" r="1.5" /></svg>
                  <span>Settings</span>
                </button>
              </span>

              @if (!project().isAchieved) {
                <span data-testid="achieve-button" class="flex-1">
                  <button
                    type="button"
                    class="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-3 py-1.5 text-center text-xs font-semibold text-[var(--color-accent)] shadow-sm transition-colors hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
                    (click)="achieveRequested.emit()"
                  >
                    <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 01-2-2V4a2 2 0 012-2h14a2 2 0 012 2v2a2 2 0 01-2 2M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                    </svg>
                    <span>Archive</span>
                  </button>
                </span>
              }
            </div>
          }
        </div>
      </div>
    </section>
  `
})
export class ProjectExplanationCardComponent {
  private readonly categoryStore = inject(ProjectCategoryStore);

  project = input.required<Project>();
  viewed = output<void>();
  achieveRequested = output<void>();
  settingsRequested = output<void>();
  membersRequested = output<void>();

  readonly projectLogoInitial = computed(() => {
    const name = this.project().name?.trim();
    return name ? name.charAt(0).toUpperCase() : 'P';
  });

  readonly categoryName = computed(() => {
    const categories = this.categoryStore.categories();
    const found = categories.find((c) => c.id === this.project().categoryId);
    return found ? found.name : 'General';
  });

  readonly hoursProgress = computed(() => {
    const allocated = this.project().allocatedHours;
    if (allocated <= 0) return 0;
    return Math.round((this.project().completedHours / allocated) * 100);
  });

  readonly deadlineStatus = computed(() => {
    return getDeadlineStatus(this.project().targetDate);
  });
}
