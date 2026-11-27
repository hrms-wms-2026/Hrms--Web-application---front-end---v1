import { TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { PayrollPanelComponent } from './payroll-panel.component';
import { PayrollInfo } from '../../models/profile.model';
import { HttpErrorResponse } from '@angular/common/http';
import { toApiError } from '../../../../core/errors/api-error';

describe('PayrollPanelComponent', () => {
  it('shows masked account number and no edit form when canEdit is false', async () => {
    const payroll: PayrollInfo = { hasBankDetailsOnFile: true, bankName: 'Test Bank', maskedAccountNumber: '****1234', accountType: 'savings', canEdit: false };
    await TestBed.configureTestingModule({ imports: [PayrollPanelComponent, ReactiveFormsModule] }).compileComponents();
    const fixture = TestBed.createComponent(PayrollPanelComponent);
    fixture.componentRef.setInput('payroll', payroll);
    fixture.componentRef.setInput('saving', false);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('****1234');
    expect(fixture.nativeElement.querySelector('form')).toBeFalsy();
  });

  it('shows the edit form when canEdit is true', async () => {
    const payroll: PayrollInfo = { hasBankDetailsOnFile: false, bankName: null, maskedAccountNumber: null, accountType: null, canEdit: true };
    await TestBed.configureTestingModule({ imports: [PayrollPanelComponent, ReactiveFormsModule] }).compileComponents();
    const fixture = TestBed.createComponent(PayrollPanelComponent);
    fixture.componentRef.setInput('payroll', payroll);
    fixture.componentRef.setInput('saving', false);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('form')).toBeTruthy();
  });

  it('limits bank details to the backend sizes', () => {
    const fixture = TestBed.createComponent(PayrollPanelComponent);
    const payroll: PayrollInfo = { hasBankDetailsOnFile: false, bankName: null, maskedAccountNumber: null, accountType: null, canEdit: true };
    fixture.componentRef.setInput('payroll', payroll);
    fixture.componentRef.setInput('saving', false);
    fixture.detectChanges();
    const form = fixture.componentInstance.form;
    const over = (n: number) => 'a'.repeat(n + 1);
    form.controls.bankName.setValue(over(100));
    form.controls.branchName.setValue(over(100));
    form.controls.accountHolderName.setValue(over(100));
    form.controls.accountNumber.setValue(over(34));
    form.controls.accountType.setValue(over(30));
    form.controls.routingNumber.setValue(over(20));
    for (const [key, max] of [['bankName', 100], ['branchName', 100], ['accountHolderName', 100], ['accountNumber', 34], ['accountType', 30], ['routingNumber', 20]] as const) {
      expect(form.controls[key].errors, key).toEqual({ maxlength: { requiredLength: max, actualLength: max + 1 } });
    }
  });

  describe('server errors (task 20 follow-up)', () => {
    const refused = (status: number, error: unknown) => toApiError(new HttpErrorResponse({ status, error }));

    it('shows the field message of a refused save under its field', () => {
      const fixture = (() => { const f = TestBed.createComponent(PayrollPanelComponent); f.componentRef.setInput('payroll', { hasBankDetailsOnFile: false, bankName: null, maskedAccountNumber: null, accountType: null, canEdit: true }); f.componentRef.setInput('saving', false); f.detectChanges(); return f; })();
      fixture.componentRef.setInput('serverError', refused(400, { errors: { AccountNumber: ['Account number must be 34 characters or fewer.'] } }));
      fixture.detectChanges();
      expect(fixture.componentInstance.form.controls.accountNumber.errors?.['server']).toEqual({ message: 'Account number must be 34 characters or fewer.' });
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('Account number must be 34 characters or fewer.');
    });

    it('shows a refusal with no field message in the panel', () => {
      const fixture = (() => { const f = TestBed.createComponent(PayrollPanelComponent); f.componentRef.setInput('payroll', { hasBankDetailsOnFile: false, bankName: null, maskedAccountNumber: null, accountType: null, canEdit: true }); f.componentRef.setInput('saving', false); f.detectChanges(); return f; })();
      fixture.componentRef.setInput('serverError', refused(409, { detail: 'This record was changed by someone else.' }));
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('This record was changed by someone else.');
    });
  });
});
