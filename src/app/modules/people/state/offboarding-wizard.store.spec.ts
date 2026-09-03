import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { OffboardingApiService } from '../data-access/offboarding-api.service';
import { OffboardingWizardStore } from './offboarding-wizard.store';

describe('OffboardingWizardStore', () => {
  let store: InstanceType<typeof OffboardingWizardStore>;
  let apiStub: Partial<OffboardingApiService>;

  function setup(overrides: Partial<OffboardingApiService> = {}): void {
    apiStub = { getOffboarding: () => of(null), ...overrides };
    TestBed.configureTestingModule({ providers: [{ provide: OffboardingApiService, useValue: apiStub }] });
    store = TestBed.inject(OffboardingWizardStore);
  }

  it('loadOffboarding with no existing record leaves step at start', async () => {
    setup({ getOffboarding: () => of(null) });
    await store.loadOffboarding('emp-1');
    expect(store.record()).toBeNull();
    expect(store.step()).toBe('start');
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

  it('startOffboarding failure surfaces an error and does not advance the step', async () => {
    setup({ startOffboarding: () => throwError(() => new Error('boom')), getOffboarding: () => of(null) });
    const result = await store.startOffboarding('emp-1', {
      reason: 'resignation', lastWorkingDate: '2026-12-01', knowledgeRiskLevel: 'medium', rehireEligibility: null, notes: null
    });
    expect(result).toBe(false);
    expect(store.step()).toBe('start');
  });
});
