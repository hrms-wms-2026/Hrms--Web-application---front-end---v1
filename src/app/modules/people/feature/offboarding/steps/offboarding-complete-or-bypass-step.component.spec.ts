import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { OffboardingApiService } from '../../../data-access/offboarding-api.service';
import { OffboardingCompleteOrBypassStepComponent } from './offboarding-complete-or-bypass-step.component';

describe('OffboardingCompleteOrBypassStepComponent', () => {
  let fixture: ComponentFixture<OffboardingCompleteOrBypassStepComponent>;
  let completeSpy: ReturnType<typeof vi.fn>;
  let bypassSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    completeSpy = vi.fn(() => of(undefined));
    bypassSpy = vi.fn(() => of({ bypassRequestId: 'br-1' }));
    await TestBed.configureTestingModule({
      imports: [OffboardingCompleteOrBypassStepComponent],
      providers: [{
        provide: OffboardingApiService,
        useValue: {
          listChecklistTasks: () => of([]),
          completeChecklistTask: completeSpy,
          createBypassRequest: bypassSpy
        }
      }]
    }).compileComponents();
    fixture = TestBed.createComponent(OffboardingCompleteOrBypassStepComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
  });

  it('complete calls completeChecklistTask', async () => {
    await fixture.componentInstance.complete('task-1');
    expect(completeSpy).toHaveBeenCalledWith('emp-1', 'task-1');
  });

  it('submitBypass with a reason and approver calls createBypassRequest and closes the form', async () => {
    fixture.componentInstance.bypassReason.set('Payment processed in advance.');
    fixture.componentInstance.approverId.set('user-2');
    fixture.componentInstance.bypassingTaskId.set('task-1');
    await fixture.componentInstance.submitBypass('task-1');
    expect(bypassSpy).toHaveBeenCalledWith('emp-1', 'task-1', {
      approverId: 'user-2', bypassReason: 'Payment processed in advance.', penaltyDescription: null
    });
    expect(fixture.componentInstance.bypassingTaskId()).toBeNull();
  });

  it('submitBypass without a reason does not call createBypassRequest', async () => {
    fixture.componentInstance.approverId.set('user-2');
    await fixture.componentInstance.submitBypass('task-1');
    expect(bypassSpy).not.toHaveBeenCalled();
  });
});
