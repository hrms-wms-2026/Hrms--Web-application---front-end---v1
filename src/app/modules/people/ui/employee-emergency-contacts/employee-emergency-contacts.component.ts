import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { EmployeeDetailEmergencyContact } from '../../models/employee.model';

@Component({
  selector: 'app-employee-emergency-contacts',
  standalone: true,
  template: `
    <div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
      <h3 class="text-sm font-semibold text-[var(--color-text-primary)] pb-3 mb-4 border-b border-[var(--color-border)]">
        Emergency Contacts
      </h3>
      @if (emergencyContacts().length === 0) {
        <p class="text-xs text-[var(--color-text-secondary)] italic">
          No emergency contacts on file.
        </p>
      } @else {
        <ul class="grid grid-cols-1 md:grid-cols-2 gap-4">
          @for (contact of emergencyContacts(); track contact.id) {
            <li class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-4 text-sm">
              <div class="flex items-center justify-between pb-3 mb-3 border-b border-[var(--color-border)]">
                <span class="font-semibold text-[var(--color-text-primary)]">{{ contact.name }}</span>
                @if (contact.isPrimary) {
                  <span class="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">Primary Contact</span>
                }
              </div>
              <dl class="grid grid-cols-2 gap-y-2 text-xs">
                <dt class="font-medium text-[var(--color-text-secondary)]">Relationship</dt>
                <dd class="font-semibold text-[var(--color-text-primary)]">{{ contact.relationship }}</dd>
                <dt class="font-medium text-[var(--color-text-secondary)]">Phone</dt>
                <dd class="font-semibold text-[var(--color-text-primary)]">{{ contact.phone }}</dd>
                <dt class="font-medium text-[var(--color-text-secondary)]">Email</dt>
                <dd class="font-semibold text-[var(--color-text-primary)]">{{ contact.email || '—' }}</dd>
              </dl>
            </li>
          }
        </ul>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeEmergencyContactsComponent {
  readonly emergencyContacts = input.required<readonly EmployeeDetailEmergencyContact[]>();
}
