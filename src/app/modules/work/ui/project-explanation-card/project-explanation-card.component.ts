import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { ProjectApiService } from '../../data-access/project-api.service';
import { Project } from '../../models/project.model';
import { ProjectCategoryStore } from '../../state/project-category.store';
import { getDeadlineStatus } from '../../utils/deadline.util';
import { PROJECT_STATUS_LABELS, projectHoursProgress, projectStatus } from '../../utils/project-status.util';
import { EmployeeAvatarComponent } from '../employee-avatar/employee-avatar.component';
import { MemberButtonComponent } from '../member-button/member-button.component';

/**
 * The selected project beside the Projects list (2026-11-27 design): header with status, Open project structure,
 * progress, project information and the lead's quick actions.
 */
@Component({
  selector: 'app-project-explanation-card',
  standalone: true,
  host: { class: 'block lg:h-full lg:min-h-0' },
  imports: [EmployeeAvatarComponent, MemberButtonComponent],
  template: `
    <section data-testid="project-explanation-card" class="flex flex-col gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-xs lg:min-h-full lg:gap-4">
      <!-- Logo, name, key and category, and where the project stands -->
      <div class="flex items-start gap-3.5">
        @if (logoUrl(); as url) {
          <img
            data-testid="project-details-logo"
            class="h-12 w-12 shrink-0 rounded-xl object-cover shadow-sm border border-[var(--color-border)]"
            [src]="url"
            alt=""
            (error)="logoBroken.set(true)"
          />
        } @else {
          <div
            class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-[var(--color-text-on-solid)] shadow-sm"
            [style.background]="project().color || 'var(--color-accent-solid)'"
          >
            {{ projectLogoInitial() }}
          </div>
        }
        <div class="min-w-0 flex-1">
          <h2 class="truncate text-base font-bold leading-tight text-[var(--color-text-primary)]">{{ project().name }}</h2>
          <p class="mt-0.5 flex min-w-0 items-center gap-2 text-[13px] text-[var(--color-text-secondary)]">
            <span class="truncate font-medium uppercase tracking-wide">{{ project().identifier }}</span>
            <span class="h-1 w-1 shrink-0 rounded-full bg-[var(--color-text-secondary)]" aria-hidden="true"></span>
            <span class="truncate">{{ categoryName() }}</span>
          </p>
        </div>
        <span data-testid="project-details-status" [class]="statusClass()">{{ statusLabel() }}</span>
      </div>

      @if (project().description; as description) {
        <p data-testid="explanation-description" class="-mt-1 text-[13px] leading-snug text-[var(--color-text-secondary)] line-clamp-2">
          {{ description }}
        </p>
      }

      <!-- Open project structure, with the members button beside it for the lead -->
      <div class="flex items-center gap-2.5">
        <span data-testid="view-button" class="min-w-0 flex-1">
          <button
            type="button"
            class="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-accent-solid)] px-4 text-sm font-semibold text-[var(--color-text-on-solid)] shadow-sm transition-[filter,transform] hover:brightness-95 active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
            (click)="viewed.emit()"
          >
            <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
            <span>Open project structure</span>
          </button>
        </span>
        @if (project().isLead) {
          <app-member-button [memberCount]="project().memberCount" (pressed)="membersRequested.emit()" />
        }
      </div>

      <!-- Progress -->
      <div>
        <div class="flex items-baseline justify-between">
          <span class="text-sm font-bold text-[var(--color-text-primary)]">Progress</span>
          <span class="text-sm font-bold text-[var(--color-text-primary)]" data-testid="project-details-progress">{{ hoursProgress() }}%</span>
        </div>
        <div class="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[var(--color-surface-secondary)]">
          <div class="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-500" [style.width.%]="hoursProgress()"></div>
        </div>
      </div>

      <!-- Project information -->
      <div class="rounded-xl border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-text-primary)_2%,var(--color-surface))] px-4 py-3.5">
        <h3 class="mb-3 text-sm font-bold text-[var(--color-text-primary)]">Project Information</h3>
        <dl class="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-5 gap-y-2.5 text-sm">
          <dt class="flex items-center gap-2.5 text-[var(--color-text-secondary)]">
            <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" /></svg>
            Owner
          </dt>
          <dd class="min-w-0"><app-employee-avatar [employeeId]="project().leadId" [showName]="true" /></dd>

          <dt class="flex items-center gap-2.5 text-[var(--color-text-secondary)]">
            <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12V4h8l10 10-8 8L3 12z" /><circle cx="7.5" cy="8.5" r="1.5" /></svg>
            Category
          </dt>
          <dd class="truncate font-semibold text-[var(--color-text-primary)]">{{ categoryName() }}</dd>

          <dt class="flex items-center gap-2.5 text-[var(--color-text-secondary)]">
            <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></svg>
            Start Date
          </dt>
          <dd class="font-semibold tabular-nums text-[var(--color-text-primary)]">{{ project().startDate }}</dd>

          <dt class="flex items-center gap-2.5 text-[var(--color-text-secondary)]">
            <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></svg>
            Target Date
          </dt>
          <dd class="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span class="font-semibold tabular-nums text-[var(--color-text-primary)]">{{ project().targetDate }}</span>
            @if (!project().isAchieved) {
              @if (deadlineStatus(); as status) {
                <span
                  data-testid="project-details-deadline"
                  [class]="status.overdue
                    ? 'rounded-full px-2.5 py-0.5 text-xs font-semibold bg-[color-mix(in_srgb,var(--color-danger)_15%,var(--color-surface))] text-[var(--color-danger)]'
                    : 'rounded-full px-2.5 py-0.5 text-xs font-semibold bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]'"
                >{{ status.label }}</span>
              }
            }
          </dd>
        </dl>
      </div>

      <!-- Hours at a glance -->
      <div class="grid grid-cols-3 gap-2.5" data-testid="project-details-hours">
        <div class="rounded-xl border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-text-primary)_2%,var(--color-surface))] px-2 py-3 text-center">
          <p class="text-lg font-bold leading-tight tabular-nums text-[var(--color-text-primary)]">{{ project().allocatedHours }}h</p>
          <p class="mt-0.5 text-xs text-[var(--color-text-secondary)]">Allocated</p>
        </div>
        <div class="rounded-xl border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-text-primary)_2%,var(--color-surface))] px-2 py-3 text-center">
          <p class="text-lg font-bold leading-tight tabular-nums text-[var(--color-text-primary)]">{{ project().completedHours }}h</p>
          <p class="mt-0.5 text-xs text-[var(--color-text-secondary)]">Completed</p>
        </div>
        <div class="rounded-xl border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-text-primary)_2%,var(--color-surface))] px-2 py-3 text-center">
          <p class="text-lg font-bold leading-tight tabular-nums text-[var(--color-text-primary)]">{{ hoursProgress() }}%</p>
          <p class="mt-0.5 text-xs text-[var(--color-text-secondary)]">Progress</p>
        </div>
      </div>

      <!-- Quick actions (the lead only) -->
      @if (project().isLead) {
        <div class="rounded-xl border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-text-primary)_2%,var(--color-surface))] px-4 py-3.5 lg:mt-auto">
          <h3 class="mb-3 text-sm font-bold text-[var(--color-text-primary)]">Quick Actions</h3>
          <div class="grid grid-cols-2 gap-2.5">
            <span data-testid="settings-button" [class.col-span-2]="project().isAchieved">
              <button
                type="button"
                class="inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm font-semibold text-[var(--color-text-primary)] shadow-sm transition-colors hover:bg-[var(--color-surface-secondary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
                (click)="settingsRequested.emit()"
              >
                <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
                <span>Settings</span>
              </button>
            </span>
            @if (!project().isAchieved) {
              <span data-testid="achieve-button">
                <button
                  type="button"
                  class="inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm font-semibold text-[var(--color-text-primary)] shadow-sm transition-colors hover:bg-[var(--color-surface-secondary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
                  (click)="achieveRequested.emit()"
                >
                  <svg class="h-4 w-4 shrink-0 text-[var(--color-accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v4H4zM5 9v10h14V9M10 13h4" /></svg>
                  <span>Archive</span>
                </button>
              </span>
            }
          </div>
        </div>
      }
    </section>
  `
})
export class ProjectExplanationCardComponent {
  private readonly categoryStore = inject(ProjectCategoryStore);
  private readonly projectApi = inject(ProjectApiService);

