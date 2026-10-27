import { Component, input } from '@angular/core';
import { NavIconName } from '../nav/nav-item.model';

/**
 * Hand-authored inline SVGs (no icon library dependency). Purely decorative - aria-hidden,
 * the nav item's own text label carries the accessible name.
 */
@Component({
  selector: 'app-nav-icon',
  standalone: true,
  template: `
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      @switch (name()) {
        @case ('home') {
          @if (active()) {
            <path
              d="M4 10.7V17c0 2.2 1.8 4 4 4h1.5v-4a2.5 2.5 0 0 1 5 0v4H16c2.2 0 4-1.8 4-4v-6.3c0-.9-.4-1.8-1.1-2.4l-5.6-4.7c-.8-.7-2-.7-2.8 0l-5.6 4.7C4.4 8.9 4 9.8 4 10.7z"
              fill="currentColor"
              stroke="none"
            />
          } @else {
            <path
              d="M4 10.7V17c0 2.2 1.8 4 4 4h8c2.2 0 4-1.8 4-4v-6.3c0-.9-.4-1.8-1.1-2.4l-5.6-4.7c-.8-.7-2-.7-2.8 0l-5.6 4.7C4.4 8.9 4 9.8 4 10.7z"
              stroke="currentColor"
              stroke-width="2.2"
              stroke-linecap="round"
              stroke-linejoin="round"
              fill="none"
            />
            <path
              d="M9.5 21v-4a2.5 2.5 0 0 1 5 0v4"
              stroke="currentColor"
              stroke-width="2.2"
              stroke-linecap="round"
              stroke-linejoin="round"
              fill="none"
            />
          }
        }
        @case ('work') {
          <rect x="3" y="7" width="18" height="13" rx="2" />
          <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <path d="M3 13h18" />
        }
        @case ('inbox') {
          <path d="M3 13h5l1.5 3h5L16 13h5" />
          <path d="M5.5 5h13l2.5 8v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5l2.5-8Z" />
        }
        @case ('people') {
          <circle cx="9" cy="8" r="3" />
          <path d="M2 20c0-3.3 3-6 7-6s7 2.7 7 6" />
          <circle cx="17" cy="9" r="2.5" />
          <path d="M16 13.5c2.8.3 5 2.6 5 5.5" />
        }
        @case ('calendar') {
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18" />
          <path d="M8 3v4" />
          <path d="M16 3v4" />
        }
        @case ('time-off') {
          <circle cx="12" cy="12" r="4" />
          <path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
        }
        @case ('time-attendance') {
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 3" />
        }
        @case ('organization') {
          <path d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75Z" />
        }
        @case ('settings') {
          @if (active()) {
            <path
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M7.8 3.8h8.4c.6 0 1.2.3 1.5.8l3.7 6.4c.4.7.4 1.6 0 2.3l-3.7 6.4c-.3.5-.9.8-1.5.8H7.8c-.6 0-1.2-.3-1.5-.8L2.6 13.3c-.4-.7-.4-1.6 0-2.3l3.7-6.4c.3-.5.9-.8 1.5-.8z M12 8.5c-1.933 0-3.5 1.567-3.5 3.5s1.567 3.5 3.5 3.5 3.5-1.567 3.5-3.5-1.567-3.5-3.5-3.5z"
              fill="currentColor"
            />
          } @else {
            <path
              d="M7.8 3.8h8.4c.6 0 1.2.3 1.5.8l3.7 6.4c.4.7.4 1.6 0 2.3l-3.7 6.4c-.3.5-.9.8-1.5.8H7.8c-.6 0-1.2-.3-1.5-.8L2.6 13.3c-.4-.7-.4-1.6 0-2.3l3.7-6.4c.3-.5.9-.8 1.5-.8z"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              fill="none"
            />
            <circle cx="12" cy="12" r="3.5" stroke="currentColor" stroke-width="2" fill="none" />
          }
        }
        @case ('more') {
          <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" [attr.fill]="active() ? 'currentColor' : 'none'" />
          <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" [attr.fill]="active() ? 'currentColor' : 'none'" />
          <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" [attr.fill]="active() ? 'currentColor' : 'none'" />
          <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" [attr.fill]="active() ? 'currentColor' : 'none'" />
        }
      }
    </svg>
  `
})
export class NavIconComponent {
  name = input.required<NavIconName>();
  active = input<boolean>(false);
}
