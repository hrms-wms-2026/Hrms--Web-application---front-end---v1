import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { EmployeeComparePickerComponent } from '../employee-compare-picker/employee-compare-picker.component';

/**
 * Month stepper + Compare toggle for the Overview tab. Rendered in the employee profile header,
 * so it reads the EmployeePeriodStore provided by the employee detail page.
 */
@Component({
  selector: 'app-employee-period-controls',
  standalone: true,
  imports: [EmployeeComparePickerComponent],
  template: `
    <div class="flex flex-wrap items-center gap-3" data-testid="period-controls">
      <div class="inline-flex items-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <button
          type="button"
          class="px-2.5 py-1.5 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
          (click)="store.previousMonth()"
          [disabled]="!store.canGoPrevious()"
          title="Previous month"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <div class="flex items-center gap-2 border-x border-slate-100 px-3.5 py-1.5 text-sm font-semibold text-slate-800" data-testid="period-label">
          <svg class="h-4 w-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          <span>{{ store.label() }}</span>
        </div>
        <button
          type="button"
          class="px-2.5 py-1.5 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
          (click)="store.nextMonth()"
          [disabled]="!store.canGoNext()"
          title="Next month"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>

      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-xl border px-3.5 py-1.5 text-sm font-semibold shadow-xs transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
        [class.border-blue-300]="store.isComparing()"
        [class.bg-blue-50]="store.isComparing()"
        [class.text-blue-600]="store.isComparing()"
        [class.border-slate-200]="!store.isComparing()"
        [class.bg-white]="!store.isComparing()"
        [class.text-slate-800]="!store.isComparing()"
        [attr.aria-pressed]="store.isComparing()"
        (click)="store.toggleCompare()"
        [disabled]="store.compareOptions().length === 0"
      >
        <svg class="h-4 w-4 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
          <polyline points="17 6 23 6 23 12"></polyline>
        </svg>
        <span>Compare</span>
      </button>

      @if (store.isComparing()) {
        <app-employee-compare-picker />
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeePeriodControlsComponent {
  protected readonly store = inject(EmployeePeriodStore);
}
