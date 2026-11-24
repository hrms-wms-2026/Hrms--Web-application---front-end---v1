import { TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { PayrollPanelComponent } from './payroll-panel.component';
import { PayrollInfo } from '../../models/profile.model';

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
});
