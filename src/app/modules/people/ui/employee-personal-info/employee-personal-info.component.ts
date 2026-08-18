import { ChangeDetectionStrategy, Component, input } from '@angular/core';
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

@Component({
  selector: 'app-employee-personal-info',
  standalone: true,
  template: `
    <div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 space-y-6">
      <!-- Section 1: Personal Information -->
      <div>
        <h3 class="text-sm font-semibold text-[var(--color-text-primary)] pb-3 mb-4 border-b border-[var(--color-border)]">
          Personal Information
        </h3>
        <dl class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 text-sm">
          <div>
            <dt class="text-xs font-medium text-[var(--color-text-secondary)] mb-1">First Name</dt>
            <dd class="font-semibold text-[var(--color-text-primary)]">{{ personalInformation().firstName }}</dd>
          </div>
          <div>
            <dt class="text-xs font-medium text-[var(--color-text-secondary)] mb-1">Last Name</dt>
            <dd class="font-semibold text-[var(--color-text-primary)]">{{ personalInformation().lastName }}</dd>
          </div>
          <div>
            <dt class="text-xs font-medium text-[var(--color-text-secondary)] mb-1">Email</dt>
            <dd class="font-semibold text-[var(--color-text-primary)]">{{ personalInformation().email }}</dd>
          </div>
          <div>
            <dt class="text-xs font-medium text-[var(--color-text-secondary)] mb-1">Phone</dt>
            <dd class="font-semibold text-[var(--color-text-primary)]">{{ personalInformation().phone || '—' }}</dd>
          </div>
          <div>
            <dt class="text-xs font-medium text-[var(--color-text-secondary)] mb-1">Date of Birth</dt>
            <dd class="font-semibold text-[var(--color-text-primary)]">{{ personalInformation().dateOfBirth || '—' }}</dd>
          </div>
          <div>
            <dt class="text-xs font-medium text-[var(--color-text-secondary)] mb-1">Gender</dt>
            <dd class="font-semibold text-[var(--color-text-primary)] capitalize">{{ personalInformation().gender || '—' }}</dd>
          </div>
        </dl>
      </div>

      <!-- Section 2: Address Information -->
      <div class="pt-6 border-t border-[var(--color-border)]">
        <h3 class="text-sm font-semibold text-[var(--color-text-primary)] pb-3 mb-4 border-b border-[var(--color-border)]">
          Address Information
        </h3>
        @if (personalInformation().addresses.length === 0) {
          <p class="text-xs text-[var(--color-text-secondary)] italic">No addresses on file.</p>
        } @else {
          <ul class="grid grid-cols-1 md:grid-cols-2 gap-4">
            @for (address of personalInformation().addresses; track address.id) {
              <li class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-4 text-sm">
                <div class="flex items-center justify-between mb-2">
                  <span class="font-semibold text-[var(--color-text-primary)] text-xs">{{ address.addressType }}</span>
                  @if (address.isPrimary) {
                    <span class="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">Primary</span>
                  }
                </div>
                <p class="text-xs text-[var(--color-text-secondary)] leading-relaxed">{{ formatAddress(address.addressJson) }}</p>
              </li>
            }
          </ul>
        }
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeePersonalInfoComponent {
  readonly personalInformation = input.required<EmployeeDetailPersonalInformation>();

  readonly formatAddress = formatAddress;
}
