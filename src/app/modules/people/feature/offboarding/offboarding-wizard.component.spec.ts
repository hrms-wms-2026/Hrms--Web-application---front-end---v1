import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { OffboardingApiService } from '../../data-access/offboarding-api.service';
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
        { provide: OffboardingApiService, useValue: { getOffboarding: () => of(null) } }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(OffboardingWizardComponent);
    fixture.detectChanges();
  });

  it('renders the Start Offboarding step first when no record exists', () => {
    expect(fixture.componentInstance.store.step()).toBe('start');
    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('app-offboarding-start-step')).not.toBeNull();
  });
});
