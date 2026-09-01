import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { DepartmentStore } from '../../../organization/state/department.store';
import { LegalEntityStore } from '../../../organization/state/legal-entity.store';
import { PositionStore } from '../../../organization/state/position.store';
import { RoleStore } from '../../../organization/state/role.store';
import { MonitoringStore } from '../../state/monitoring.store';
import {
  MonitoringFeatureToggles,
  MonitoringFeatureTogglesRequest,
  MonitoringPolicyOverride,
  MonitoringPolicyOverrideRequest,
  MonitoringScopeType
} from '../../models/monitoring.model';
import { MonitoringComponent } from './monitoring.component';

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
  updatedAt: '2026-08-20T00:00:00.000Z'
};

const override: MonitoringPolicyOverride = {
  id: 'ov-1',
  scopeType: 'department',
  scopeId: 'dept-1',
  targetName: 'Engineering',
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
  overrideReason: 'Because reasons',
  updatedAt: '2026-08-21T00:00:00.000Z'
};

describe('MonitoringComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  interface Options {
    canRead?: boolean;
    canConfigure?: boolean;
    overrides?: readonly MonitoringPolicyOverride[];
    hasActiveCompanyContext?: boolean;
    saveCompanyResult?: boolean;
    saveErrorMessage?: string | null;
  }

  async function setup(options: Options = {}) {
    const {
      canRead = true,
      canConfigure = true,
      overrides = [override],
      hasActiveCompanyContext = true,
      saveCompanyResult = true,
      saveErrorMessage = null
    } = options;

    const monitoringStore = {
      loading: signal(false),
      saving: signal(false),
      error: signal<string | null>(null),
      saveError: signal<string | null>(saveErrorMessage),
      companyDefault: signal<MonitoringFeatureToggles | null>(companyDefault),
      overrides: signal<readonly MonitoringPolicyOverride[]>(overrides),
      hasActiveCompanyContext: signal(hasActiveCompanyContext),
      selectedScope: signal<MonitoringScopeType>('department'),
      selectScope: vi.fn((_scope: MonitoringScopeType) => undefined),
      load: vi.fn(() => Promise.resolve()),
      saveCompany: vi.fn((_payload: MonitoringFeatureTogglesRequest) => Promise.resolve(saveCompanyResult)),
      saveOverride: vi.fn((_scope: MonitoringScopeType, _targetId: string, _payload: MonitoringPolicyOverrideRequest) => Promise.resolve(true)),
      removeOverride: vi.fn((_scope: MonitoringScopeType, _targetId: string) => Promise.resolve(true)),
      clearErrors: vi.fn()
    };

    const permissions = {
      hasModule: vi.fn((module: string) => module === 'time_attendance'),
      hasPermission: vi.fn((permission: string) => {
        if (permission === 'monitoring:read') return canRead;
        if (permission === 'monitoring:configure') return canConfigure;
        return false;
      }),
      hasAnyModule: vi.fn(() => true),
      hasAnyPermission: vi.fn(() => true)
    };

    const notifications = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };

    const legalEntityStore = {
      loaded: signal(true),
      selectedLegalEntity: signal<{ id: string; name: string } | null>(null),
      loadCompanies: vi.fn(() => Promise.resolve())
    };
    const departmentStore = { allFlatList: signal([]), load: vi.fn(() => Promise.resolve()) };
    const positionStore = { allPositionsList: signal([]), load: vi.fn(() => Promise.resolve()) };
    const roleStore = { roles: signal([]), loadRolesOnly: vi.fn(() => Promise.resolve()) };

    await TestBed.configureTestingModule({
      imports: [MonitoringComponent],
      providers: [
        { provide: MonitoringStore, useValue: monitoringStore },
        { provide: PermissionService, useValue: permissions },
        { provide: NotificationService, useValue: notifications },
        { provide: LegalEntityStore, useValue: legalEntityStore },
        { provide: DepartmentStore, useValue: departmentStore },
        { provide: PositionStore, useValue: positionStore },
        { provide: RoleStore, useValue: roleStore }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(MonitoringComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    return {
      fixture,
      component: fixture.componentInstance,
      monitoringStore,
      permissions,
      notifications,
      legalEntityStore,
      departmentStore,
      positionStore
    };
  }

  it('renders the exact user-facing company-default toggle labels', async () => {
    const { fixture } = await setup();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Location tracking');
    expect(text).toContain('Keyboard and mouse activity');
    expect(text).toContain('Application usage');
    expect(text).toContain('Screenshot capture');
  });

  it('never renders raw backend/enum/machine terms anywhere in the page', async () => {
    const { fixture } = await setup();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    for (const forbidden of ['monitoring_policy', 'policy_json', 'source_rule', 'ActivityMonitoring', 'ApplicationTracking', 'tenant-1', 'entity-1']) {
      expect(text).not.toContain(forbidden);
    }
  });

  it('enables toggle inputs and shows the save/add-override actions for a user with monitoring:configure', async () => {
    const { fixture } = await setup({ canConfigure: true });
    const el = fixture.nativeElement as HTMLElement;

    const checkboxes = Array.from(el.querySelectorAll('input[type="checkbox"]')) as HTMLInputElement[];
    expect(checkboxes.length).toBeGreaterThan(0);
    checkboxes.forEach((cb) => expect(cb.disabled).toBe(false));

    const buttons = Array.from(el.querySelectorAll('button')).map((b) => b.textContent?.trim());
    expect(buttons).toContain('Save defaults');
  });

  it('disables toggle inputs and hides the save/add-override actions for a user without monitoring:configure', async () => {
    const { fixture } = await setup({ canConfigure: false });
    const el = fixture.nativeElement as HTMLElement;

    const checkboxes = Array.from(el.querySelectorAll('input[type="checkbox"]')) as HTMLInputElement[];
    expect(checkboxes.length).toBeGreaterThan(0);
    checkboxes.forEach((cb) => expect(cb.disabled).toBe(true));

    const buttons = Array.from(el.querySelectorAll('button')).map((b) => b.textContent?.trim());
    expect(buttons).not.toContain('Save defaults');
    expect(buttons).not.toContain('Add override');
  });

  it('shows a read-only notice and no configuration content for a user without monitoring:read', async () => {
    const { fixture, monitoringStore } = await setup({ canRead: false });
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('You do not have access to view monitoring configuration.');
    expect(el.querySelector('input[type="checkbox"]')).toBeNull();
    expect(monitoringStore.load).not.toHaveBeenCalled();
  });

  it('does not show a raw/technical error string when saving the company default fails', async () => {
    const { fixture, component, monitoringStore, notifications } = await setup({
      saveCompanyResult: false,
      saveErrorMessage: 'Could not save monitoring defaults. Try again.'
    });

    await component.saveCompany();
    fixture.detectChanges();

    expect(monitoringStore.saveCompany).toHaveBeenCalled();
    expect(notifications.error).toHaveBeenCalledWith('Could not save monitoring defaults. Try again.');

    const rawTechnicalFragments = ['System.Exception', 'StackTrace', 'at Foo.Bar', '500', 'NullReferenceException'];
    const errorCallArg = notifications.error.mock.calls[0][0] as string;
    for (const fragment of rawTechnicalFragments) {
      expect(errorCallArg).not.toContain(fragment);
    }
  });

  it('sends only the fields the backend accepts when saving the company default (no id, no updatedAt)', async () => {
    const { component, monitoringStore } = await setup();

    await component.saveCompany();

    expect(monitoringStore.saveCompany).toHaveBeenCalledOnce();
    const payload = monitoringStore.saveCompany.mock.calls[0][0];
    expect(payload).not.toHaveProperty('updatedAt');
    expect(payload).not.toHaveProperty('id');
    expect(payload).not.toHaveProperty('legalEntityId');
    expect(payload).not.toHaveProperty('tenantId');
  });

  it('loads the policy for the current company on mount for a user with monitoring:read', async () => {
    const { monitoringStore } = await setup();

    expect(monitoringStore.load).toHaveBeenCalled();
  });

  it('reloads the policy and this company\'s department/position lists when the selected company changes', async () => {
    const { fixture, monitoringStore, legalEntityStore, departmentStore, positionStore } = await setup();
    monitoringStore.load.mockClear();
    departmentStore.load.mockClear();
    positionStore.load.mockClear();

    legalEntityStore.selectedLegalEntity.set({ id: 'company-b', name: 'Company B' });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(monitoringStore.load).toHaveBeenCalled();
    expect(departmentStore.load).toHaveBeenCalledWith('company-b');
    expect(positionStore.load).toHaveBeenCalledWith('company-b');
  });

  it('shows a friendly prompt instead of the override editor/list when there is no active company context', async () => {
    const { fixture } = await setup({ hasActiveCompanyContext: false });
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Select a company to configure monitoring.');
    expect(el.querySelector('[aria-label="Monitoring override scope"]')).toBeNull();
  });

  it('shows the override editor/list when there is an active company context', async () => {
    const { fixture } = await setup({ hasActiveCompanyContext: true });
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).not.toContain('Select a company to configure monitoring.');
    expect(el.querySelector('[aria-label="Monitoring override scope"]')).not.toBeNull();
  });
});
