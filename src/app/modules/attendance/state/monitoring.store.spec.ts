import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MonitoringApiService } from '../data-access/monitoring-api.service';
import {
  MonitoringFeatureToggles,
  MonitoringFeatureTogglesRequest,
  MonitoringPolicyConfiguration,
  MonitoringPolicyOverride,
  MonitoringPolicyOverrideRequest
} from '../models/monitoring.model';
import { MonitoringStore } from './monitoring.store';

const companyDefault: MonitoringFeatureToggles = {
  activityMonitoring: true,
  applicationTracking: true,
  documentTracking: false,
  communicationTracking: false,
  screenshotCapture: true,
  autoScreenshotCapture: false,
  meetingDetection: false,
  deviceTracking: true,
  workLocationVerification: true,
  identityVerification: false,
  biometric: false,
  idleThresholdMinutes: 15,
  allowedRadiusMeters: 100,
  updatedAt: '2026-08-20T00:00:00.000Z'
};

const companyRequest: MonitoringFeatureTogglesRequest = {
  activityMonitoring: true,
  applicationTracking: true,
  documentTracking: false,
  communicationTracking: false,
  screenshotCapture: true,
  autoScreenshotCapture: false,
  meetingDetection: false,
  deviceTracking: true,
  workLocationVerification: true,
  identityVerification: false,
  biometric: false,
  idleThresholdMinutes: 15,
  allowedRadiusMeters: 100
};

function makeOverride(scopeType: MonitoringPolicyOverride['scopeType'], id: string, scopeId: string, targetName: string): MonitoringPolicyOverride {
  return {
    id,
    scopeType,
    scopeId,
    targetName,
    activityMonitoring: null,
    applicationTracking: null,
    documentTracking: null,
    communicationTracking: null,
    screenshotCapture: true,
    autoScreenshotCapture: null,
    meetingDetection: null,
    deviceTracking: null,
    workLocationVerification: null,
    identityVerification: null,
    biometric: null,
    idleThresholdMinutes: null,
    allowedRadiusMeters: null,
    overrideReason: 'Because reasons',
    updatedAt: '2026-08-21T00:00:00.000Z'
  };
}

const overrideRequest: MonitoringPolicyOverrideRequest = {
  activityMonitoring: null,
  applicationTracking: null,
  documentTracking: null,
  communicationTracking: null,
  screenshotCapture: true,
  autoScreenshotCapture: null,
  meetingDetection: null,
  deviceTracking: null,
  workLocationVerification: null,
  identityVerification: null,
  biometric: null,
  idleThresholdMinutes: null,
  allowedRadiusMeters: null,
  overrideReason: 'Because reasons'
};

const policy: MonitoringPolicyConfiguration = {
  companyDefault,
  overrides: [makeOverride('department', 'ov-dept-1', 'dept-1', 'Engineering')],
  hasActiveCompanyContext: true
};