  project = input.required<Project>();
  viewed = output<void>();
  achieveRequested = output<void>();
  settingsRequested = output<void>();
  membersRequested = output<void>();

  /** Set when the image fails to load; reset when a different project is shown. */
  readonly logoBroken = signal(false);
  readonly logoUrl = computed(() => {
    const { id, logoFileId } = this.project();
    return logoFileId && !this.logoBroken() ? this.projectApi.getLogoUrl(id, logoFileId) : null;
  });

  constructor() {
    effect(() => {
      this.project();
      this.logoBroken.set(false);
    });
  }

  readonly projectLogoInitial = computed(() => {
    const name = this.project().name?.trim();
    return name ? name.charAt(0).toUpperCase() : 'P';
  });

  readonly categoryName = computed(() => {
    const categories = this.categoryStore.categories();
    const found = categories.find((c) => c.id === this.project().categoryId);
    return found ? found.name : 'General';
  });

  readonly hoursProgress = computed(() => projectHoursProgress(this.project()));

  readonly status = computed(() => projectStatus(this.project()));
  readonly statusLabel = computed(() => PROJECT_STATUS_LABELS[this.status()]);
  /** Overdue reads red, Completed green, In progress in the theme colour. */
  readonly statusClass = computed(() => {
    const base = 'shrink-0 rounded-full px-3 py-1 text-xs font-bold';
    switch (this.status()) {
      case 'overdue':
        return `${base} bg-[color-mix(in_srgb,var(--color-danger)_15%,var(--color-surface))] text-[var(--color-danger)]`;
      case 'completed':
        return `${base} bg-[var(--color-success-subtle)] text-[var(--color-success-text)]`;
      default:
        return `${base} bg-[var(--color-accent-subtle)] text-[var(--color-accent)]`;
    }
  });

  readonly deadlineStatus = computed(() => {
    return getDeadlineStatus(this.project().targetDate);
  });
}
