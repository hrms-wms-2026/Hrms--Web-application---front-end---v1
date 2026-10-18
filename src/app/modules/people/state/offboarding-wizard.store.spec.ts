import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { OffboardingApiService } from '../data-access/offboarding-api.service';
import { OffboardingWizardStore, offboardingStepsFor } from './offboarding-wizard.store';

describe('OffboardingWizardStore', () => {
  let store: InstanceType<typeof OffboardingWizardStore>;
  let apiStub: Partial<OffboardingApiService>;

  function setup(overrides: Partial<OffboardingApiService> = {}): void {
    apiStub = { getOffboarding: () => of(null), ...overrides };
    TestBed.configureTestingModule({ providers: [{ provide: OffboardingApiService, useValue: apiStub }] });
    store = TestBed.inject(OffboardingWizardStore);
  }

  it('loadOffboarding with no existing record leaves the record empty', async () => {
    setup({ getOffboarding: () => of(null) });
    await store.loadOffboarding('emp-1');
    expect(store.record()).toBeNull();
  });

  it('loadOffboarding with an initiated record advances to choose_checklist', async () => {
    setup({
      getOffboarding: () => of({
        id: 'rec-1', employeeId: 'emp-1', reason: 'resignation', lastWorkingDate: '2026-12-01',
        knowledgeRiskLevel: 'medium', rehireEligibility: null, notes: null, checklistTemplateId: null,
        status: 'initiated', createdAt: '2026-08-17T00:00:00Z', updatedAt: null, completedAt: null
      })
    });
    await store.loadOffboarding('emp-1');
    expect(store.step()).toBe('choose_checklist');
  });

  const record = (overrides: Record<string, unknown>) => ({
    id: 'rec-1', employeeId: 'emp-1', reason: 'resignation' as const, lastWorkingDate: '2026-12-01',
    knowledgeRiskLevel: 'medium' as const, rehireEligibility: null, notes: null, checklistTemplateId: null as string | null,
    status: 'in_progress' as const, createdAt: '2026-08-17T00:00:00Z', updatedAt: null, completedAt: null,
    ...overrides
  });

  it('without a checklist, skips Review Tasks and Complete or Bypass Tasks', async () => {
    setup({ getOffboarding: () => of(record({ checklistTemplateId: null })), listChecklistTasks: () => of([]) });
    await store.loadOffboarding('emp-1');
    expect(store.step()).toBe('track_exit_work');
    store.goToStep('complete_or_bypass');
    expect(store.step()).toBe('complete_exit');
    expect(offboardingStepsFor(store.record())).toEqual(['choose_checklist', 'track_exit_work', 'complete_exit']);
  });

  it('with a checklist, keeps every step', async () => {
    setup({ getOffboarding: () => of(record({ checklistTemplateId: 'tpl-1' })), listChecklistTasks: () => of([]) });
    await store.loadOffboarding('emp-1');
    expect(store.step()).toBe('review_tasks');
    store.goToStep('complete_or_bypass');
    expect(store.step()).toBe('complete_or_bypass');
    expect(offboardingStepsFor(store.record())).toHaveLength(5);
  });

  it('startOffboarding failure surfaces an error and does not advance the step', async () => {
    setup({ startOffboarding: () => throwError(() => new Error('boom')), getOffboarding: () => of(null) });
    const result = await store.startOffboarding('emp-1', {
      reason: 'resignation', lastWorkingDate: '2026-12-01', knowledgeRiskLevel: 'medium', rehireEligibility: null, notes: null
    });
    expect(result).toBe(false);
    expect(store.record()).toBeNull();
  });
});
