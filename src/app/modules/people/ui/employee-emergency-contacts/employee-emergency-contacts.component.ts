import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { EmployeeDetailEmergencyContact } from '../../models/employee.model';

/** Styled like the Employment tab's cards: icon header, compact rows, a real empty state. */
@Component({
  selector: 'app-employee-emergency-contacts',
  standalone: true,
  host: { class: 'block h-full' },
  template: `
    <section class="flex h-full flex-col rounded-xl border border-[var(--color-border)]/80 bg-[var(--color-surface)] p-4 shadow-xs" data-testid="emergency-contacts-card">
      <header class="mb-3 flex items-center gap-2.5">
        <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-danger-subtle)] text-[var(--color-danger)]" aria-hidden="true">
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"></path>
          </svg>
        </span>
        <div>
          <h2 class="text-sm font-bold text-[var(--color-text-primary)]">Emergency Contacts</h2>
          <p class="text-[11px] text-[var(--color-text-secondary)]">Who to call in an emergency</p>
        </div>
      </header>

      @if (emergencyContacts().length === 0) {
        <div class="flex flex-1 flex-col items-center justify-center py-4 text-center" data-testid="emergency-contacts-empty">
          <span class="mb-2 flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] text-[var(--color-text-muted)]" aria-hidden="true">
            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="9" cy="8" r="3"></circle><path d="M3 20a6 6 0 0 1 12 0"></path><path d="M19 8v6M16 11h6"></path>
            </svg>
          </span>
          <p class="text-xs text-[var(--color-text-secondary)]">No emergency contacts on file.</p>
        </div>
      } @else {
        <ul class="space-y-2">
          @for (contact of emergencyContacts(); track contact.id) {
            <li class="flex items-center gap-3 rounded-lg bg-[var(--color-surface-secondary)] px-3 py-2">
              <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface)] text-[11px] font-bold text-[var(--color-text-secondary)] ring-1 ring-[var(--color-border)]" aria-hidden="true">
                {{ initials(contact.name) }}
              </span>
              <div class="min-w-0 flex-1">
                <p class="flex items-center gap-2 text-[13px] font-semibold text-[var(--color-text-primary)]">
                  <span class="truncate">{{ contact.name }}</span>
                  @if (contact.isPrimary) {
                    <span class="shrink-0 rounded-full bg-[var(--color-accent-subtle)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-accent)]">Primary</span>
                  }
                </p>
                <p class="truncate text-[11px] text-[var(--color-text-secondary)]">{{ contact.relationship }}</p>
              </div>
              <div class="shrink-0 text-right text-xs">
                <p class="font-medium text-[var(--color-text-primary)]">{{ contact.phone }}</p>
                <p class="text-[11px] text-[var(--color-text-secondary)]">{{ contact.email || '—' }}</p>
              </div>
            </li>
          }
        </ul>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeEmergencyContactsComponent {
  readonly emergencyContacts = input.required<readonly EmployeeDetailEmergencyContact[]>();

  initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1]![0] : '')).toUpperCase() || '?';
  }
}
