import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { OffboardingApiService } from '../../data-access/offboarding-api.service';
import { PeopleApiService } from '../../data-access/people-api.service';
import { OffboardingWizardComponent } from './offboarding-wizard.component';

describe('OffboardingWizardComponent', () => {
  let fixture: ComponentFixture<OffboardingWizardComponent>;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [OffboardingWizardComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'emp-1' } } } },
        { provide: OffboardingApiService, useValue: { getOffboarding: () => of(null) } },
        { provide: PeopleApiService, useValue: { getEmployeeIdentity: () => of({ id: 'emp-1', name: 'Ada Lovelace', avatarFileId: null }) } }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(OffboardingWizardComponent);
    fixture.detectChanges();
  });

  it('with no open offboarding, shows no step form and offers the Start Offboarding popup instead', async () => {
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('.ow-step-flow')).toBeNull();
    expect(compiled.textContent).toContain("This employee isn't being offboarded");
    expect(compiled.querySelector('[role="dialog"]')).toBeNull();
    compiled.querySelector<HTMLElement>('[data-testid="wizard-start-offboarding"] button')?.click();
    fixture.detectChanges();
    expect(compiled.querySelector('[role="dialog"]')?.textContent).toContain('Start offboarding');
    // The employee is fixed by the route, so the popup has no employee picker.
    expect(compiled.querySelector('[role="dialog"]')?.textContent).not.toContain('Employee *');
  });

  it('does not list Start Offboarding as a wizard step', () => {
    expect(fixture.componentInstance.stepOrder()[0]).toBe('choose_checklist');
  });

  it('breadcrumb reads Offboarding > employee name', async () => {
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.componentInstance.employeeName()).toBe('Ada Lovelace');
    expect((fixture.nativeElement as HTMLElement).querySelector('app-breadcrumb-header')?.textContent).toContain('Offboarding');
  });
});
