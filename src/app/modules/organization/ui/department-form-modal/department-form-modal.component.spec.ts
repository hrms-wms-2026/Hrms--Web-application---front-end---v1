import { TestBed } from '@angular/core/testing';
import { DepartmentFormModalComponent } from './department-form-modal.component';

describe('DepartmentFormModalComponent validation', () => {
  function setup() {
    const fixture = TestBed.createComponent(DepartmentFormModalComponent);
    fixture.componentRef.setInput('companyName', 'Acme');
    fixture.detectChanges();
    return fixture;
  }

  it('rejects a name over the backend limit of 100', () => {
    const { form } = setup().componentInstance;
    form.controls.name.setValue('a'.repeat(101));
    expect(form.controls.name.errors).toEqual({ maxlength: { requiredLength: 100, actualLength: 101 } });
    form.controls.name.setValue('a'.repeat(100));
    expect(form.controls.name.errors).toBeNull();
  });

  it('rejects a whitespace-only name and a code with characters the backend refuses', () => {
    const { form } = setup().componentInstance;
    form.controls.name.setValue('   ');
    expect(form.controls.name.errors).toEqual({ required: true });
    form.controls.code.setValue('R&D');
    expect(form.controls.code.errors).toEqual({ code: true });
    form.controls.code.setValue(' HR-1 ');
    expect(form.controls.code.errors).toBeNull();
  });

  it('shows the shared messages once the fields are touched, and does not emit', () => {
    const fixture = setup();
    const component = fixture.componentInstance;
    const emitted = vi.fn();
    component.save.subscribe(emitted);
    component.form.controls.code.setValue('R&D');
    component.onSubmit();
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Department name is required.');
    expect(text).toContain('Department code may only contain letters, numbers, hyphens and underscores.');
    expect(emitted).not.toHaveBeenCalled();
  });
});
