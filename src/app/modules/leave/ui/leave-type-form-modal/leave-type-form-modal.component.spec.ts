import { TestBed } from '@angular/core/testing';
import { LeaveTypeFormModalComponent } from './leave-type-form-modal.component';

describe('LeaveTypeFormModalComponent', () => {
  it('renders a single create form without fake wizard steps', () => {
    const fixture = TestBed.createComponent(LeaveTypeFormModalComponent);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Create leave type');
    expect(text).toContain('Request rules');
    expect(text).not.toContain('TIME OFF / CONFIGURATION');
    expect(text).not.toContain('Set the essentials first');
    expect(text).not.toContain('Identity & allowance');
    expect(text).not.toContain('Good to know');
    expect(fixture.nativeElement.querySelector('.ltfm-step')).toBeNull();
  });

  it('emits all request rules so they can be saved', () => {
    const fixture = TestBed.createComponent(LeaveTypeFormModalComponent);
    const emit = vi.spyOn(fixture.componentInstance.save, 'emit');
    fixture.detectChanges();
    fixture.componentInstance.form.patchValue({
      name: 'Annual Leave',
      code: 'AL',
      defaultDaysPerYear: 14,
      isPaid: true,
      requiresApproval: true,
      carryForwardAllowed: true,
      maxCarryForwardDays: 5,
      carryForwardExpiryMonths: 3,
      proRataForNewJoiners: true,
      minimumNoticeDays: 7
    });
    fixture.componentInstance.onSubmit();
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Annual Leave',
      code: 'AL',
      defaultDaysPerYear: 14,
      isPaid: true,
      requiresApproval: true,
      carryForwardAllowed: true,
      maxCarryForwardDays: 5,
      carryForwardExpiryMonths: 3,
      proRataForNewJoiners: true,
      minimumNoticeDays: 7
    }));
  });
});
