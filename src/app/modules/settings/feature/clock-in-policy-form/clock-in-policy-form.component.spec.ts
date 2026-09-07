import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { environment } from '../../../../../environments/environment';
import { LegalEntityStore } from '../../../organization/state/legal-entity.store';
import {
  ClockInPolicyListItemResponse,
  ClockInPolicyResponse
} from '../../models/clock-in-policy.model';
import {
  CLOCK_IN_POLICY_COMPANY_WIDE_CONFLICT,
  ClockInPolicyStore
} from '../../state/clock-in-policy.store';
import { ClockInPolicyFormComponent } from './clock-in-policy-form.component';
import {
  LATE_DEDUCTION_RULES_DISABLED_MESSAGE,
  LATE_DEDUCTION_RULES_EDITABLE,
  validateClockInPolicyForm
} from '../../utils/clock-in-policy-form.utils';

describe('ClockInPolicyFormComponent', () => {
  let httpMock: HttpTestingController;
  let permissionService: PermissionService;
  let notifications: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  const listItem: ClockInPolicyListItemResponse = {
    id: 'policy-1',
    legalEntityId: 'le-1',
    name: 'Existing Policy',
    scopeType: 'full_company',
    effectiveFrom: '2026-08-21',
    effectiveTo: null,
    isActive: true,
    lateDeductionRuleCount: 1,
    createdAt: '2026-08-21T00:00:00Z',
    updatedAt: '2026-08-21T00:00:00Z'
  };

  const detail: ClockInPolicyResponse = {
    id: 'policy-1',
    legalEntityId: 'le-1',
    name: 'Existing Policy',
    scope: { type: 'full_company', departmentIds: [], positionIds: [], employeeIds: [] },
    effectiveFrom: '2026-08-21',
    effectiveTo: null,
    locationVerificationRequired: false,
    allowedRadiusMeters: null,
    workAreaRules: {
      onsite: { biometricEnabled: true, webEnabled: false, trayEnabled: false, photoRequired: false },
      remote: { biometricEnabled: false, webEnabled: true, trayEnabled: true, photoRequired: true, locationCheckRequired: false },
      hybrid: {
        biometricEnabled: false,
        webEnabled: true,
        trayEnabled: true,
        photoRequired: true,
        locationCheckRequired: false,
        sourceRule: 'employee_choice'
      },
      field: { biometricEnabled: false, webEnabled: true, trayEnabled: true, photoRequirement: 'required' }
    },
    correctionRequiresApproval: true,
    notificationRecipientResolver: 'management_coverage_owner',
    lateDeductionRules: [
      { id: 'r1', lateArrivalMinute: 15, multiplier: 0.5, timeOffTypeId: 'tot-1', isActive: true }
    ],
    isActive: true,
    createdById: 'user-1',
    createdAt: '2026-08-21T00:00:00Z',
    updatedAt: '2026-08-21T00:00:00Z'
  };

  const listUrl = `${environment.apiUrl}/attendance/legal-entities/le-1/clock-in-policies?includeInactive=false`;
  const createUrl = `${environment.apiUrl}/attendance/legal-entities/le-1/clock-in-policies`;
  const detailUrl = `${environment.apiUrl}/attendance/legal-entities/le-1/clock-in-policies/policy-1`;

  afterEach(() => {
    httpMock?.verify();
    TestBed.resetTestingModule();
  });

  async function setup(options?: {
    permissions?: string[];
    modules?: string[];
    company?: { id: string; name: string } | null;
    lateRulesEditable?: boolean;
    timeOffTypes?: { value: string; label: string }[];
  }): Promise<ComponentFixture<ClockInPolicyFormComponent>> {
    const permissions = options?.permissions ?? ['attendance:write', 'attendance:read'];
    const modules = options?.modules ?? ['time_attendance'];
    const selectedCompany = signal(
      options?.company === undefined ? { id: 'le-1', name: 'Acme' } : options.company
    );

    notifications = {
      success: vi.fn(),
      error: vi.fn()
    };

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ClockInPolicyFormComponent],
      providers: [
        PermissionService,
        ClockInPolicyStore,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: LegalEntityStore,
          useValue: { selectedLegalEntity: selectedCompany }
        },
        {
          provide: NotificationService,
          useValue: notifications
        }
      ]
    }).compileComponents();

    permissionService = TestBed.inject(PermissionService);
    httpMock = TestBed.inject(HttpTestingController);
    vi.spyOn(permissionService, 'hasPermission').mockImplementation((p: string) =>
      permissions.includes(p)
    );
    vi.spyOn(permissionService, 'hasModule').mockImplementation((m: string) => modules.includes(m));

    const fixture = TestBed.createComponent(ClockInPolicyFormComponent);
    if (options?.lateRulesEditable) {
      fixture.componentInstance.lateRulesEditable.set(true);
      fixture.componentInstance.timeOffTypeOptions.set(
        options.timeOffTypes ?? [
          { value: 'tot-1', label: 'Annual Leave' },
          { value: 'tot-2', label: 'Sick Leave' }
        ]
      );
    }
    fixture.detectChanges();
    return fixture;
  }

  function pageText(fixture: ComponentFixture<ClockInPolicyFormComponent>): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  async function flushEmptyCompanyWide(
    fixture: ComponentFixture<ClockInPolicyFormComponent>
  ): Promise<void> {
    let req = httpMock.match(listUrl)[0];
    for (let i = 0; i < 30 && !req; i++) {
      await Promise.resolve();
      req = httpMock.match(listUrl)[0];
    }
    if (!req) {
      req = httpMock.expectOne(listUrl);
    }
    expect(req.request.method).toBe('GET');
    req.flush([]);
    await Promise.resolve();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function flushExistingCompanyWide(
    fixture: ComponentFixture<ClockInPolicyFormComponent>
  ): Promise<void> {
    let listReq = httpMock.match(listUrl)[0];
    for (let i = 0; i < 30 && !listReq; i++) {
      await Promise.resolve();
      listReq = httpMock.match(listUrl)[0];
    }
    if (!listReq) {
      listReq = httpMock.expectOne(listUrl);
    }
    listReq.flush([listItem]);
    await Promise.resolve();

    let detailReq = httpMock.match(detailUrl)[0];
    for (let i = 0; i < 30 && !detailReq; i++) {
      await Promise.resolve();
      detailReq = httpMock.match(detailUrl)[0];
    }
    if (!detailReq) {
      detailReq = httpMock.expectOne(detailUrl);
    }
    expect(detailReq.request.method).toBe('GET');
    detailReq.flush(detail);
    await Promise.resolve();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('renders the company-wide settings form with clock-in methods and save action', async () => {
    const fixture = await setup();
    await flushEmptyCompanyWide(fixture);
    const el = fixture.nativeElement as HTMLElement;
    const text = pageText(fixture);

    expect(el.querySelector('[data-testid="clock-in-policy-form"]')).toBeTruthy();
    expect(el.querySelector('table')).toBeNull();
    expect(text).toContain('Clock-in Policy');
    expect(text).toContain('Save changes');
    expect(text).toContain('Late deduction rules');
    expect(el.querySelector('[data-testid="work-area-onsite"]')?.textContent).toContain('Onsite');
    expect(el.querySelector('[data-testid="work-area-remote"]')?.textContent).toContain('Remote');
    expect(el.querySelector('[data-testid="work-area-hybrid"]')?.textContent).toContain('Hybrid');
    expect(el.querySelector('[data-testid="work-area-field"]')?.textContent).toContain('Field');

    for (const label of [
      'Control how employees can clock in for this company.',
      'Policy name',
      'Effective from',
      'Effective to',
      'Applies to',
      'Department',
      'Position',
      'Attendance corrections',
      'Source rule'
    ]) {
      expect(text).not.toContain(label);
    }
  });

  it('renders Late deduction rules section on the single Clock-in Policy screen', async () => {
    const fixture = await setup();
    await flushEmptyCompanyWide(fixture);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="late-deduction-rules-section"]')).toBeTruthy();
    expect(pageText(fixture)).toContain('Late deduction rules');
  });

  it('does not render the old late-deduction placeholder text', async () => {
    const fixture = await setup();
    await flushEmptyCompanyWide(fixture);
    const text = pageText(fixture);
    expect(text).not.toContain(
      'Late deduction setup will be added after Time Off types are available.'
    );
  });

  it('disables late deduction editing when Time Off Type lookup is unavailable', async () => {
    expect(LATE_DEDUCTION_RULES_EDITABLE).toBe(false);
    const fixture = await setup();
    await flushEmptyCompanyWide(fixture);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="late-deduction-disabled-message"]')?.textContent).toContain(
      LATE_DEDUCTION_RULES_DISABLED_MESSAGE
    );
    expect(el.querySelector('[data-testid="add-late-rule"]')).toBeNull();
    expect(el.querySelector('[data-testid="late-deduction-rules-editor"]')).toBeNull();
  });

  it('loads defaults when no company-wide policy exists', async () => {
    const fixture = await setup();
    await flushEmptyCompanyWide(fixture);
    expect(fixture.componentInstance.form().name).toBe('Default clock-in policy');
    expect(fixture.componentInstance.policyStore.policy()).toBeNull();
  });

  it('loads existing company-wide policy into the form', async () => {
    const fixture = await setup();
    await flushExistingCompanyWide(fixture);
    expect(fixture.componentInstance.form().name).toBe('Existing Policy');
    expect(fixture.componentInstance.form().effectiveFrom).toBe('2026-08-21');
    expect(fixture.componentInstance.policyStore.policy()?.id).toBe('policy-1');
  });

  it('excludes list/create/edit metadata and forbidden wording from UI', async () => {
    const fixture = await setup();
    await flushEmptyCompanyWide(fixture);
    const text = pageText(fixture);
    const forbidden = [
      'Create policy',
      'Edit policy',
      'Policy details',
      'Policy name',
      'Effective from',
      'Effective to',
      'Applies to',
      'Attendance corrections',
      'Corrections require approval',
      'Notification recipient',
      'Source rule',
      'Location verification',
      'Require location verification',
      'Allowed radius in meters',
      'Show inactive policies',
      'Late deduction setup will be added after Time Off types are available.'
    ];
    for (const label of forbidden) {
      expect(text).not.toContain(label);
    }
    expect(text.toLowerCase()).not.toContain('either');
    for (const word of ['outage', 'fallback', 'affected device', 'biometric outage']) {
      expect(text.toLowerCase()).not.toContain(word);
    }
  });

  it('Hybrid card owns location check and allowed distance', async () => {
    const fixture = await setup();
    await flushEmptyCompanyWide(fixture);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('[data-testid="hybrid-location-check"]')).toBeTruthy();
    expect(pageText(fixture)).toContain('Location check required');
    expect(el.querySelector('[data-testid="hybrid-allowed-distance"]')).toBeNull();

    fixture.componentInstance.setHybridLocationCheck(true);
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="hybrid-allowed-distance"]')).toBeTruthy();
    expect(pageText(fixture)).toContain('Allowed distance');
    expect(pageText(fixture)).toContain('meters');
  });

  it('Field photo uses checkbox not dropdown', async () => {
    const fixture = await setup();
    await flushEmptyCompanyWide(fixture);
    const el = fixture.nativeElement as HTMLElement;
    const photo = el.querySelector(
      '[data-testid="field-photo-required"]'
    ) as HTMLInputElement | null;
    expect(photo).toBeTruthy();
    expect(photo?.type).toBe('checkbox');
    expect(el.querySelector('[data-testid="field-photo-requirement"]')).toBeNull();
  });

  it('allowed distance required only when Hybrid location check is enabled', async () => {
    const fixture = await setup();
    await flushEmptyCompanyWide(fixture);
    const component = fixture.componentInstance;

    expect(validateClockInPolicyForm(component.form()).valid).toBe(true);
    component.setHybridLocationCheck(true);
    component.patchForm({ allowedDistanceMeters: '' });
    await component.onSubmit();
    fixture.detectChanges();
    expect(component.fieldErrors()['allowedDistanceMeters']).toBeTruthy();
    httpMock.expectNone(createUrl);
  });

  it('create posts company-wide payload with forced backend-required fields', async () => {
    const fixture = await setup();
    await flushEmptyCompanyWide(fixture);
    const component = fixture.componentInstance;
    const expectedFrom = component.form().effectiveFrom;
    component.setFieldPhotoRequired(false);
    const submit = component.onSubmit();

    const req = httpMock.expectOne(createUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.name).toBe('Default clock-in policy');
    expect(req.request.body.effectiveFrom).toBe(expectedFrom);
    expect(req.request.body.effectiveTo).toBeNull();
    expect(req.request.body.locationVerificationRequired).toBe(false);
    expect(req.request.body.allowedRadiusMeters).toBeNull();
    expect(req.request.body.scope).toEqual({
      type: 'full_company',
      departmentIds: [],
      positionIds: [],
      employeeIds: []
    });
    expect(req.request.body.isActive).toBe(true);
    expect(req.request.body.correctionRequiresApproval).toBe(true);
    expect(req.request.body.notificationRecipientResolver).toBe('management_coverage_owner');
    expect(req.request.body.workAreaRules.hybrid.sourceRule).toBe('employee_choice');
    expect(req.request.body.workAreaRules.field.photoRequirement).toBe('off');
    expect(req.request.body.lateDeductionRules).toEqual([]);
    expect(JSON.stringify(req.request.body).toLowerCase()).not.toContain('either');
    req.flush(detail);
    await submit;
    expect(notifications.success).toHaveBeenCalledWith('Changes saved.');
  });

  it('update preserves existing backend late rules when Time Off Type lookup is missing', async () => {
    const fixture = await setup();
    await flushExistingCompanyWide(fixture);
    const component = fixture.componentInstance;
    expect(component.lateRulesEditable()).toBe(false);
    component.setHybridLocationCheck(true);
    component.patchForm({ allowedDistanceMeters: '50' });
    const submit = component.onSubmit();

    const req = httpMock.expectOne((r) => r.url === detailUrl && r.method === 'PUT');
    expect(req.request.body.name).toBe('Existing Policy');
    expect(req.request.body.effectiveFrom).toBe('2026-08-21');
    expect(req.request.body.effectiveTo).toBeNull();
    expect(req.request.body.workAreaRules.hybrid.locationCheckRequired).toBe(true);
    expect(req.request.body.locationVerificationRequired).toBe(true);
    expect(req.request.body.allowedRadiusMeters).toBe(50);
    expect(req.request.body.scope.type).toBe('full_company');
    expect(req.request.body.isActive).toBe(true);
    expect(req.request.body.lateDeductionRules).toEqual([
      { lateArrivalMinute: 15, multiplier: 0.5, timeOffTypeId: 'tot-1' }
    ]);
    req.flush({
      ...detail,
      locationVerificationRequired: true,
      allowedRadiusMeters: 50,
      workAreaRules: {
        ...detail.workAreaRules,
        hybrid: { ...detail.workAreaRules.hybrid, locationCheckRequired: true }
      }
    });
    await submit;
    expect(notifications.success).toHaveBeenCalledWith('Changes saved.');
  });

  it('Add rule and Remove rule work when late deduction editing is enabled', async () => {
    const fixture = await setup({ lateRulesEditable: true });
    await flushEmptyCompanyWide(fixture);
    const component = fixture.componentInstance;
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('[data-testid="late-deduction-rules-editor"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="add-late-rule"]')).toBeTruthy();

    component.addLateRule();
    fixture.detectChanges();
    expect(component.form().lateDeductionRules.length).toBe(1);
    expect(el.querySelector('[data-testid="late-rule-row-0"]')).toBeTruthy();
    expect(pageText(fixture)).toContain('If late by');
    expect(pageText(fixture)).toContain('minutes');
    expect(pageText(fixture)).toContain('deduct');
    expect(pageText(fixture)).toContain('time off type');

    component.addLateRule();
    fixture.detectChanges();
    expect(component.form().lateDeductionRules.length).toBe(2);

    component.removeLateRule(0);
    fixture.detectChanges();
    expect(component.form().lateDeductionRules.length).toBe(1);
    expect(el.querySelector('[data-testid="late-rule-row-0"]')).toBeTruthy();
  });

  it('blocks invalid minutes and deduction amount before save when editable', async () => {
    const fixture = await setup({ lateRulesEditable: true });
    await flushEmptyCompanyWide(fixture);
    const component = fixture.componentInstance;
    component.addLateRule();
    component.patchLateRule(0, {
      lateArrivalMinutes: '0',
      deductionAmount: '-2',
      timeOffTypeId: 'tot-1'
    });
    await component.onSubmit();
    fixture.detectChanges();
    expect(component.fieldErrors()['lateDeductionRules.0.lateArrivalMinutes']).toBeTruthy();
    expect(component.fieldErrors()['lateDeductionRules.0.deductionAmount']).toBeTruthy();
    httpMock.expectNone(createUrl);
  });

  it('blocks duplicate late-by minute thresholds before save when editable', async () => {
    const fixture = await setup({ lateRulesEditable: true });
    await flushEmptyCompanyWide(fixture);
    const component = fixture.componentInstance;
    component.addLateRule();
    component.addLateRule();
    component.patchLateRule(0, {
      lateArrivalMinutes: '10',
      deductionAmount: '1',
      timeOffTypeId: 'tot-1'
    });
    component.patchLateRule(1, {
      lateArrivalMinutes: '10',
      deductionAmount: '2',
      timeOffTypeId: 'tot-2'
    });
    await component.onSubmit();
    fixture.detectChanges();
    expect(component.fieldErrors()['lateDeductionRules.0.lateArrivalMinutes']).toContain('once');
    expect(component.fieldErrors()['lateDeductionRules.1.lateArrivalMinutes']).toContain('once');
    httpMock.expectNone(createUrl);
  });

  it('sorts late rules before payload submit when editable', async () => {
    const fixture = await setup({ lateRulesEditable: true });
    await flushEmptyCompanyWide(fixture);
    const component = fixture.componentInstance;
    component.addLateRule();
    component.addLateRule();
    component.patchLateRule(0, {
      lateArrivalMinutes: '30',
      deductionAmount: '1',
      timeOffTypeId: 'tot-2'
    });
    component.patchLateRule(1, {
      lateArrivalMinutes: '5',
      deductionAmount: '0.5',
      timeOffTypeId: 'tot-1'
    });
    const submit = component.onSubmit();
    const req = httpMock.expectOne(createUrl);
    expect(req.request.body.lateDeductionRules).toEqual([
      { lateArrivalMinute: 5, multiplier: 0.5, timeOffTypeId: 'tot-1' },
      { lateArrivalMinute: 30, multiplier: 1, timeOffTypeId: 'tot-2' }
    ]);
    expect(req.request.body.scope.type).toBe('full_company');
    req.flush(detail);
    await submit;
  });

  it('Time Off Type dropdown uses provided lookup options when editing is enabled', async () => {
    const fixture = await setup({
      lateRulesEditable: true,
      timeOffTypes: [
        { value: 'tot-1', label: 'Annual Leave' },
        { value: 'tot-2', label: 'Sick Leave' }
      ]
    });
    await flushEmptyCompanyWide(fixture);
    const component = fixture.componentInstance;
    component.addLateRule();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const options = Array.from(el.querySelectorAll('select option')).map((o) => o.textContent?.trim());
    expect(options).toContain('Annual Leave');
    expect(options).toContain('Sick Leave');
    expect(options).not.toContain('Casual Leave');
  });

  it('shows conflict error and hides Save when multiple company-wide policies exist', async () => {
    const fixture = await setup();
    let listReq = httpMock.match(listUrl)[0];
    for (let i = 0; i < 30 && !listReq; i++) {
      await Promise.resolve();
      listReq = httpMock.match(listUrl)[0];
    }
    if (!listReq) {
      listReq = httpMock.expectOne(listUrl);
    }
    listReq.flush([
      listItem,
      { ...listItem, id: 'policy-2', name: 'Other company policy' }
    ]);
    await Promise.resolve();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(pageText(fixture)).toContain(CLOCK_IN_POLICY_COMPANY_WIDE_CONFLICT);
    expect(fixture.nativeElement.querySelector('[data-testid="clock-in-policy-form"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="save-policy"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="multiple-policies-error"]')).toBeTruthy();
  });

  it('failed save shows sanitized friendly notification', async () => {
    const fixture = await setup();
    await flushEmptyCompanyWide(fixture);
    const submit = fixture.componentInstance.onSubmit();
    httpMock.expectOne(createUrl).flush(
      { detail: 'RAW_BACKEND_CODE' },
      { status: 500, statusText: 'Server Error' }
    );
    await submit;
    fixture.detectChanges();
    expect(notifications.error).toHaveBeenCalledWith('Could not save clock-in policy. Try again.');
    expect(notifications.success).not.toHaveBeenCalled();
  });

  it('shows select-company message when company is missing and does not call API', async () => {
    const fixture = await setup({ company: null });
    httpMock.expectNone(() => true);
    expect(pageText(fixture)).toContain('Select a company to manage clock-in policy.');
  });

  it('read-only user sees settings but cannot save', async () => {
    const fixture = await setup({ permissions: ['attendance:read'] });
    await flushEmptyCompanyWide(fixture);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="save-policy"]')).toBeNull();
    expect(el.querySelector('[data-testid="clock-in-policy-form"]')).toBeTruthy();
    expect(pageText(fixture)).toContain('Clock-in Policy');
    const checkboxes = el.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBeGreaterThan(0);
    checkboxes.forEach((input) => expect((input as HTMLInputElement).disabled).toBe(true));
  });

  it('uses environment.apiUrl legal-entity routes', async () => {
    await setup();
    expect(createUrl.startsWith(environment.apiUrl)).toBe(true);
    expect(detailUrl.startsWith(environment.apiUrl)).toBe(true);
    httpMock.expectOne(listUrl).flush([]);
  });
});
