import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { WorkApprovalsComponent } from './work-approvals.component';
import { WorkApprovalsStore } from '../../state/work-approvals.store';

describe('WorkApprovalsComponent', () => {
  it('loads all approvals on init', async () => {
    const loadAll = vi.fn().mockResolvedValue(undefined);
    const storeStub = {
      loadAll,
      loading: () => false,
      error: () => null,
      pendingCount: () => 0,
      taskCreationRequests: () => [],
      allocationRequests: () => [],
      objectiveChangeRequests: () => [],
      objectiveInvitations: () => [],
      approve: vi.fn(),
      reject: vi.fn()
    };

    TestBed.configureTestingModule({
      imports: [WorkApprovalsComponent],
      providers: [{ provide: WorkApprovalsStore, useValue: storeStub }]
    });

    const fixture = TestBed.createComponent(WorkApprovalsComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(loadAll).toHaveBeenCalled();
  });
});
