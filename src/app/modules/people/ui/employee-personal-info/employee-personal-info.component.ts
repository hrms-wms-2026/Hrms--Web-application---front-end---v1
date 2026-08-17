import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { EmployeeDetailPersonalInformation } from '../../models/employee.model';

@Component({
  selector: 'app-employee-personal-info',
  standalone: true,
  template: `
    <dl class="grid max-w-2xl grid-cols-2 gap-y-3 rounded-lg border border-[var(--color-border)] p-4 text-sm">
      <dt class="text-[var(--color-text-secondary)]">First Name</dt>
      <dd>{{ personalInformation().firstName }}</dd>
      <dt class="text-[var(--color-text-secondary)]">Last Name</dt>
      <dd>{{ personalInformation().lastName }}</dd>
      <dt class="text-[var(--color-text-secondary)]">Email</dt>
      <dd>{{ personalInformation().email }}</dd>
      <dt class="text-[var(--color-text-secondary)]">Phone</dt>
      <dd>{{ personalInformation().phone || '—' }}</dd>
      <dt class="text-[var(--color-text-secondary)]">Date of Birth</dt>
      <dd>{{ personalInformation().dateOfBirth || '—' }}</dd>
      <dt class="text-[var(--color-text-secondary)]">Gender</dt>
      <dd class="capitalize">{{ personalInformation().gender || '—' }}</dd>
    </dl>

    <div class="mt-4 max-w-2xl rounded-lg border border-[var(--color-border)] p-4 text-sm">
      <h3 class="mb-3 font-medium">Addresses</h3>
      @if (personalInformation().addresses.length === 0) {
        <p class="text-[var(--color-text-secondary)]">—</p>
      } @else {
        <ul class="flex flex-col gap-3">
          @for (address of personalInformation().addresses; track address.id) {
            <li class="flex flex-col gap-1 border-b border-[var(--color-border)] pb-3 last:border-b-0 last:pb-0">
              <div class="flex items-center gap-2">
                <span class="font-medium">{{ address.addressType }}</span>
                @if (address.isPrimary) {
                  <span class="text-xs text-[var(--color-text-secondary)]">(Primary)</span>
                }
              </div>
              <span class="text-[var(--color-text-secondary)]">{{ address.addressJson }}</span>
            </li>
          }
        </ul>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeePersonalInfoComponent {
  readonly personalInformation = input.required<EmployeeDetailPersonalInformation>();
}
