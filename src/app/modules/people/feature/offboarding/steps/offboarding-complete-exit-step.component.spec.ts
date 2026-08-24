import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { OffboardingApiService } from '../../../data-access/offboarding-api.service';
import { OffboardingCompleteExitStepComponent } from './offboarding-complete-exit-step.component';
import { OffboardingWizardStore } from '../../../state/offboarding-wizard.store';

function taskFixture(status: string, isRequired: boolean) {
  return {
    id: 'task-1', taskTitle: 'x', ownerType: 'employee', assignedToId: 'u1', dueDate: '2026-12-01',
    isRequired, isBypassable: false, bypassPenaltyDescription: null, category: null, status, completedAt: null
  };
}

describe('OffboardingCompleteExitStepComponent', () => {
  async function setup(tasks: unknown[]): Promise<ComponentFixture<OffboardingCompleteExitStepComponent>> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [OffboardingCompleteExitStepComponent],
      providers: [
        provideRouter([]),
        { provide: OffboardingApiService, useValue: { listChecklistTasks: () => of(tasks), getOffboarding: () => of(null) } }
      ]
    }).compileComponents();
    const store = TestBed.inject(OffboardingWizardStore);
    await store.loadTasks('emp-1');
    const fixture = TestBed.createComponent(OffboardingCompleteExitStepComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
    return fixture;
  }

  it('disables completion while a required task is still pending', async () => {
    const fixture = await setup([taskFixture('pending', true)]);
    expect(fixture.componentInstance.allRequiredResolved()).toBe(false);
  });

  it('enables completion once all required tasks are completed or bypassed', async () => {
    const fixture = await setup([taskFixture('completed', true), taskFixture('bypassed', true), taskFixture('pending', false)]);
    expect(fixture.componentInstance.allRequiredResolved()).toBe(true);
  });
});
