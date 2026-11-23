import { TestBed } from '@angular/core/testing';
import { LeaveTypeFormModalComponent } from './leave-type-form-modal.component';

describe('LeaveTypeFormModalComponent', () => {
  it('uses the shared messages for name, code and colour', () => {
    const fixture = TestBed.createComponent(LeaveTypeFormModalComponent);
    fixture.detectChanges();
    const form = fixture.componentInstance.form;
    form.controls.name.setValue('   ');
    form.controls.code.setValue('a'.repeat(21));
    form.controls.color.setValue('blue');
    form.markAllAsTouched();
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Name is required.');
    expect(text).toContain('Code must be 20 characters or fewer.');
    expect(text).toContain('Choose a colour from the list or the custom picker.');
  });

  it('asks only for the kind of leave, with no amounts', () => {
    const fixture = TestBed.createComponent(LeaveTypeFormModalComponent);
    fixture.detectChanges();
    const text = (fixture.nativeElement.textContent as string).toLowerCase();
    expect(text).toContain('create leave type');
    expect(text).toContain('colour');
    for (const removed of ['category', 'days per year', 'carry', 'notice', 'consecutive', 'pro-rate', 'approval'])
      expect(text).not.toContain(removed);
  });

  it('takes the description in a 500-character box that warns near the limit', () => {
    const fixture = TestBed.createComponent(LeaveTypeFormModalComponent);
    fixture.detectChanges();
    const textarea = fixture.nativeElement.querySelector('.ltfm-wide.ltfm-counted textarea') as HTMLTextAreaElement;
    expect(textarea).toBeTruthy();
    expect(textarea.getAttribute('maxlength')).toBe('500');
    textarea.value = 'Paid time off';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.componentInstance.form.controls.description.value).toBe('Paid time off');
    expect(fixture.nativeElement.querySelector('[data-testid="char-counter"]')).toBeNull();
    textarea.value = 'x'.repeat(400);
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect((fixture.nativeElement.querySelector('[data-testid="char-counter"]') as HTMLElement).textContent?.trim()).toBe('400 / 500');
  });

  it('picks a custom colour from its own picker, with no RGB boxes', () => {
    const fixture = TestBed.createComponent(LeaveTypeFormModalComponent);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.ltfm-swatch--custom') as HTMLButtonElement).click();
    fixture.detectChanges();
    const picker = fixture.nativeElement.querySelector('.ltfm-picker') as HTMLElement;
    expect(picker).toBeTruthy();
    expect(picker.querySelectorAll('input:not([type="range"])').length).toBe(0);
    fixture.componentInstance.sat.set(1);
    fixture.componentInstance.val.set(1);
    fixture.componentInstance.setHue(0);
    expect(fixture.componentInstance.form.controls.color.value).toBe('#FF0000');
    expect(fixture.componentInstance.isCustomColor).toBe(true);
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
      acceptedDocumentTypes: [],
      icon: ''
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
