import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { PermissionService } from '../../../../../core/auth/state/permission.service';
import { OffboardingApiService } from '../../../data-access/offboarding-api.service';
import { OffboardingReviewTasksStepComponent } from './offboarding-review-tasks-step.component';

describe('OffboardingReviewTasksStepComponent', () => {
  let fixture: ComponentFixture<OffboardingReviewTasksStepComponent>;
  let updateSpy: ReturnType<typeof vi.fn>;

  async function setup(canEditEmployees: boolean): Promise<void> {
    updateSpy = vi.fn(() => of(undefined));
    await TestBed.configureTestingModule({
      imports: [OffboardingReviewTasksStepComponent],
      providers: [
        {
          provide: OffboardingApiService,
          useValue: {
            listChecklistTasks: () => of([{
              id: 'task-1', taskTitle: 'Return laptop', ownerType: 'employee', assignedToId: 'user-1', dueDate: '2026-12-01',
              isRequired: true, isBypassable: true, bypassPenaltyDescription: null, category: 'asset_return', status: 'pending', completedAt: null
            }]),
            updateChecklistTask: updateSpy
          }
        },
        { provide: PermissionService, useValue: { hasPermission: (p: string) => canEditEmployees && p === 'employees:write' } }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(OffboardingReviewTasksStepComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function requiredCheckbox(): HTMLInputElement {
    return fixture.nativeElement.querySelector('input.obs-checkbox') as HTMLInputElement;
  }

  describe('with employees:write', () => {
    beforeEach(() => setup(true));

    it('toggling required calls updateTask with the new value', async () => {
      await fixture.componentInstance.toggleRequired('task-1', true, false);
      expect(updateSpy).toHaveBeenCalledWith('emp-1', 'task-1', { assignedToId: 'user-1', dueDate: '2026-12-01', isRequired: false });
    });

    it('does not call updateTask when the value has not changed', async () => {
      await fixture.componentInstance.toggleRequired('task-1', true, true);
      expect(updateSpy).not.toHaveBeenCalled();
    });

    it('leaves the Required checkbox enabled', () => {
      expect(requiredCheckbox().disabled).toBe(false);
    });
  });

  describe('without employees:write', () => {
    beforeEach(() => setup(false));

    it('disables the Required checkbox', () => {
      expect(requiredCheckbox().disabled).toBe(true);
    });

    it('does not call updateTask when toggling required', async () => {
      await fixture.componentInstance.toggleRequired('task-1', true, false);
      expect(updateSpy).not.toHaveBeenCalled();
    });
  });
});