describe('MonitoringStore', () => {
  let api: {
    getPolicy: ReturnType<typeof vi.fn>;
    updateCompany: ReturnType<typeof vi.fn>;
    upsertOverride: ReturnType<typeof vi.fn>;
    deleteOverride: ReturnType<typeof vi.fn>;
  };
  let store: InstanceType<typeof MonitoringStore>;

  beforeEach(() => {
    api = {
      getPolicy: vi.fn(() => of(policy)),
      updateCompany: vi.fn(() => of({})),
      upsertOverride: vi.fn(() => of(makeOverride('department', 'ov-dept-1', 'dept-1', 'Engineering'))),
      deleteOverride: vi.fn(() => of(undefined))
    };

    TestBed.configureTestingModule({
      providers: [MonitoringStore, { provide: MonitoringApiService, useValue: api }]
    });
    store = TestBed.inject(MonitoringStore);
  });

  afterEach(() => TestBed.resetTestingModule());

  it('has the expected initial state', () => {
    expect(store.loading()).toBe(false);
    expect(store.saving()).toBe(false);
    expect(store.error()).toBeNull();
    expect(store.saveError()).toBeNull();
    expect(store.companyDefault()).toBeNull();
    expect(store.overrides()).toEqual([]);
    expect(store.hasActiveCompanyContext()).toBe(true);
    expect(store.selectedScope()).toBe('department');
  });

  it('load() populates companyDefault, overrides, and hasActiveCompanyContext from the API', async () => {
    await store.load();

    expect(api.getPolicy).toHaveBeenCalledOnce();
    expect(store.companyDefault()).toEqual(companyDefault);
    expect(store.overrides()).toEqual(policy.overrides);
    expect(store.hasActiveCompanyContext()).toBe(true);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('load() reflects hasActiveCompanyContext=false when the caller has no active company', async () => {
    api.getPolicy.mockReturnValueOnce(of({ ...policy, overrides: [], hasActiveCompanyContext: false }));

    await store.load();

    expect(store.hasActiveCompanyContext()).toBe(false);
    expect(store.overrides()).toEqual([]);
    expect(store.companyDefault()).toEqual(companyDefault);
  });

  it('load() sets a sanitized error and does not populate state on failure', async () => {
    api.getPolicy.mockReturnValueOnce(throwError(() => new Error('System.Exception: Unexpected error at Foo.Bar()')));

    await store.load();

    expect(store.loading()).toBe(false);
    expect(store.error()).toBe('Could not load monitoring configuration. Try again.');
    expect(store.error()).not.toContain('System.Exception');
    expect(store.companyDefault()).toBeNull();
  });

  it('does not issue a second HTTP call when load() is invoked again while already in flight', async () => {
    const pending = new Subject<MonitoringPolicyConfiguration>();
    api.getPolicy.mockReturnValueOnce(pending);

    const first = store.load();
    const second = store.load();

    expect(api.getPolicy).toHaveBeenCalledOnce();
    expect(store.loading()).toBe(true);

    pending.next(policy);
    pending.complete();
    await first;
    await second;

    expect(store.loading()).toBe(false);
    expect(api.getPolicy).toHaveBeenCalledOnce();
  });

  it('an idle re-render (reading unrelated signals repeatedly) does not refire the fetch', async () => {
    await store.load();
    expect(api.getPolicy).toHaveBeenCalledOnce();

    // Simulate repeated reads/toggles of unrelated signals, as a component re-render would do.
    for (let i = 0; i < 25; i++) {
      store.selectedScope();
      store.saving();
      store.selectScope(i % 2 === 0 ? 'department' : 'position');
    }

    expect(api.getPolicy).toHaveBeenCalledOnce();
  });

  it('saveCompany() calls updateCompany with exactly the backend-supported fields (no id, no tenant id, no updatedAt)', async () => {
    await store.saveCompany(companyRequest);

    expect(api.updateCompany).toHaveBeenCalledWith(companyRequest);
    const sentPayload = api.updateCompany.mock.calls[0][0];
    expect(Object.keys(sentPayload).sort()).toEqual(
      [
        'activityMonitoring',
        'allowedRadiusMeters',
        'applicationTracking',
        'autoScreenshotCapture',
        'biometric',
        'communicationTracking',
        'deviceTracking',
        'documentTracking',
        'identityVerification',
        'idleThresholdMinutes',
        'meetingDetection',
        'screenshotCapture',
        'workLocationVerification'
      ].sort()
    );
    expect(sentPayload).not.toHaveProperty('updatedAt');
    expect(sentPayload).not.toHaveProperty('id');
    expect(sentPayload).not.toHaveProperty('legalEntityId');
    expect(sentPayload).not.toHaveProperty('tenantId');
  });

  it('saveCompany() reloads the policy and clears saving/saveError on success', async () => {
    const result = await store.saveCompany(companyRequest);

    expect(result).toBe(true);
    expect(api.getPolicy).toHaveBeenCalledOnce();
    expect(store.saving()).toBe(false);
    expect(store.saveError()).toBeNull();
  });

  it('saveCompany() surfaces a sanitized saveError and returns false on failure', async () => {
    api.updateCompany.mockReturnValueOnce(throwError(() => new Error('raw_backend_code')));

    const result = await store.saveCompany(companyRequest);

    expect(result).toBe(false);
    expect(store.saving()).toBe(false);
    expect(store.saveError()).toBe('Could not save monitoring defaults. Try again.');
  });

  it('does not issue a second save call when saveCompany() is invoked again while already saving', async () => {
    const pending = new Subject<unknown>();
    api.updateCompany.mockReturnValueOnce(pending);

    const first = store.saveCompany(companyRequest);
    const second = store.saveCompany(companyRequest);

    expect(api.updateCompany).toHaveBeenCalledOnce();

    pending.next({});
    pending.complete();
    expect(await second).toBe(false);
    expect(await first).toBe(true);
  });

  it('saveCompany includes allowedRadiusMeters in the request payload', async () => {
    await store.saveCompany({ ...companyRequest, allowedRadiusMeters: 200 });

    expect(api.updateCompany).toHaveBeenCalledWith(expect.objectContaining({ allowedRadiusMeters: 200 }));
  });

  describe.each([
    ['department', 'dept-1', 'Engineering'],
    ['position', 'pos-1', 'Software Engineer'],
    ['role', 'role-1', 'Manager']
  ] as const)('overrides for scope=%s', (scopeType, targetId, targetName) => {
    it('creates/edits an override via saveOverride with exactly the request payload', async () => {
      api.upsertOverride.mockReturnValueOnce(of(makeOverride(scopeType, `ov-${targetId}`, targetId, targetName)));

      const result = await store.saveOverride(scopeType, targetId, overrideRequest);

      expect(result).toBe(true);
      expect(api.upsertOverride).toHaveBeenCalledWith(scopeType, targetId, overrideRequest);
      expect(api.getPolicy).toHaveBeenCalledOnce();
      expect(store.saving()).toBe(false);
      expect(store.saveError()).toBeNull();
    });

    it('surfaces a sanitized error when saveOverride fails', async () => {
      api.upsertOverride.mockReturnValueOnce(throwError(() => new Error('System.Exception: Unexpected error at Foo.Bar()')));

      const result = await store.saveOverride(scopeType, targetId, overrideRequest);

      expect(result).toBe(false);
      expect(store.saveError()).toBe('Could not save this monitoring override. Try again.');
      expect(store.saveError()).not.toContain('System.Exception');
    });

    it('removes an override via removeOverride and reloads the policy', async () => {
      const result = await store.removeOverride(scopeType, targetId);

      expect(result).toBe(true);
      expect(api.deleteOverride).toHaveBeenCalledWith(scopeType, targetId);
      expect(api.getPolicy).toHaveBeenCalledOnce();
      expect(store.saving()).toBe(false);
    });

    it('surfaces a sanitized error when removeOverride fails', async () => {
      api.deleteOverride.mockReturnValueOnce(throwError(() => new Error('System.Exception: Unexpected error at Foo.Bar()')));

      const result = await store.removeOverride(scopeType, targetId);

      expect(result).toBe(false);
      expect(store.saveError()).toBe('Could not remove this monitoring override. Try again.');
      expect(store.saveError()).not.toContain('System.Exception');
    });
  });

  it('clearErrors() resets both error and saveError', async () => {
    api.getPolicy.mockReturnValueOnce(throwError(() => new Error('System.Exception: Unexpected error at Foo.Bar()')));
    await store.load();
    expect(store.error()).not.toBeNull();

    store.clearErrors();

    expect(store.error()).toBeNull();
    expect(store.saveError()).toBeNull();
  });

  it('selectScope() updates selectedScope without triggering an API call', () => {
    store.selectScope('role');
    expect(store.selectedScope()).toBe('role');
    expect(api.getPolicy).not.toHaveBeenCalled();
  });

  it('selectScope accepts work_mode as a valid MonitoringScopeType', () => {
    store.selectScope('work_mode');
    expect(store.selectedScope()).toBe('work_mode');
  });
});
