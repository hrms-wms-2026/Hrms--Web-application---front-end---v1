import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EmployeePayrollComponent } from './employee-payroll.component';
import { EmployeeDetailPayroll } from '../../models/employee.model';
import { PeopleApiService } from '../../data-access/people-api.service';
import { of } from 'rxjs';

describe('EmployeePayrollComponent', () => {
  let fixture: ComponentFixture<EmployeePayrollComponent>;
  const api = {
    revealEmployeeBankDetails: vi.fn(() => of({
      bankName: 'First National Bank',
      branchName: 'Colombo',
      accountHolderName: 'Ada Lovelace',
      accountNumber: '1234567890',
      accountType: 'Checking',
      routingNumber: '7010'
    }))
  };

  const payroll: EmployeeDetailPayroll = {
    hasBankDetailsOnFile: true,
    bankName: 'First National Bank',
    maskedAccountNumber: '****1234',
    accountType: 'Checking'
  };

  async function setup(value: EmployeeDetailPayroll) {
    await TestBed.configureTestingModule({
      imports: [EmployeePayrollComponent],
      providers: [{ provide: PeopleApiService, useValue: api }]
    }).compileComponents();
    fixture = TestBed.createComponent(EmployeePayrollComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
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

  it('reveals full bank details on demand and can hide them again', async () => {
    await setup(payroll);

    (fixture.nativeElement.querySelector('[data-testid="reveal-bank-details"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    const revealedText = fixture.nativeElement.textContent as string;
    expect(api.revealEmployeeBankDetails).toHaveBeenCalledWith('emp-1');
    expect(revealedText).toContain('1234567890');
    expect(revealedText).toContain('Ada Lovelace');
    expect(revealedText).toContain('Colombo');
    expect(revealedText).toContain('7010');

    (fixture.nativeElement.querySelector('[data-testid="hide-bank-details"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    const hiddenText = fixture.nativeElement.textContent as string;
    expect(hiddenText).toContain('****1234');
    expect(hiddenText).not.toContain('1234567890');
  });

  it('does not carry revealed details to a different employee', async () => {
    await setup(payroll);

    (fixture.nativeElement.querySelector('[data-testid="reveal-bank-details"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('1234567890');

    fixture.componentRef.setInput('employeeId', 'emp-2');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('****1234');
    expect(fixture.nativeElement.textContent).not.toContain('1234567890');
    expect(fixture.nativeElement.querySelector('[data-testid="reveal-bank-details"]')).not.toBeNull();
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
