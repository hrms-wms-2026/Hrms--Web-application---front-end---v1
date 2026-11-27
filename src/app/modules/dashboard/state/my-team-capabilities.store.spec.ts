import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { MyTeamCapabilitiesStore } from './my-team-capabilities.store';
import { MyTeamCapabilitiesApiService } from '../data-access/my-team-capabilities-api.service';
import { MyTeamCapabilitiesResponse } from '../models/my-team-capabilities.model';

describe('MyTeamCapabilitiesStore', () => {
  const sampleResponse: MyTeamCapabilitiesResponse = {
    isAvailable: true,
    canViewPeopleStatus: true,
    canReviewPeopleApprovals: false,
    canReviewExceptions: false,
    hasWorkApprovals: false,
    leadsWork: false,
    canViewLiveActivity: false, hasReports: false,
    legalEntityId: 'le-1'
  };

  function setup(apiOverrides: Partial<MyTeamCapabilitiesApiService> = {}) {
    const api = {
      getCapabilities: vi.fn().mockReturnValue(of(sampleResponse)),
      ...apiOverrides
    };

    TestBed.configureTestingModule({
      providers: [MyTeamCapabilitiesStore, { provide: MyTeamCapabilitiesApiService, useValue: api }]
    });
    return { store: TestBed.inject(MyTeamCapabilitiesStore), api };
  }

  it('starts with no capabilities loaded', () => {
    const { store } = setup();
    expect(store.capabilities()).toBeNull();
    expect(store.loaded()).toBe(false);
  });

  it('loadCapabilities populates capabilities and sets loaded', async () => {
    const { store } = setup();
    await store.loadCapabilities();
    expect(store.capabilities()).toEqual(sampleResponse);
    expect(store.loading()).toBe(false);
    expect(store.loaded()).toBe(true);
    expect(store.error()).toBeNull();
  });

  it('loadCapabilities sets error and does not mark a failed load as loaded', async () => {
    const { store } = setup({
      getCapabilities: vi.fn().mockReturnValue(throwError(() => ({ error: { detail: 'boom' } })))
    });
    await store.loadCapabilities();
    expect(store.capabilities()).toBeNull();
    expect(store.error()).toBe('boom');
    expect(store.loaded()).toBe(false);
    expect(store.loading()).toBe(false);
  });

  it('ensureLoaded retries after a failed load instead of caching the failure', async () => {
    const getCapabilities = vi
      .fn()
      .mockReturnValueOnce(throwError(() => ({ error: { detail: 'boom' } })))
      .mockReturnValueOnce(of(sampleResponse));
    const { store } = setup({ getCapabilities });

    await store.ensureLoaded();
    expect(store.capabilities()).toBeNull();

    await store.ensureLoaded();
    expect(getCapabilities).toHaveBeenCalledTimes(2);
    expect(store.capabilities()).toEqual(sampleResponse);
    expect(store.loaded()).toBe(true);
    expect(store.error()).toBeNull();
  });

  it('ensureLoaded fetches only once even when called repeatedly', async () => {
    const { store, api } = setup();
    await store.ensureLoaded();
    await store.ensureLoaded();
    await store.ensureLoaded();
    expect(api.getCapabilities).toHaveBeenCalledTimes(1);
  });

  it('ensureLoaded does nothing after loadCapabilities already ran', async () => {
    const { store, api } = setup();
    await store.loadCapabilities();
    await store.ensureLoaded();
    expect(api.getCapabilities).toHaveBeenCalledTimes(1);
  });

  it('refresh always refetches regardless of prior load state', async () => {
    const { store, api } = setup();
    await store.loadCapabilities();
    await store.refresh();
    expect(api.getCapabilities).toHaveBeenCalledTimes(2);
  });
});
