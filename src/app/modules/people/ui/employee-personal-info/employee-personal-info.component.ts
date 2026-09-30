import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';
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
@Component({
  selector: 'app-employee-personal-info',
  standalone: true,
  imports: [DatePipe],
  template: `
    <section class="info-card" aria-labelledby="personal-info-heading">
      <header class="info-card__head">
        <h3 id="personal-info-heading" class="info-card__title">Personal Information</h3>
        <p class="info-card__subtitle">Basic personal details of the employee.</p>
      </header>
      <dl class="info-grid">
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
    </section>

    <section class="info-card" aria-labelledby="contact-info-heading">
      <header class="info-card__head">
        <h3 id="contact-info-heading" class="info-card__title">Contact Information</h3>
        <p class="info-card__subtitle">Work and personal contact details.</p>
      </header>
      <dl class="info-grid">
        <div><dt>Work Email</dt><dd>{{ personalInformation().email }}</dd></div>
        <div><dt>Phone</dt><dd>{{ personalInformation().phone || '—' }}</dd></div>
      </dl>
    </section>

    <section class="info-card" aria-labelledby="address-info-heading">
      <header class="info-card__head">
        <h3 id="address-info-heading" class="info-card__title">Address Information</h3>
        <p class="info-card__subtitle">Current residential address.</p>
      </header>
      @if (personalInformation().addresses.length === 0) {
        <p class="info-empty">No address information available.</p>
      } @else {
        <ul class="grid grid-cols-1 md:grid-cols-2 gap-3">
          @for (address of personalInformation().addresses; track address.id) {
            <li class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-4 text-sm">
              <div class="flex items-center justify-between mb-2">
                <span class="font-semibold text-[var(--color-text-primary)] text-xs capitalize">{{ address.addressType }}</span>
                @if (address.isPrimary) {
                  <span class="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">Primary</span>
                }
              </div>
              <p class="text-xs text-[var(--color-text-secondary)] leading-relaxed">{{ formatAddress(address.addressJson) }}</p>
            </li>
          }
        </ul>
      }
    </section>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; gap: 1rem; }
    .info-card { border: 1px solid var(--color-border); border-radius: 0.75rem; background: var(--color-surface); padding: 1.25rem; }
    .info-card__head { margin-bottom: 1rem; }
    .info-card__title { margin: 0; font-size: 1rem; font-weight: 600; color: var(--color-text-primary); }
    .info-card__subtitle { margin: 0.125rem 0 0; font-size: 0.8125rem; color: var(--color-text-secondary); }
    .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); gap: 1rem 1.5rem; margin: 0; }
    .info-grid dt { font-size: 0.8125rem; color: var(--color-text-secondary); }
    .info-grid dd { margin: 0.125rem 0 0; font-size: 0.9375rem; font-weight: 600; color: var(--color-text-primary); overflow-wrap: anywhere; }
    .info-empty { margin: 0; padding: 0.875rem 1rem; border-radius: 0.5rem; background: var(--color-surface-secondary); font-size: 0.875rem; color: var(--color-text-secondary); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeePersonalInfoComponent {
  readonly personalInformation = input.required<EmployeeDetailPersonalInformation>();

  readonly formatAddress = formatAddress;
}
