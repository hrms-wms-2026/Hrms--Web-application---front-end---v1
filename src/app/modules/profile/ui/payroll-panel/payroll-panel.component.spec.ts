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
});
