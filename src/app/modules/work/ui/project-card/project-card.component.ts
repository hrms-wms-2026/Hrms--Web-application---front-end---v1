import { Component, computed, inject, input, output } from '@angular/core';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { AvatarStackComponent } from '../../../../shared/ui/avatar-stack/avatar-stack.component';
import { ProjectApiService } from '../../data-access/project-api.service';
import { FileApiService } from '../../../../shared/data-access/file-api.service';
import { Project } from '../../models/project.model';
import { formatRelativeTime } from '../../utils/relative-time.util';
import { EntityIconComponent } from '../../../../shared/ui/entity-icon/entity-icon.component';

const DEFAULT_BANNER_COLOR = '#3B82F6';
const COLLAPSED_AVATAR_LIMIT = 3;
const EXPANDED_AVATAR_LIMIT = 20;

@Component({
  selector: 'app-project-card',
  standalone: true,
  imports: [ButtonComponent, AvatarComponent, AvatarStackComponent, EntityIconComponent],
  styles: `
    @keyframes drift-a {
      0%, 100% { transform: translate(-8%, -8%) scale(1); }
      50% { transform: translate(14%, 10%) scale(1.08); }
    }
    @keyframes drift-b {
      0%, 100% { transform: translate(10%, 8%) scale(1); }
      50% { transform: translate(-14%, -10%) scale(1.1); }
    }
    .drift-blob-a { animation: drift-a 22s ease-in-out infinite; }
    .drift-blob-b { animation: drift-b 26s ease-in-out infinite; }
    @media (prefers-reduced-motion: reduce) {
      .drift-blob-a, .drift-blob-b { animation: none; }
    }
  `,
  template: `
    <div
      class="group relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
      [attr.data-flip-id]="project().id"
    >
      <!-- Card Header Banner Artwork -->
      <div class="relative h-24 w-full overflow-hidden bg-gradient-to-br from-neutral-900 via-stone-800 to-zinc-950 p-2.5">
        @if (logoUrl(); as url) {
          <img data-testid="project-logo" class="absolute inset-0 h-full w-full object-cover" [src]="url" alt="" />
        } @else {
          <!-- Animated fallback banner: two blurred blobs drifting slowly, seeded from the project's color -->
          <div data-testid="fallback-banner" class="absolute inset-0 overflow-hidden" [style.--banner-color]="bannerAccentColor()">
            <span class="drift-blob-a absolute -left-4 -top-6 h-32 w-32 rounded-full opacity-60 blur-3xl" style="background: var(--banner-color);"></span>
            <span class="drift-blob-b absolute -right-6 -bottom-8 h-28 w-28 rounded-full opacity-50 blur-3xl" style="background: color-mix(in srgb, var(--banner-color) 55%, #8b5cf6 45%);"></span>
          </div>
        }

        <!-- Status pill -->
        <span
          data-testid="status-pill"
          class="relative z-10 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold backdrop-blur-md {{ project().isAchieved ? 'bg-emerald-500/20 text-emerald-100' : 'bg-white/15 text-white' }}"
        >
          <span class="h-1.5 w-1.5 rounded-full {{ project().isAchieved ? 'bg-emerald-400' : 'bg-sky-300' }}"></span>
          {{ project().isAchieved ? 'Achieved' : 'Active' }}
        </span>

        <div class="absolute right-2.5 top-2.5 z-10 flex items-center justify-end">
          @if (project().isLead && project().systemPurpose !== 'office') {
            <span data-testid="settings-button">
              <button
                type="button"
                class="flex h-7 w-7 items-center justify-center rounded-lg bg-black/40 text-white/90 backdrop-blur-md transition hover:bg-black/60 hover:text-white active:scale-95"
                aria-label="Project settings"
                (click)="onSettingsClick($event)"
              >
                <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="5" r="1.75" />
                  <circle cx="12" cy="12" r="1.75" />
                  <circle cx="12" cy="19" r="1.75" />
                </svg>
              </button>
            </span>
          }
        </div>
      </div>

      <!-- Card Body Content -->
      <div class="p-3.5 pt-2.5">
        <div class="flex items-start justify-between gap-2">
          @if (project().icon; as projectIcon) {
            <app-entity-icon data-testid="project-icon" class="mt-0.5" [icon]="projectIcon" [color]="project().color" [name]="project().name" />
          }
          <div class="min-w-0 flex-1">
            <h3 class="truncate text-sm font-semibold text-[var(--color-text-primary)] tracking-tight">
              {{ project().name }}
            </h3>
            <p class="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mt-0.5">
              {{ project().identifier }}
            </p>
          </div>
          <button
            type="button"
            data-testid="expand-toggle"
            class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-primary)]"
            [attr.aria-expanded]="expanded()"
            [attr.aria-label]="expanded() ? 'Collapse project details' : 'Expand project details'"
            (click)="onExpandToggleClick($event)"
          >
            <svg
              class="h-3.5 w-3.5 transition-transform"
              [style.transform]="expanded() ? 'rotate(180deg)' : 'rotate(0deg)'"
              viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>

        @if (updatedAtText(); as updated) {
          <p data-testid="updated-at" class="mt-1 text-[11px] text-[var(--color-text-secondary)]">{{ updated }}</p>
        }

        @if (project().description; as description) {
          <p
            data-testid="description"
            class="mt-1.5 text-xs text-[var(--color-text-secondary)] {{ expanded() ? '' : 'line-clamp-2' }}"
          >{{ description }}</p>
        }

        @if (project().labels.length > 0) {
          <div class="mt-2 flex flex-wrap gap-1.5">
            @for (label of project().labels; track label.id) {
              <span
                data-testid="tag-chip"
                class="rounded-full px-2 py-0.5 text-[10px] font-medium"
                [style.background-color]="label.color + '1A'"
                [style.color]="label.color"
              >{{ label.name }}</span>
            }
          </div>
        }

        <!-- Lead + Members row -->
        <div class="mt-2.5 flex items-center justify-between gap-2">
          <div class="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
            <svg class="h-3.5 w-3.5 stroke-[var(--color-text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span>{{ project().isLead ? 'You (Lead)' : 'No lead' }}</span>
          </div>
          @if (project().members.length > 0) {
            <app-avatar-stack
              [members]="avatarStackMembers()"
              [totalCount]="project().memberCount"
              [maxVisible]="avatarStackLimit()"
              size="sm"
            />
          }
        </div>

        <!-- Dates Metadata -->
        <div class="mt-2 grid grid-cols-2 gap-2 border-t border-[var(--color-border)] pt-2 text-xs">
          <div>
            <span class="block text-[10px] text-[var(--color-text-secondary)]">Start</span>
            <span class="font-medium text-[var(--color-text-primary)]">{{ project().startDate }}</span>
          </div>
          <div>
            <span class="block text-[10px] text-[var(--color-text-secondary)]">Target</span>
            <span class="font-medium text-[var(--color-text-primary)]">{{ project().targetDate }}</span>
          </div>
        </div>

        @if (expanded() && project().members.length > 0) {
          <div data-testid="member-list" class="mt-2.5 flex flex-col gap-1.5 border-t border-[var(--color-border)] pt-2.5">
            @for (member of project().members; track member.userId) {
              <div class="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                <app-avatar [avatarUrl]="member.avatarFileId ? fileApi.getFileUrl(member.avatarFileId) : null" [userName]="member.displayName" size="sm" />
                <span>{{ member.displayName }}</span>
              </div>
            }
          </div>
        }

        <!-- Action Footer -->
        <div class="mt-3 flex items-center justify-end gap-2">
          <span data-testid="view-button">
            <app-button variant="primary" (pressed)="onViewClick($event)">View</app-button>
          </span>
        </div>
      </div>
    </div>
  `
})
export class ProjectCardComponent {
  private readonly projectApi = inject(ProjectApiService);
  protected readonly fileApi = inject(FileApiService);

