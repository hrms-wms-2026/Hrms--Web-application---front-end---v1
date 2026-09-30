import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { EmployeeDetailEmergencyContact } from '../../models/employee.model';
import { DetailCardComponent } from '../detail-kit/detail-card.component';
import { EmptyNoteComponent } from '../detail-kit/empty-note.component';
import { StatusBadgeComponent } from '../detail-kit/status-badge.component';

@Component({
  selector: 'app-employee-emergency-contacts',
  standalone: true,
  imports: [DetailCardComponent, EmptyNoteComponent, StatusBadgeComponent],
  template: `
    <app-detail-card icon="users" title="Emergency Contact" subtitle="Person to contact in case of emergency.">
      @if (emergencyContacts().length === 0) {
        <app-empty-note icon="info" title="No emergency contact information available." description="Emergency contact details have not been added yet." />
      } @else {
        <ul class="grid grid-cols-1 md:grid-cols-2 gap-3">
          @for (contact of emergencyContacts(); track contact.id) {
            <li class="rounded-lg border border-[var(--color-border)] bg-[#f7f9fc] p-4 text-sm">
              <div class="flex items-center justify-between pb-3 mb-3 border-b border-[var(--color-border)]">
                <span class="font-semibold text-[var(--color-text-primary)]">{{ contact.name }}</span>
                @if (contact.isPrimary) {
                  <app-status-badge tone="info">Primary Contact</app-status-badge>
                }
              </div>
              <dl class="grid grid-cols-2 gap-y-2 text-sm">
                <dt class="text-[var(--color-text-secondary)]">Relationship</dt>
                <dd class="font-semibold text-[var(--color-text-primary)]">{{ contact.relationship }}</dd>
                <dt class="text-[var(--color-text-secondary)]">Phone</dt>
                <dd class="font-semibold text-[var(--color-text-primary)]">{{ contact.phone }}</dd>
                <dt class="text-[var(--color-text-secondary)]">Email</dt>
                <dd class="font-semibold text-[var(--color-text-primary)]">{{ contact.email || '—' }}</dd>
              </dl>
            </li>
          }
        </ul>
      }
    </app-detail-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeEmergencyContactsComponent {
  readonly emergencyContacts = input.required<readonly EmployeeDetailEmergencyContact[]>();
}
