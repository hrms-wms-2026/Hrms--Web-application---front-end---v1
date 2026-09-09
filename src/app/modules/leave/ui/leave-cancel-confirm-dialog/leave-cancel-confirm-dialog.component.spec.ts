import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LeaveCancelConfirmDialogComponent } from './leave-cancel-confirm-dialog.component';

describe('LeaveCancelConfirmDialogComponent', () => {
  let fixture: ComponentFixture<LeaveCancelConfirmDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [LeaveCancelConfirmDialogComponent] }).compileComponents();
    fixture = TestBed.createComponent(LeaveCancelConfirmDialogComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('leaveTypeName', 'Annual Leave');
    fixture.componentRef.setInput('startAt', '2026-09-09T14:00:00.000Z');
    fixture.componentRef.setInput('endAt', '2026-09-09T18:00:00.000Z');
    fixture.componentRef.setInput('totalHours', 4);
    fixture.componentRef.setInput('status', 'pending');
    fixture.componentRef.setInput('requireReason', false);
  });

  it('renders the confirm copy with type, datetime range, and hours', () => {
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Annual Leave');
    expect(text).toContain('9 Sep 14:00');
    expect(text).toContain('9 Sep 18:00');
    expect(text).toContain('4h');
    expect(text).not.toContain('days');
  });

  it('shows the balance-restore line only when status is approved', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('will be restored');
    fixture.componentRef.setInput('status', 'approved');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Your balance of 4h will be restored');
  });

  it('shows the partial-cancel date field only when start is in the past and end is in the future', () => {
    const today = new Date().toISOString().slice(0, 10);
    fixture.componentRef.setInput('startAt', '2020-01-01T00:00:00.000Z');
    fixture.componentRef.setInput('endAt', '2099-01-01T00:00:00.000Z');
    fixture.componentRef.setInput('status', 'approved');
    fixture.detectChanges();
    expect(fixture.componentInstance.isInProgress()).toBe(true);
    fixture.componentRef.setInput('startAt', '2099-01-01T00:00:00.000Z');
    fixture.componentRef.setInput('endAt', '2099-01-05T00:00:00.000Z');
    fixture.detectChanges();
    expect(fixture.componentInstance.isInProgress()).toBe(false);
    void today;
  });

  it('requires a reason before confirming when requireReason is true', () => {
    fixture.componentRef.setInput('requireReason', true);
    fixture.detectChanges();
    const emitted: unknown[] = [];
    fixture.componentInstance.confirmed.subscribe((e: unknown) => emitted.push(e));
    fixture.componentInstance.onConfirm();
    expect(emitted).toEqual([]);
    fixture.componentInstance.reason.set('Coverage issue');
    fixture.componentInstance.onConfirm();
    expect(emitted).toEqual([{ reason: 'Coverage issue', effectiveDate: null, expectedVersion: null }]);
  });

  it('confirms without a reason when requireReason is false', () => {
    fixture.detectChanges();
    const emitted: unknown[] = [];
    fixture.componentInstance.confirmed.subscribe((e: unknown) => emitted.push(e));
    fixture.componentInstance.onConfirm();
    expect(emitted).toEqual([{ reason: null, effectiveDate: null, expectedVersion: null }]);
  });

  it('includes the effective date when the partial-cancel field is set', () => {
    fixture.componentRef.setInput('startAt', '2020-01-01T00:00:00.000Z');
    fixture.componentRef.setInput('endAt', '2099-01-01T00:00:00.000Z');
    fixture.detectChanges();
    fixture.componentInstance.effectiveDate.set('2026-08-30');
    const emitted: unknown[] = [];
    fixture.componentInstance.confirmed.subscribe((e: unknown) => emitted.push(e));
    fixture.componentInstance.onConfirm();
    expect(emitted).toEqual([{ reason: null, effectiveDate: '2026-08-30', expectedVersion: null }]);
  });
});
