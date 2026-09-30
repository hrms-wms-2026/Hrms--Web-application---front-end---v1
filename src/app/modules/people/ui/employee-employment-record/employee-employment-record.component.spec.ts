import { TestBed } from '@angular/core/testing';
import { EmployeeEmploymentRecordComponent } from './employee-employment-record.component';

describe('EmployeeEmploymentRecordComponent', () => {
  function render(inputs: { hireDate: string; probationEndDate: string | null; status: string }) {
    TestBed.configureTestingModule({ imports: [EmployeeEmploymentRecordComponent] });
    const fixture = TestBed.createComponent(EmployeeEmploymentRecordComponent);
    for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows hire date, tenure and status', () => {
    const el = render({ hireDate: '2024-01-15', probationEndDate: null, status: 'active' });

    expect(el.textContent).toContain('Employment Record');
    expect(el.textContent).toContain('15 Jan 2024');
    expect(el.textContent).toContain('Active');
  });

  it('shows probation as Completed when the end date has passed', () => {
    const el = render({ hireDate: '2020-01-15', probationEndDate: '2020-04-15', status: 'active' });

    expect(el.querySelector('[data-testid="probation"]')?.textContent).toContain('Completed');
  });

  it('shows the probation end date while probation is still running', () => {
    const el = render({ hireDate: '2020-01-15', probationEndDate: '2999-01-01', status: 'active' });

    expect(el.querySelector('[data-testid="probation"]')?.textContent).toContain('Ends');
  });

  it('shows Not applicable when there is no probation end date', () => {
    const el = render({ hireDate: '2020-01-15', probationEndDate: null, status: 'active' });

    expect(el.querySelector('[data-testid="probation"]')?.textContent).toContain('Not applicable');
  });
});
