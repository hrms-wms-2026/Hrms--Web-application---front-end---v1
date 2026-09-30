import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { DetailCardComponent } from '../detail-kit/detail-card.component';
import { EmptyNoteComponent } from '../detail-kit/empty-note.component';
import { EmployeeDetailPersonalInformation } from '../../models/employee.model';

function formatAddress(addressJson: string): string {
  try {
    const parsed: unknown = JSON.parse(addressJson);
    if (parsed && typeof parsed === 'object') {
      const parts = Object.values(parsed as Record<string, unknown>)
        .filter((value): value is string | number => typeof value === 'string' || typeof value === 'number')
        .map((value) => String(value).trim())
        .filter((value) => value.length > 0);
      if (parts.length > 0) {
        return parts.join(', ');
      }
    }
  } catch {
    // Not valid JSON — fall through to the raw string.
  }
  return addressJson;
}

/**
 * Personal, contact and address sections of the employee Personal tab, each rendered as its own
 * card. Fields the backend does not store yet (marital status, national ID, work vs personal
 * phone) are intentionally not shown.
 */
/**
 * Personal, contact and address sections of the employee Personal tab, each rendered as its own
 * card. Fields the backend does not store yet (marital status, national ID, work vs personal
 * phone) are intentionally not shown.
 */
@Component({
  selector: 'app-employee-personal-info',
  standalone: true,
  imports: [DatePipe, DetailCardComponent, EmptyNoteComponent],
  template: `
    <app-detail-card icon="user" title="Personal Information" subtitle="Basic personal details of the employee.">
      <dl class="field-grid">
        <div><dt>First Name</dt><dd>{{ personalInformation().firstName }}</dd></div>
        <div><dt>Last Name</dt><dd>{{ personalInformation().lastName }}</dd></div>
        <div><dt>Email</dt><dd>{{ personalInformation().email }}</dd></div>
        <div><dt>Phone</dt><dd>{{ personalInformation().phone || '—' }}</dd></div>
        <div>
          <dt>Date of Birth</dt>
          <dd>{{ personalInformation().dateOfBirth ? (personalInformation().dateOfBirth | date: 'dd MMM yyyy') : '—' }}</dd>
        </div>
        <div><dt>Gender</dt><dd class="capitalize">{{ personalInformation().gender || '—' }}</dd></div>
      </dl>
    </app-detail-card>

    <app-detail-card icon="phone" title="Contact Information" subtitle="Work and personal contact details.">
      <dl class="field-grid">
        <div><dt>Work Email</dt><dd>{{ personalInformation().email }}</dd></div>
        <div><dt>Phone</dt><dd>{{ personalInformation().phone || '—' }}</dd></div>
      </dl>
    </app-detail-card>

    <app-detail-card icon="home" title="Address Information" subtitle="Current residential address.">
      @if (personalInformation().addresses.length === 0) {
        <app-empty-note icon="pin" title="No address information available." description="Address details have not been added yet." />
      } @else {
        <ul class="grid grid-cols-1 md:grid-cols-2 gap-3">
          @for (address of personalInformation().addresses; track address.id) {
            <li class="rounded-lg border border-[var(--color-border)] bg-[#f7f9fc] p-4 text-sm">
              <div class="flex items-center justify-between mb-2">
                <span class="font-semibold text-[var(--color-text-primary)] text-xs capitalize">{{ address.addressType }}</span>
                @if (address.isPrimary) {
                  <span class="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">Primary</span>
                }
              </div>
              <p class="text-sm text-[var(--color-text-secondary)] leading-relaxed">{{ formatAddress(address.addressJson) }}</p>
            </li>
          }
        </ul>
      }
    </app-detail-card>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; gap: 1rem; }
    .field-grid {
      display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1.125rem 1.5rem; margin: 0;
      padding: 1rem 0.875rem; border: 1px solid var(--color-border); border-radius: 0.625rem;
    }
    @media (max-width: 640px) { .field-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    .field-grid dt { font-size: 0.875rem; color: var(--color-text-secondary); }
    .field-grid dd { margin: 0.25rem 0 0; font-size: 1rem; font-weight: 600; color: var(--color-text-primary); overflow-wrap: anywhere; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeePersonalInfoComponent {
  readonly personalInformation = input.required<EmployeeDetailPersonalInformation>();

  readonly formatAddress = formatAddress;
}
