import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OffboardingApiService } from '../../../data-access/offboarding-api.service';
import { OffboardingStartStepComponent } from './offboarding-start-step.component';
import { of } from 'rxjs';

describe('OffboardingStartStepComponent', () => {
  let fixture: ComponentFixture<OffboardingStartStepComponent>;
  let startOffboardingSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    startOffboardingSpy = vi.fn(() => of({ offboardingRecordId: 'rec-1' }));
    await TestBed.configureTestingModule({
      imports: [OffboardingStartStepComponent],
      providers: [
        { provide: OffboardingApiService, useValue: { startOffboarding: startOffboardingSpy, getOffboarding: () => of(null) } }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(OffboardingStartStepComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
  });

  it('does not submit when the form is invalid', async () => {
    fixture.componentInstance.form.controls.lastWorkingDate.setValue('');
    await fixture.componentInstance.submit();
    expect(startOffboardingSpy).not.toHaveBeenCalled();
  });

  it('submits the form values on valid submit', async () => {
    fixture.componentInstance.form.patchValue({ lastWorkingDate: '2026-12-01' });
    await fixture.componentInstance.submit();
    expect(startOffboardingSpy).toHaveBeenCalledWith('emp-1', expect.objectContaining({ lastWorkingDate: '2026-12-01', reason: 'resignation' }));
  });
});
