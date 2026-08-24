import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { OffboardingApiService } from '../../../data-access/offboarding-api.service';
import { OffboardingReviewTasksStepComponent } from './offboarding-review-tasks-step.component';

describe('OffboardingReviewTasksStepComponent', () => {
  let fixture: ComponentFixture<OffboardingReviewTasksStepComponent>;
  let updateSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    updateSpy = vi.fn(() => of(undefined));
    await TestBed.configureTestingModule({
      imports: [OffboardingReviewTasksStepComponent],
      providers: [{
        provide: OffboardingApiService,
        useValue: {
          listChecklistTasks: () => of([{
            id: 'task-1', taskTitle: 'Return laptop', ownerType: 'employee', assignedToId: 'user-1', dueDate: '2026-12-01',
            isRequired: true, isBypassable: true, bypassPenaltyDescription: null, category: 'asset_return', status: 'pending', completedAt: null
          }]),
          updateChecklistTask: updateSpy
        }
      }]
    }).compileComponents();
    fixture = TestBed.createComponent(OffboardingReviewTasksStepComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('toggling required calls updateTask with the new value', async () => {
    await fixture.componentInstance.toggleRequired('task-1', true, false);
    expect(updateSpy).toHaveBeenCalledWith('emp-1', 'task-1', { assignedToId: 'user-1', dueDate: '2026-12-01', isRequired: false });
  });

  it('does not call updateTask when the value has not changed', async () => {
    await fixture.componentInstance.toggleRequired('task-1', true, true);
    expect(updateSpy).not.toHaveBeenCalled();
  });
});