  project = input.required<Project>();
  expanded = input(false);
  viewed = output<void>();
  settingsRequested = output<void>();
  toggleExpandRequested = output<void>();

  readonly logoUrl = computed(() => {
    const { id, logoFileId } = this.project();
    return logoFileId ? this.projectApi.getLogoUrl(id, logoFileId) : null;
  });

  readonly bannerAccentColor = computed(() => this.project().color ?? DEFAULT_BANNER_COLOR);
  readonly updatedAtText = computed(() => formatRelativeTime(this.project().updatedAt));
  readonly avatarStackLimit = computed(() => (this.expanded() ? EXPANDED_AVATAR_LIMIT : COLLAPSED_AVATAR_LIMIT));
  readonly avatarStackMembers = computed(() =>
    this.project().members.map((member) => ({
      ...member,
      avatarUrl: member.avatarFileId ? this.fileApi.getFileUrl(member.avatarFileId) : null
    }))
  );

  onViewClick(event: MouseEvent): void {
    event.stopPropagation();
    this.viewed.emit();
  }

  onSettingsClick(event: MouseEvent): void {
    event.stopPropagation();
    this.settingsRequested.emit();
  }

  onExpandToggleClick(event: MouseEvent): void {
    event.stopPropagation();
    this.toggleExpandRequested.emit();
  }
}
