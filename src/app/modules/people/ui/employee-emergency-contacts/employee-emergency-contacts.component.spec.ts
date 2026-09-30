import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EmployeeEmergencyContactsComponent } from './employee-emergency-contacts.component';
import { EmployeeDetailEmergencyContact } from '../../models/employee.model';

describe('EmployeeEmergencyContactsComponent', () => {
  let fixture: ComponentFixture<EmployeeEmergencyContactsComponent>;

  const contact: EmployeeDetailEmergencyContact = {
    id: 'ec-1',
    name: 'Grace Hopper',
    relationship: 'Spouse',
    phone: '+1-555-0199',
    email: 'grace@test.dev',
    isPrimary: true
  };

  async function setup(contacts: readonly EmployeeDetailEmergencyContact[]) {
    await TestBed.configureTestingModule({ imports: [EmployeeEmergencyContactsComponent] }).compileComponents();
    fixture = TestBed.createComponent(EmployeeEmergencyContactsComponent);
    fixture.componentRef.setInput('emergencyContacts', contacts);
    fixture.detectChanges();
  }

  it('renders the empty state when there are no emergency contacts', async () => {
    await setup([]);
    expect(fixture.nativeElement.textContent).toContain('No emergency contact information available.');
  });

  it('renders contact details', async () => {
    await setup([contact]);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Grace Hopper');
    expect(text).toContain('Spouse');
    expect(text).toContain('+1-555-0199');
    expect(text).toContain('grace@test.dev');
  });

  it('shows a fallback when the contact has no email', async () => {
    await setup([{ ...contact, email: null }]);
    expect(fixture.nativeElement.textContent).toContain('—');
  });
});
