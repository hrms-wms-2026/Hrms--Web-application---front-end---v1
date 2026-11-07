import { Component, input } from '@angular/core';

export type IconName =
  | 'clipboard-list'
  | 'check-circle'
  | 'clock'
  | 'alert-triangle'
  | 'layers'
  | 'monitor'
  | 'users'
  | 'calendar-check'
  | 'calendar-clock'
  | 'building'
  | 'alert-circle'
  | 'plane'
  | 'folder'
  | 'bar-chart'
  | 'user-x'
  | 'activity'
  | 'pie-chart'
  | 'arrows-diff'
  | 'list-checks'
  | 'trending-up'
  | 'trending-down'
  | 'arrow-up-right';

/**
 * Hand-authored inline SVGs (no icon library dependency), mirroring app-nav-icon's pattern.
 * Purely decorative - aria-hidden, the caller's own text carries the accessible name.
 */
@Component({
  selector: 'app-icon',
  standalone: true,
  template: `
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      @switch (name()) {
        @case ('clipboard-list') {
          <rect x="6" y="4" width="12" height="17" rx="2" />
          <path d="M9 4a1 1 0 0 1 1-2h4a1 1 0 0 1 1 2" />
          <path d="M9 11h6M9 15h6M9 7.5h2" />
        }
        @case ('check-circle') {
          <circle cx="12" cy="12" r="9" />
          <path d="m8.5 12.3 2.4 2.4 4.6-4.9" />
        }
        @case ('clock') {
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7.5V12l3 2" />
        }
        @case ('alert-triangle') {
          <path d="M12 3.5 2.5 20h19z" stroke-linejoin="round" />
          <path d="M12 9.5v4.5" />
          <path d="M12 17.2h.01" stroke-width="2.6" />
        }
        @case ('layers') {
          <path d="m12 3 8.5 4.9L12 12.8 3.5 7.9z" stroke-linejoin="round" />
          <path d="m3.5 12.4 8.5 4.9 8.5-4.9" />
          <path d="m3.5 17 8.5 4.9L20.5 17" />
        }
        @case ('monitor') {
          <rect x="3" y="4.5" width="18" height="12" rx="2" />
          <path d="M8.5 20.5h7M12 16.5v4" />
        }
        @case ('users') {
          <circle cx="9" cy="8" r="3" />
          <path d="M2.5 20c0-3.3 2.9-6 6.5-6s6.5 2.7 6.5 6" />
          <circle cx="17" cy="9" r="2.4" />
          <path d="M16 13.5c2.7.4 4.8 2.6 4.8 6" />
        }
        @case ('calendar-check') {
          <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
          <path d="M8 3v4M16 3v4M3.5 10h17" />
          <path d="m9 15 2 2 4-4" />
        }
        @case ('calendar-clock') {
          <path d="M20.5 11V7a2 2 0 0 0-2-2h-13a2 2 0 0 0-2 2v11.5a2 2 0 0 0 2 2H11" />
          <path d="M8 3v4M16 3v4M3.5 10h17" />
          <circle cx="17" cy="17" r="4" />
          <path d="M17 15.5V17l1 1" />
        }
        @case ('building') {
          <rect x="5" y="3" width="14" height="18" rx="1.5" />
          <path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1M10 21v-3h4v3" />
        }
        @case ('alert-circle') {
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7.5v5" />
          <path d="M12 16.2h.01" stroke-width="2.6" />
        }
        @case ('plane') {
          <path d="M3 13.5 10 11 7 4.5l2-.8 6 6.3 4.3-1.6a1.6 1.6 0 0 1 1.1 3l-14 5.4-3.4-3.3z" />
          <path d="M3 21h18" />
        }
        @case ('folder') {
          <path d="M3.5 7a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
        }
        @case ('bar-chart') {
          <path d="M4 20h16" />
          <path d="M7 16v-4M12 16V7M17 16v-6" />
        }
        @case ('user-x') {
          <circle cx="9" cy="8" r="3.5" />
          <path d="M2.5 20c0-3.3 2.9-6 6.5-6 1.4 0 2.7.4 3.8 1.1" />
          <path d="m16 14 5 5M21 14l-5 5" />
        }
        @case ('activity') {
          <path d="M3 12h4l3-7 4 14 3-7h4" />
        }
        @case ('pie-chart') {
          <path d="M20.5 15.5A9 9 0 1 1 8.5 3.7" />
          <path d="M21 12a9 9 0 0 0-9-9v9z" />
        }
        @case ('arrows-diff') {
          <path d="M4 8h14M14 4l4 4-4 4" />
          <path d="M20 16H6M10 12l-4 4 4 4" />
        }
        @case ('list-checks') {
          <path d="m3.5 6 1.5 1.5L8 4.5M3.5 12.5 5 14l3-3M3.5 19l1.5 1.5 3-3" />
          <path d="M12 6h8.5M12 12.5h8.5M12 19h8.5" />
        }
        @case ('trending-up') {
          <path d="m3 17 6-6 4 4 8-8" />
          <path d="M15 7h6v6" />
        }
        @case ('trending-down') {
          <path d="m3 7 6 6 4-4 8 8" />
          <path d="M15 17h6v-6" />
        }
        @case ('arrow-up-right') {
          <path d="M7 17 17 7M8 7h9v9" />
        }
      }
    </svg>
  `,
  host: { class: 'inline-flex' }
})
export class IconComponent {
  readonly name = input.required<IconName>();
}
