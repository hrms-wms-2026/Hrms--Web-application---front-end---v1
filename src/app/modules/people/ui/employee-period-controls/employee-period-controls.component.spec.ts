import { TestBed } from '@angular/core/testing';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { EmployeePeriodControlsComponent } from './employee-period-controls.component';

describe('EmployeePeriodControlsComponent', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 30));
  });

  afterEach(() => vi.useRealTimers());

  function setup(hireDate: string | null) {
    TestBed.configureTestingModule({ imports: [EmployeePeriodControlsComponent], providers: [EmployeePeriodStore] });
    const store = TestBed.inject(EmployeePeriodStore);
    store.setBounds(hireDate, null);
    const fixture = TestBed.createComponent(EmployeePeriodControlsComponent);
    fixture.detectChanges();
    return { fixture, store, el: fixture.nativeElement as HTMLElement };
  }

  const button = (el: HTMLElement, text: string) =>
    [...el.querySelectorAll('button')].find((b) => b.textContent?.includes(text)) as HTMLButtonElement;

  it('shows the selected month and steps back through the shared store', () => {
    const { fixture, store, el } = setup('2026-01-01');

    expect(el.querySelector('[data-testid="period-label"]')!.textContent).toContain('Sep 2026');
    (el.querySelector('button[title="Previous month"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(store.month()).toBe('2026-08');
    expect(el.querySelector('[data-testid="period-label"]')!.textContent).toContain('Aug 2026');
  });

  it('disables both steppers and Compare when employment starts in the current month', () => {
    const { el } = setup('2026-09-03');

    expect((el.querySelector('button[title="Previous month"]') as HTMLButtonElement).disabled).toBe(true);
    expect((el.querySelector('button[title="Next month"]') as HTMLButtonElement).disabled).toBe(true);
    expect(button(el, 'Compare').disabled).toBe(true);
  });

  it('opens the compare-month picker after clicking Compare and writes the picked month', () => {
    const { fixture, store, el } = setup('2026-01-01');

    button(el, 'Compare').click();
    fixture.detectChanges();
    const picker = fixture.debugElement.query((d) => d.name === 'app-employee-compare-picker');
    picker.query((d) => d.name === 'app-select').componentInstance.valueChange.emit('2026-08');
    fixture.detectChanges();

    expect(store.compareMonth()).toBe('2026-08');
    expect(button(el, 'Compare').getAttribute('aria-pressed')).toBe('true');
  });
});
