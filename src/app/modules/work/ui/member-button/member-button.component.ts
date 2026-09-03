import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-member-button',
  standalone: true,
  template: `
    <button
      type="button"
      data-testid="member-button"
      class="relative flex items-center justify-center rounded-md p-0.5 transition-colors text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]"
      aria-label="Members"
      (click)="pressed.emit()"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
      @if (memberCount() > 0) {
        <span
          data-testid="member-count-badge"
          class="absolute -right-1 -top-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-[var(--color-accent)] px-0.5 text-[9px] font-semibold leading-none text-white"
        >{{ memberCount() }}</span>
      }
    </button>
  `
})
export class MemberButtonComponent {
  memberCount = input(0);
  pressed = output<void>();
}
