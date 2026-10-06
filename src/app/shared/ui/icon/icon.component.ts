import { Component, input } from '@angular/core';

export type IconName = 'clipboard-list' | 'check-circle' | 'clock' | 'alert-triangle' | 'layers' | 'monitor' | 'users';

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
      }
    </svg>
  `,
  host: { class: 'inline-flex' }
})
export class IconComponent {
  readonly name = input.required<IconName>();
}
