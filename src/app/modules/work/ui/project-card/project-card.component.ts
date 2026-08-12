import { Component, input, output } from '@angular/core';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { Project } from '../../models/project.model';

@Component({
  selector: 'app-project-card',
  standalone: true,
  imports: [ButtonComponent],
  template: `
    <div class="group relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <!-- Card Header Banner Artwork (Compact Height ~20% reduced) -->
      <div class="relative h-24 w-full overflow-hidden bg-gradient-to-br from-neutral-900 via-stone-800 to-zinc-950 p-2.5">
        <!-- Fluid abstract SVG pattern background -->
        <svg class="absolute inset-0 h-full w-full opacity-35 mix-blend-overlay" viewBox="0 0 400 120" fill="none" preserveAspectRatio="none">
          <path d="M-50 80 C 100 10, 200 140, 450 40 L 450 140 L -50 140 Z" fill="url(#grad1)" />
          <path d="M-20 30 C 120 100, 280 5, 480 90 L 480 140 L -20 140 Z" fill="url(#grad2)" opacity="0.6" />
          <defs>
            <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#ef4444" />
              <stop offset="50%" stop-color="#3b82f6" />
              <stop offset="100%" stop-color="#0f172a" />
            </linearGradient>
            <linearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#f59e0b" />
              <stop offset="100%" stop-color="#8b5cf6" />
            </linearGradient>
          </defs>
        </svg>

        <div class="relative z-10 flex items-center justify-end">
          @if (project().isLead) {
            <span data-testid="settings-button">
              <button
                type="button"
                class="flex h-7 w-7 items-center justify-center rounded-lg bg-black/40 text-white/90 backdrop-blur-md transition hover:bg-black/60 hover:text-white active:scale-95"
                aria-label="Project settings"
                (click)="settingsRequested.emit()"
              >
                <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </span>
          }
        </div>
      </div>

      <!-- Card Body Content -->
      <div class="p-3.5 pt-2.5">
        <!-- Title and Identifier -->
        <h3 class="text-sm font-semibold text-[var(--color-text-primary)] tracking-tight">
          {{ project().name }}
        </h3>
        <p class="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mt-0.5">
          {{ project().identifier }}
        </p>

        <!-- Lead Status -->
        <div class="mt-2 flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
          <svg class="h-3.5 w-3.5 stroke-[var(--color-text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span>{{ project().isLead ? 'You (Lead)' : 'No lead' }}</span>
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

        <!-- Action Footer -->
        <div class="mt-3 flex items-center justify-between gap-2">
          <div>
            @if (project().isAchieved) {
              <span class="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                Achieved
              </span>
            }
          </div>

          <span data-testid="view-button">
            <app-button variant="primary" (pressed)="viewed.emit()">View</app-button>
          </span>
        </div>
      </div>
    </div>
  `
})
export class ProjectCardComponent {
  project = input.required<Project>();
  viewed = output<void>();
  settingsRequested = output<void>();
}

