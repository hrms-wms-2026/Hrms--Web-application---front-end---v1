import { TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { EmergencyContactsPanelComponent } from './emergency-contacts-panel.component';
import { EmergencyContact } from '../../models/profile.model';

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
});
