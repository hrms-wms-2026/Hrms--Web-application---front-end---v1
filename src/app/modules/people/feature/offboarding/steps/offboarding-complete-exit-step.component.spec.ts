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
  const record = {
    id: 'rec-1', employeeId: 'emp-1', reason: 'resignation', lastWorkingDate: '2026-12-01', knowledgeRiskLevel: 'high',
    rehireEligibility: null, notes: null, checklistTemplateId: null, status: 'in_progress',
    createdAt: '2026-10-01T00:00:00Z', updatedAt: null, completedAt: null
  };
  let completeSpy: ReturnType<typeof vi.fn>;

  async function setup(tasks: unknown[]): Promise<ComponentFixture<OffboardingCompleteExitStepComponent>> {
    completeSpy = vi.fn(() => of(undefined));
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [OffboardingCompleteExitStepComponent],
      providers: [
        provideRouter([]),
        { provide: OffboardingApiService, useValue: { listChecklistTasks: () => of(tasks), getOffboarding: () => of(record), completeOffboarding: completeSpy } }
      ]
    }).compileComponents();
    const store = TestBed.inject(OffboardingWizardStore);
    await store.loadOffboarding('emp-1');
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

  it('without a checklist shows the exit details instead of a task readiness card', async () => {
    const fixture = await setup([]);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="task-readiness"]')).toBeNull();
    const summary = el.querySelector('[data-testid="exit-summary"]')?.textContent ?? '';
    expect(summary).toContain('Resignation');
    expect(summary).toContain('2026');
    expect(summary).toContain('Not set');
  });

  it('asks for confirmation before completing the exit', async () => {
    const fixture = await setup([]);
    const el: HTMLElement = fixture.nativeElement;
    el.querySelector<HTMLElement>('[data-testid="complete-exit"] button')!.click();
    fixture.detectChanges();
    expect(completeSpy).not.toHaveBeenCalled();
    expect(fixture.componentInstance.confirmOpen()).toBe(true);
    await fixture.componentInstance.complete();
    expect(completeSpy).toHaveBeenCalledWith('emp-1');
  });
});
