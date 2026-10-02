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

/** 'Mar 4, 1995' from an ISO date; anything unparseable is shown as-is, missing as '—'. */
function formatDate(value: string | null): string {
  if (!value) return '—';
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return value;
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Two cards - Personal Information and Addresses - laid out as items of the Personal tab's grid
 * (the host is `display: contents`), styled like the Employment tab's cards.
 */
@Component({
  selector: 'app-employee-personal-info',
  standalone: true,
  host: { class: 'contents' },
  template: `
    <section class="flex h-full flex-col rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs xl:col-span-3" data-testid="personal-info-card">
      <header class="mb-3 flex items-center gap-2.5">
        <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600" aria-hidden="true">
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="8" r="4"></circle><path d="M4 21a8 8 0 0 1 16 0"></path>
          </svg>
        </span>
        <div>
          <h2 class="text-sm font-bold text-slate-900">Personal Information</h2>
          <p class="text-[11px] text-slate-500">Identity and contact details</p>
        </div>
      </header>

      <div class="grid flex-1 grid-cols-1 gap-x-6 gap-y-2.5 text-[13px] md:grid-cols-2 md:divide-x md:divide-slate-100">
        <dl class="space-y-2.5">
          <div class="grid grid-cols-[8rem_1fr] items-baseline gap-2 leading-5">
            <dt class="text-slate-500">First Name</dt>
            <dd class="font-medium text-slate-900">{{ personalInformation().firstName }}</dd>
          </div>
          <div class="grid grid-cols-[8rem_1fr] items-baseline gap-2 leading-5">
            <dt class="text-slate-500">Last Name</dt>
            <dd class="font-medium text-slate-900">{{ personalInformation().lastName }}</dd>
          </div>
          <div class="grid grid-cols-[8rem_1fr] items-baseline gap-2 leading-5">
            <dt class="text-slate-500">Gender</dt>
            <dd class="font-medium text-slate-900 capitalize">{{ personalInformation().gender || '—' }}</dd>
          </div>
        </dl>
        <dl class="space-y-2.5 md:pl-6">
          <div class="grid grid-cols-[8rem_1fr] items-baseline gap-2 leading-5">
            <dt class="text-slate-500">Email</dt>
            <dd class="min-w-0 truncate font-medium text-slate-900" [title]="personalInformation().email">{{ personalInformation().email }}</dd>
          </div>
          <div class="grid grid-cols-[8rem_1fr] items-baseline gap-2 leading-5">
            <dt class="text-slate-500">Phone</dt>
            <dd class="font-medium text-slate-900">{{ personalInformation().phone || '—' }}</dd>
          </div>
          <div class="grid grid-cols-[8rem_1fr] items-baseline gap-2 leading-5">
            <dt class="text-slate-500">Date of Birth</dt>
            <dd class="font-medium text-slate-900">{{ formatDate(personalInformation().dateOfBirth) }}</dd>
          </div>
        </dl>
      </div>
    </section>

    <section class="flex h-full flex-col rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs xl:col-span-2" data-testid="address-card">
      <header class="mb-3 flex items-center gap-2.5">
        <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600" aria-hidden="true">
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"></path><circle cx="12" cy="9.5" r="2.5"></circle>
          </svg>
        </span>
        <div>
          <h2 class="text-sm font-bold text-slate-900">Address Information</h2>
          <p class="text-[11px] text-slate-500">Where the employee lives</p>
        </div>
      </header>

      @if (personalInformation().addresses.length === 0) {
        <div class="flex flex-1 flex-col items-center justify-center py-4 text-center" data-testid="address-empty">
          <span class="mb-2 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-slate-400" aria-hidden="true">
            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"></path>
            </svg>
          </span>
          <p class="text-xs text-slate-500">No addresses on file.</p>
        </div>
      } @else {
        <ul class="space-y-2">
          @for (address of personalInformation().addresses; track address.id) {
            <li class="rounded-lg bg-slate-50 px-3 py-2">
              <div class="flex items-center justify-between gap-2">
                <span class="text-[13px] font-semibold capitalize text-slate-900">{{ address.addressType }}</span>
                @if (address.isPrimary) {
                  <span class="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">Primary</span>
                }
              </div>
              <p class="mt-0.5 text-xs leading-relaxed text-slate-500">{{ formatAddress(address.addressJson) }}</p>
            </li>
          }
        </ul>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeePersonalInfoComponent {
  readonly personalInformation = input.required<EmployeeDetailPersonalInformation>();

  readonly formatAddress = formatAddress;
  readonly formatDate = formatDate;
}
