import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { EmployeeDetailResponse } from '../../../models/employee.model';
import { EmployeePersonalTabComponent } from './employee-personal-tab.component';
import { detailFixture, setupTabTestBed } from './employee-detail-tab.testing';

describe('EmployeePersonalTabComponent', () => {
  async function render(employee: EmployeeDetailResponse) {
    await setupTabTestBed(
      employee.id,
      { getEmployeeDetail: vi.fn().mockReturnValue(of(employee)), getJobJourney: vi.fn().mockReturnValue(of([])) },
      { success: vi.fn(), error: vi.fn() }
    );
    const fixture = TestBed.createComponent(EmployeePersonalTabComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('renders personal information and emergency contacts', async () => {
    const fixture = await render(detailFixture);

    expect(fixture.nativeElement.querySelector('app-employee-personal-info')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-employee-emergency-contacts')).toBeTruthy();
  });

  it('renders the Payroll section when the response includes it', async () => {
    const fixture = await render({
      ...detailFixture,
      payroll: { hasBankDetailsOnFile: true, bankName: 'Test Bank', maskedAccountNumber: '****1234', accountType: 'checking' }
    });

    expect(fixture.nativeElement.querySelector('app-employee-payroll')).toBeTruthy();
  });

  it('omits the Payroll section when the response does not include it', async () => {
    const fixture = await render({ ...detailFixture, payroll: null });

    expect(fixture.nativeElement.querySelector('app-employee-payroll')).toBeFalsy();
  });

  it('shows profile completion, the hire date, and the time zone in additional information', async () => {
    const fixture = await render({
      ...detailFixture,
      jobInformation: { ...detailFixture.jobInformation, timezone: 'Asia/Colombo' },
      emergencyContacts: [{ id: 'c1', name: 'Grace', relationship: 'Sister', phone: '+1', email: null, isPrimary: true }]
    });
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('[data-testid="profile-completion-text"]')?.textContent).toContain('25%');
    expect(root.textContent).toContain('15 Jan 2024');
    expect(root.querySelector('[data-testid="work-anniversary"]')).toBeTruthy();
    expect(root.textContent).toContain('Asia/Colombo');
  });
});
