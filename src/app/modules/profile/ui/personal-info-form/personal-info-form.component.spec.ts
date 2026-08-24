import { TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { PersonalInfoFormComponent } from './personal-info-form.component';
import { PersonalInformation } from '../../models/profile.model';

const samplePersonalInfo: PersonalInformation = {
  firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', phone: '555-1111',
  dateOfBirth: null, gender: null, nationalityId: null, countryName: null,
  displayTimezone: null, legalEntityTimezone: 'Asia/Colombo', avatarUrl: null, addresses: [], version: '1'
};

describe('PersonalInfoFormComponent', () => {
  it('pre-fills the form from the personalInformation input', async () => {
    await TestBed.configureTestingModule({ imports: [PersonalInfoFormComponent, ReactiveFormsModule] }).compileComponents();
    const fixture = TestBed.createComponent(PersonalInfoFormComponent);
    fixture.componentRef.setInput('personalInformation', samplePersonalInfo);
    fixture.componentRef.setInput('saving', false);
    fixture.detectChanges();

    expect(fixture.componentInstance.form.value.firstName).toBe('Jane');
    expect(fixture.componentInstance.form.value.displayTimezone).toBe('Asia/Colombo');
  });

  it('emits save with the form value and current version when submitted', async () => {
    await TestBed.configureTestingModule({ imports: [PersonalInfoFormComponent, ReactiveFormsModule] }).compileComponents();
    const fixture = TestBed.createComponent(PersonalInfoFormComponent);
    fixture.componentRef.setInput('personalInformation', samplePersonalInfo);
    fixture.componentRef.setInput('saving', false);
    fixture.detectChanges();

    let emitted: unknown;
    fixture.componentInstance.save.subscribe((v: unknown) => (emitted = v));
    fixture.componentInstance.onSubmit();

    expect((emitted as { version: string }).version).toBe('1');
    expect((emitted as { displayTimezone: string | null }).displayTimezone).toBeNull();
  });

  it('emits a personal timezone override when different from the company default', async () => {
    await TestBed.configureTestingModule({ imports: [PersonalInfoFormComponent, ReactiveFormsModule] }).compileComponents();
    const fixture = TestBed.createComponent(PersonalInfoFormComponent);
    fixture.componentRef.setInput('personalInformation', samplePersonalInfo);
    fixture.componentRef.setInput('saving', false);
    fixture.detectChanges();

    fixture.componentInstance.form.controls.displayTimezone.setValue('Europe/London');

    let emitted: unknown;
    fixture.componentInstance.save.subscribe((v: unknown) => (emitted = v));
    fixture.componentInstance.onSubmit();

    expect((emitted as { displayTimezone: string | null }).displayTimezone).toBe('Europe/London');
  });
});
