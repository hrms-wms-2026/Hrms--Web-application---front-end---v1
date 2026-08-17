import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { EmployeeDetailEmergencyContact } from '../../models/employee.model';

@Component({
  selector: 'app-employee-emergency-contacts',
  standalone: true,
  template: `
    @if (emergencyContacts().length === 0) {
      <p class="max-w-2xl rounded-lg border border-[var(--color-border)] p-4 text-sm text-[var(--color-text-secondary)]">
        No emergency contacts on file.
      </p>
    } @else {
      <ul class="flex max-w-2xl flex-col gap-3">
        @for (contact of emergencyContacts(); track contact.id) {
          <li class="rounded-lg border border-[var(--color-border)] p-4 text-sm">
            <dl class="grid grid-cols-2 gap-y-3">
              <dt class="text-[var(--color-text-secondary)]">Name</dt>
              <dd>
                {{ contact.name }}
                @if (contact.isPrimary) {
                  <span class="text-xs text-[var(--color-text-secondary)]">(Primary)</span>
                }
              </dd>
              <dt class="text-[var(--color-text-secondary)]">Relationship</dt>
              <dd>{{ contact.relationship }}</dd>
              <dt class="text-[var(--color-text-secondary)]">Phone</dt>
              <dd>{{ contact.phone }}</dd>
              <dt class="text-[var(--color-text-secondary)]">Email</dt>
              <dd>{{ contact.email || '—' }}</dd>
            </dl>
          </li>
        }
      </ul>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeEmergencyContactsComponent {
  readonly emergencyContacts = input.required<readonly EmployeeDetailEmergencyContact[]>();
}
