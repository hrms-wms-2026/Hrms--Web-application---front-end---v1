import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EmployeePayrollComponent } from './employee-payroll.component';
import { EmployeeDetailPayroll } from '../../models/employee.model';

describe('EmployeePayrollComponent', () => {
  let fixture: ComponentFixture<EmployeePayrollComponent>;

  const payroll: EmployeeDetailPayroll = {
    hasBankDetailsOnFile: true,
    bankName: 'First National Bank',
    maskedAccountNumber: '****1234',
    accountType: 'Checking'
  };

  async function setup(value: EmployeeDetailPayroll) {
    await TestBed.configureTestingModule({ imports: [EmployeePayrollComponent] }).compileComponents();
    fixture = TestBed.createComponent(EmployeePayrollComponent);
    fixture.componentRef.setInput('payroll', value);
    fixture.detectChanges();
  }

  it('renders the bank name, masked account number, and account type', async () => {
    await setup(payroll);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('First National Bank');
    expect(text).toContain('****1234');
    expect(text).toContain('Checking');
  });

  it('shows a fallback when hasBankDetailsOnFile is true but individual fields are missing', async () => {
    await setup({ hasBankDetailsOnFile: true, bankName: null, maskedAccountNumber: null, accountType: null });
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('—');
  });

  it('shows a distinct empty state when hasBankDetailsOnFile is false, not blank dashes', async () => {
    await setup({ hasBankDetailsOnFile: false, bankName: null, maskedAccountNumber: null, accountType: null });
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('No bank details on file.');
    expect(text).not.toContain('Bank Name');
  });
});
