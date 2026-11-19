import { TestBed } from '@angular/core/testing';
import { PersonCaseMonthGridComponent } from './person-case-month-grid.component';

describe('PersonCaseMonthGridComponent', () => {
  function render(inputs: { year: number; dots?: number[]; hireDate?: string | null; selectedMonth?: number | null }) {
    TestBed.configureTestingModule({ imports: [PersonCaseMonthGridComponent] });
    const fixture = TestBed.createComponent(PersonCaseMonthGridComponent);
    fixture.componentRef.setInput('year', inputs.year);
    fixture.componentRef.setInput('selectedMonth', inputs.selectedMonth ?? null);
    fixture.componentRef.setInput('dots', new Set(inputs.dots ?? []));
    fixture.componentRef.setInput('hireDate', inputs.hireDate ?? null);
    fixture.componentRef.setInput('today', new Date(2026, 9, 19));
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const cell = (month: number) => el.querySelector(`[data-month="${month}"]`) as HTMLButtonElement;
    return { fixture, el, cell };
  }

  it('puts a red dot on exactly the given months', () => {
    const { el, cell } = render({ year: 2026, dots: [3, 7] });

    expect(el.querySelectorAll('.pcg__dot')).toHaveLength(2);
    expect(cell(3).querySelector('.pcg__dot')).not.toBeNull();
    expect(cell(7).querySelector('.pcg__dot')).not.toBeNull();
  });

  it('disables months after today and before the hire month', () => {
    const { cell } = render({ year: 2026, hireDate: '2026-03-15' });

    expect(cell(2).disabled).toBe(true);
    expect(cell(3).disabled).toBe(false);
    expect(cell(10).disabled).toBe(false);
    expect(cell(11).disabled).toBe(true);
  });

  it('clamps a future hire date so the current month stays open', () => {
    const { cell } = render({ year: 2026, hireDate: '2027-02-01' });

    expect(cell(10).disabled).toBe(false);
    expect(cell(9).disabled).toBe(true);
  });

  it('disables the year arrows outside the range and emits picks', () => {
    const { fixture, el, cell } = render({ year: 2026, hireDate: '2025-06-01' });
    const picks: unknown[] = [];
    const years: number[] = [];
    fixture.componentInstance.pick.subscribe((p) => picks.push(p));
    fixture.componentInstance.yearChange.subscribe((y) => years.push(y));

    expect((el.querySelector('[data-testid="pcg-next-year"]') as HTMLButtonElement).disabled).toBe(true);
    (el.querySelector('[data-testid="pcg-prev-year"]') as HTMLButtonElement).click();
    cell(4).click();

    expect(years).toEqual([2025]);
    expect(picks).toEqual([{ year: 2026, month: 4 }]);
  });
});
