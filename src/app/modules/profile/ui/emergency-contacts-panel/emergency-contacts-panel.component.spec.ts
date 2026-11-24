import { TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { EmergencyContactsPanelComponent } from './emergency-contacts-panel.component';
import { EmergencyContact } from '../../models/profile.model';
import { HttpErrorResponse } from '@angular/common/http';
import { toApiError } from '../../../../core/errors/api-error';

const contacts: EmergencyContact[] = [
  { id: '1', name: 'Jane Doe', relationship: 'spouse', phone: '555-1111', email: null, isPrimary: true }
];

describe('EmergencyContactsPanelComponent', () => {
  it('lists existing emergency contacts', async () => {
    await TestBed.configureTestingModule({ imports: [EmergencyContactsPanelComponent, ReactiveFormsModule] }).compileComponents();
    const fixture = TestBed.createComponent(EmergencyContactsPanelComponent);
    fixture.componentRef.setInput('contacts', contacts);
    fixture.componentRef.setInput('saving', false);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Jane Doe');
  });

  it('emits remove with the contact id when delete is clicked', async () => {
    await TestBed.configureTestingModule({ imports: [EmergencyContactsPanelComponent, ReactiveFormsModule] }).compileComponents();
    const fixture = TestBed.createComponent(EmergencyContactsPanelComponent);
    fixture.componentRef.setInput('contacts', contacts);
    fixture.componentRef.setInput('saving', false);
    fixture.detectChanges();

    let emittedId: string | undefined;
    fixture.componentInstance.remove.subscribe((id: string) => (emittedId = id));
    fixture.componentInstance.onRemove('1');

    expect(emittedId).toBe('1');
  });

  it('marks the first added contact as primary automatically', async () => {
    await TestBed.configureTestingModule({ imports: [EmergencyContactsPanelComponent, ReactiveFormsModule] }).compileComponents();
    const fixture = TestBed.createComponent(EmergencyContactsPanelComponent);
    fixture.componentRef.setInput('contacts', []);
    fixture.componentRef.setInput('saving', false);
    fixture.detectChanges();

    fixture.componentInstance.addForm.setValue({
      name: 'Jane Doe',
      relationship: 'spouse',
      phone: '555-1111',
      email: ''
    });

    let emitted: unknown;
    fixture.componentInstance.add.subscribe((value: unknown) => (emitted = value));
    fixture.componentInstance.onSubmitAdd();

    expect((emitted as { isPrimary: boolean }).isPrimary).toBe(true);
  });

  it('does not expose a primary checkbox in the add form', async () => {
    await TestBed.configureTestingModule({ imports: [EmergencyContactsPanelComponent, ReactiveFormsModule] }).compileComponents();
    const fixture = TestBed.createComponent(EmergencyContactsPanelComponent);
    fixture.componentRef.setInput('contacts', []);
    fixture.componentRef.setInput('saving', false);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('input[type="checkbox"]')).toBeFalsy();
  });

  it('limits the new contact to the backend sizes: name 100, relationship 30, phone 20, email 255', () => {
    const fixture = TestBed.createComponent(EmergencyContactsPanelComponent);
    fixture.componentRef.setInput('contacts', []);
    fixture.componentRef.setInput('saving', false);
    fixture.detectChanges();
    const form = fixture.componentInstance.addForm;
    form.controls.name.setValue('a'.repeat(101));
    form.controls.relationship.setValue('a'.repeat(31));
    form.controls.phone.setValue('1'.repeat(21));
    form.controls.email.setValue('not-an-email');
    expect(form.controls.name.errors).toEqual({ maxlength: { requiredLength: 100, actualLength: 101 } });
    expect(form.controls.relationship.errors).toEqual({ maxlength: { requiredLength: 30, actualLength: 31 } });
    expect(form.controls.phone.errors).toEqual({ maxlength: { requiredLength: 20, actualLength: 21 } });
    expect(form.controls.email.errors).toEqual({ email: true });
    form.controls.name.setValue('   ');
    expect(form.controls.name.errors).toEqual({ required: true });
  });

  describe('server errors (task 20 follow-up)', () => {
    const refused = (status: number, error: unknown) => toApiError(new HttpErrorResponse({ status, error }));

    it('shows the field message of a refused save under its field', () => {
      const fixture = (() => { const f = TestBed.createComponent(EmergencyContactsPanelComponent); f.componentRef.setInput('contacts', []); f.componentRef.setInput('saving', false); f.detectChanges(); return f; })();
      fixture.componentRef.setInput('serverError', refused(400, { errors: { Phone: ['Phone must be 20 characters or fewer.'] } }));
      fixture.detectChanges();
      expect(fixture.componentInstance.addForm.controls.phone.errors?.['server']).toEqual({ message: 'Phone must be 20 characters or fewer.' });
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('Phone must be 20 characters or fewer.');
    });

    it('shows a refusal with no field message in the panel', () => {
      const fixture = (() => { const f = TestBed.createComponent(EmergencyContactsPanelComponent); f.componentRef.setInput('contacts', []); f.componentRef.setInput('saving', false); f.detectChanges(); return f; })();
      fixture.componentRef.setInput('serverError', refused(409, { detail: 'This record was changed by someone else.' }));
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('This record was changed by someone else.');
    });
  });
});
