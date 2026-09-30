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
});
