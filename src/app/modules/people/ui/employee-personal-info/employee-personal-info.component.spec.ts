import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EmployeePersonalInfoComponent } from './employee-personal-info.component';
import { EmployeeDetailPersonalInformation } from '../../models/employee.model';

describe('EmployeePersonalInfoComponent', () => {
  let fixture: ComponentFixture<EmployeePersonalInfoComponent>;

  const personalInfo: EmployeeDetailPersonalInformation = {
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@test.dev',
    phone: '+1-555-0100',
    dateOfBirth: '1990-01-01',
    gender: 'female',
    nationalityId: 'nat-1',
    addresses: [
      { id: 'addr-1', addressType: 'Home', addressJson: '{"line1":"123 Main St","city":"Springfield"}', isPrimary: true }
    ]
  };

  async function setup(info: EmployeeDetailPersonalInformation) {
    await TestBed.configureTestingModule({ imports: [EmployeePersonalInfoComponent] }).compileComponents();
    fixture = TestBed.createComponent(EmployeePersonalInfoComponent);
    fixture.componentRef.setInput('personalInformation', info);
    fixture.detectChanges();
  }

  it('renders the name, email, and phone', async () => {
    await setup(personalInfo);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Ada');
    expect(text).toContain('Lovelace');
    expect(text).toContain('ada@test.dev');
    expect(text).toContain('+1-555-0100');
  });

  it('renders the addresses list including the address type', async () => {
    await setup(personalInfo);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Home');
    expect(text).toContain('123 Main St');
  });

  it('shows a fallback for missing optional fields', async () => {
    await setup({ ...personalInfo, phone: null, dateOfBirth: null, gender: null, addresses: [] });
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('—');
  });
});
