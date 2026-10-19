import { Component, computed, input, output } from '@angular/core';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A year of months to jump between; a red dot marks months that hold the person's history. Months before the hire
 *  month or after the current month are disabled (a future hire date still leaves the current month open). */
@Component({
  selector: 'app-person-case-month-grid',
  standalone: true,
  template: `
    <div class="pcg">
      <div class="pcg__head">
        <button type="button" class="pcg__arrow" data-testid="pcg-prev-year" aria-label="Previous year"
                [disabled]="year() - 1 < bounds().minYear" (click)="yearChange.emit(year() - 1)">‹</button>
        <span class="pcg__year">{{ year() }}</span>
        <button type="button" class="pcg__arrow" data-testid="pcg-next-year" aria-label="Next year"
                [disabled]="year() + 1 > bounds().maxYear" (click)="yearChange.emit(year() + 1)">›</button>
      </div>
      <div class="pcg__grid">
        @for (name of months; track $index) {
          @let month = $index + 1;
          <button type="button" class="pcg__cell" [attr.data-month]="month" [class.pcg__cell--selected]="month === selectedMonth()"
                  [disabled]="!enabled(month)" (click)="pick.emit({ year: year(), month })">
            {{ name }}
            @if (dots().has(month)) { <span class="pcg__dot" aria-label="Has cases"></span> }
          </button>
        }
      </div>
    </div>
  `,
  styles: [`
    .pcg { display: flex; width: 240px; flex-direction: column; gap: 8px; padding: 10px; }
    .pcg__head { display: flex; align-items: center; justify-content: space-between; }
    .pcg__year { font-size: 13px; font-weight: 650; }
    .pcg__arrow { width: 28px; height: 28px; border: 0; border-radius: 6px; background: none; color: var(--color-text-primary); font-size: 18px; cursor: pointer; }
    .pcg__arrow:disabled { opacity: .35; cursor: default; }
    .pcg__grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; }
    .pcg__cell { position: relative; padding: 8px 0; border: 0; border-radius: 8px; background: none; color: var(--color-text-primary); font: inherit; font-size: 12px; cursor: pointer; }
    .pcg__cell:hover:not(:disabled) { background: color-mix(in srgb, var(--color-text-primary) 6%, transparent); }
    .pcg__cell:disabled { color: var(--color-text-secondary); opacity: .45; cursor: default; }
    .pcg__cell--selected { background: color-mix(in srgb, var(--color-accent) 14%, transparent); color: var(--color-accent); font-weight: 650; }
    .pcg__dot { position: absolute; top: 5px; right: 9px; width: 6px; height: 6px; border-radius: 50%; background: var(--color-danger); }
  `]
})
export class PersonCaseMonthGridComponent {
  year = input.required<number>();
  selectedMonth = input<number | null>(null);
  dots = input<ReadonlySet<number>>(new Set<number>());
  hireDate = input<string | null>(null);
  today = input<Date>(new Date());

  pick = output<{ year: number; month: number }>();
  yearChange = output<number>();

  protected readonly months = MONTHS;

  /** Inclusive (year * 12 + month) bounds: hire month (clamped to today) … current month. */
  protected readonly bounds = computed(() => personCaseMonthBounds(this.hireDate(), this.today()));

  protected enabled(month: number): boolean {
    const key = this.year() * 12 + month;
    return key >= this.bounds().min && key <= this.bounds().max;
  }
}

export function personCaseMonthBounds(hireDate: string | null, today: Date): { min: number; max: number; minYear: number; maxYear: number } {
  const max = today.getFullYear() * 12 + today.getMonth() + 1;
  let min = Number.NEGATIVE_INFINITY;
  const hire = hireDate ? /^(\d{4})-(\d{2})/.exec(hireDate) : null;
  if (hire) min = Math.min(Number(hire[1]) * 12 + Number(hire[2]), max);
  // key = year * 12 + month (1-12), so the key's year is floor((key - 1) / 12).
  const minYear = Number.isFinite(min) ? Math.floor((min - 1) / 12) : Number.NEGATIVE_INFINITY;
  return { min, max, minYear, maxYear: today.getFullYear() };
}
