import { TestBed } from '@angular/core/testing';
import { LeaveTypeFormModalComponent } from './leave-type-form-modal.component';

describe('LeaveTypeFormModalComponent', () => {
  it('asks only for the kind of leave, with no amounts', () => {
    const fixture = TestBed.createComponent(LeaveTypeFormModalComponent);
    fixture.detectChanges();
    const text = (fixture.nativeElement.textContent as string).toLowerCase();
    expect(text).toContain('create leave type');
    expect(text).toContain('colour');
    for (const removed of ['category', 'days per year', 'carry', 'notice', 'consecutive', 'pro-rate', 'approval'])
      expect(text).not.toContain(removed);
  });

  it('emits the kind fields only, with the chosen colour', () => {
    const fixture = TestBed.createComponent(LeaveTypeFormModalComponent);
    const emit = vi.spyOn(fixture.componentInstance.save, 'emit');
    fixture.detectChanges();
    fixture.componentInstance.form.patchValue({ name: 'Annual Leave', code: 'al', isPaid: true, applicableGender: 'all' });
    fixture.componentInstance.pickColor('#16A34A');
    fixture.componentInstance.onSubmit();
    expect(emit).toHaveBeenCalledWith({
      name: 'Annual Leave',
      code: 'AL',
      description: null,
      color: '#16A34A',
      isPaid: true,
      applicableGender: 'all',
      requiresDocument: false,
      documentRequiredAfterHours: null,
      acceptedDocumentTypes: []
    });
  });

  it('sends the document threshold in hours when a document is required', () => {
    const fixture = TestBed.createComponent(LeaveTypeFormModalComponent);
    const emit = vi.spyOn(fixture.componentInstance.save, 'emit');
    fixture.detectChanges();
    fixture.componentInstance.form.patchValue({ name: 'Sick', code: 'SL', requiresDocument: true, documentRequiredAfterHours: 16 });
    fixture.componentInstance.onSubmit();
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({
      requiresDocument: true, documentRequiredAfterHours: 16, acceptedDocumentTypes: ['pdf', 'image']
    }));
  });

  it('rejects a colour that is not #RRGGBB', () => {
    const fixture = TestBed.createComponent(LeaveTypeFormModalComponent);
    const emit = vi.spyOn(fixture.componentInstance.save, 'emit');
    fixture.detectChanges();
    fixture.componentInstance.form.patchValue({ name: 'Sick', code: 'SL', color: 'red' });
    fixture.componentInstance.onSubmit();
    expect(emit).not.toHaveBeenCalled();
  });
});
