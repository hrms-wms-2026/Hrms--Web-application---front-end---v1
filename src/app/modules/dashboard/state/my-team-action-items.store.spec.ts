import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { MyTeamActionItemsStore } from './my-team-action-items.store';
import { MyTeamActionItemsApiService } from '../data-access/my-team-action-items-api.service';
import { TeamActionItemsResponse } from '../models/my-team-action-items.model';

describe('MyTeamActionItemsStore', () => {
  const sampleResponse: TeamActionItemsResponse = {
    legalEntityId: 'le-1',
    sources: [{
      sourceKey: 'leave.approval', domain: 'people', status: 'ok', pendingCount: 2,
      inProgressCount: null, oldestPendingAt: '2026-09-01T00:00:00Z', topItems: []
    }]
  };

  function setup() {
    const getActionItems = vi.fn().mockReturnValue(of(sampleResponse));
    TestBed.configureTestingModule({
      providers: [MyTeamActionItemsStore, { provide: MyTeamActionItemsApiService, useValue: { getActionItems } }]
    });
    return { store: TestBed.inject(MyTeamActionItemsStore), getActionItems };
  }

  it('starts with no data', () => {
    const { store } = setup();
    expect(store.data()).toBeNull();
  });

  it('load populates data', async () => {
    const { store } = setup();
    await store.load();
    expect(store.data()).toEqual(sampleResponse);
    expect(store.loading()).toBe(false);
  });

  it('load sets an error on failure', async () => {
    const getActionItems = vi.fn().mockReturnValue(throwError(() => ({ error: { detail: 'boom' } })));
    TestBed.configureTestingModule({
      providers: [MyTeamActionItemsStore, { provide: MyTeamActionItemsApiService, useValue: { getActionItems } }]
    });
    const store = TestBed.inject(MyTeamActionItemsStore);
    await store.load();
    expect(store.error()).toBe('boom');
    expect(store.loading()).toBe(false);
  });
});
