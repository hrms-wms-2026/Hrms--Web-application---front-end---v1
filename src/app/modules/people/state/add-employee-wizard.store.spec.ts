import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { OnboardingDraftResponse } from '../models/onboarding-draft.model';
import { AddEmployeeWizardStore } from './add-employee-wizard.store';

describe('AddEmployeeWizardStore', () => {
  let store: InstanceType<typeof AddEmployeeWizardStore>;
  let httpMock: HttpTestingController;

  const mockDraft: OnboardingDraftResponse = {
    id: 'draft-1',
    firstName: 'Ada',
    lastName: 'Lovelace',
    workEmail: 'ada@test.dev',
    legalEntityId: 'le-1',
    departmentId: 'dept-1',
    positionId: 'pos-1',
    employmentType: 'full_time',
    startDate: '2026-08-10',
    employeeNumber: null,
    workModeId: 1,
    selectedTemplateId: null,
    editedTasksJson: null,
    status: 'waiting_for_seat',
    draftReason: 'waiting_for_seat',
    lastSavedStep: 'checklist_template',
    startedById: 'user-1',
    version: '1'
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AddEmployeeWizardStore, provideHttpClient(), provideHttpClientTesting()]
    });

    store = TestBed.inject(AddEmployeeWizardStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('has correct initial state including firstName, lastName, workModeId, workModes, and finalizing', () => {
    expect(store.formValue().firstName).toBe('');
    expect(store.formValue().lastName).toBe('');
    expect(store.formValue().workModeId).toBeNull();
    expect(store.workModes()).toEqual([]);
    expect(store.loadingWorkModes()).toBe(false);
    expect(store.workModesError()).toBeNull();
    expect(store.finalizing()).toBe(false);
    expect(store.finalizeError()).toBeNull();
    expect(store.finalizeResult()).toBeNull();
    expect(store.checklistTemplatesUnavailable()).toBe(true);
  });

  it('clears departmentId and positionId when the company changes', async () => {
    store.setCompany('le-1');
    httpMock.expectOne((r) => r.url.includes('/departments')).flush({ items: [], page: 1, pageSize: 25, totalCount: 0, totalPages: 0 });
    await Promise.resolve();

    store.setDepartment('dept-1');
    httpMock.expectOne((r) => r.url.includes('/positions')).flush({ items: [], page: 1, pageSize: 25, totalCount: 0, totalPages: 0 });
    await Promise.resolve();

    expect(store.departmentId()).toBe('dept-1');

    store.setCompany('le-2');
    httpMock.expectOne((r) => r.url.includes('/departments')).flush({ items: [], page: 1, pageSize: 25, totalCount: 0, totalPages: 0 });
    await Promise.resolve();

    expect(store.departmentId()).toBeNull();
    expect(store.positionId()).toBeNull();
  });

  it('clears positionId when the department changes', async () => {
    store.setCompany('le-1');
    httpMock.expectOne((r) => r.url.includes('/departments')).flush({ items: [], page: 1, pageSize: 25, totalCount: 0, totalPages: 0 });
    await Promise.resolve();

    store.setDepartment('dept-1');
    httpMock.expectOne((r) => r.url.includes('/positions')).flush({
      items: [{ id: 'pos-1', legalEntityId: 'le-1', departmentId: 'dept-1', name: 'Engineer', code: null, positionType: 'unique', maxOccupancy: 1, reportsToPositionId: null, isActive: true, createdAt: '', updatedAt: null }],
      page: 1,
      pageSize: 25,
      totalCount: 1,
      totalPages: 1
    });
    await Promise.resolve();
    store.setPosition('pos-1');

    expect(store.positionId()).toBe('pos-1');

    store.setDepartment('dept-2');
    httpMock.expectOne((r) => r.url.includes('/positions')).flush({ items: [], page: 1, pageSize: 25, totalCount: 0, totalPages: 0 });
    await Promise.resolve();

    expect(store.positionId()).toBeNull();
  });

  it('loadWorkModes stores active work mode options and handles error safely', async () => {
    const loadPromise = store.loadWorkModes();
    expect(store.loadingWorkModes()).toBe(true);

    const req = httpMock.expectOne(`${environment.apiUrl}/work-modes`);
    req.flush([{ id: 1, code: 'on_site', label: 'On-Site' }]);
    await loadPromise;

    expect(store.loadingWorkModes()).toBe(false);
    expect(store.workModes().length).toBe(1);
    expect(store.workModes()[0].code).toBe('on_site');
  });

  it('handles loadWorkModes failure with safe error message', async () => {
    const loadPromise = store.loadWorkModes();
    const req = httpMock.expectOne(`${environment.apiUrl}/work-modes`);
    req.flush('Error', { status: 500, statusText: 'Internal Error' });
    await loadPromise;

    expect(store.loadingWorkModes()).toBe(false);
    expect(store.workModes()).toEqual([]);
    expect(store.workModesError()).toBe('Something went wrong while saving your changes.');
  });

  it('resumeDraft restores step, selections, and form value including firstName, lastName, workModeId', async () => {
    const resumePromise = store.resumeDraft('draft-1');
    httpMock.expectOne(`${environment.apiUrl}/onboarding/drafts/draft-1`).flush(mockDraft);
    await Promise.resolve();
    await Promise.resolve();
    httpMock.expectOne((r) => r.url.includes('/departments')).flush({ items: [], page: 1, pageSize: 25, totalCount: 0, totalPages: 0 });
    await Promise.resolve();
    await Promise.resolve();
    httpMock.expectOne((r) => r.url.includes('/positions')).flush({ items: [], page: 1, pageSize: 25, totalCount: 0, totalPages: 0 });
    await resumePromise;

    expect(store.step()).toBe('checklist_template');
    expect(store.companyId()).toBe('le-1');
    expect(store.departmentId()).toBe('dept-1');
    expect(store.positionId()).toBe('pos-1');
    expect(store.formValue().firstName).toBe('Ada');
    expect(store.formValue().lastName).toBe('Lovelace');
    expect(store.formValue().workModeId).toBe(1);
    expect(store.version()).toBe('1');
  });

  it('saveDraft refuses to call API when workModeId is missing or invalid', async () => {
    store.updateFormValue({ firstName: 'Ada', lastName: 'Lovelace', workEmail: 'ada@test.dev', employmentType: 'full_time', startDate: '2026-08-10', workModeId: null });
    const savePromise = store.saveDraft('employee_details');
    const result = await savePromise;

    expect(result).toBeNull();
    expect(store.saveError()).toBe('Work mode is required.');
    httpMock.expectNone(`${environment.apiUrl}/onboarding/drafts`);
  });

  it('saveDraft sends firstName, lastName, workModeId and never sends employeeName or scheduleId', async () => {
    store.updateFormValue({ firstName: 'Ada', lastName: 'Lovelace', workEmail: 'ada@test.dev', employmentType: 'full_time', startDate: '2026-08-10', workModeId: 1 });
    const savePromise = store.saveDraft('employee_details');

    const req = httpMock.expectOne(`${environment.apiUrl}/onboarding/drafts`);
    expect(req.request.body.firstName).toBe('Ada');
    expect(req.request.body.lastName).toBe('Lovelace');
    expect(req.request.body.workModeId).toBe(1);
    expect(req.request.body.employeeName).toBeUndefined();
    expect(req.request.body.scheduleId).toBeUndefined();
    req.flush(mockDraft);
    await savePromise;
  });

  it('finalizeDraft calls finalize endpoint, updates state, and handles errors safely', async () => {
    const finPromise = store.finalizeDraft('draft-1');
    expect(store.finalizing()).toBe(true);

    const req = httpMock.expectOne(`${environment.apiUrl}/onboarding/drafts/draft-1/finalize`);
    expect(req.request.method).toBe('POST');
    req.flush({
      draftId: 'draft-1',
      employeeId: 'emp-1',
      status: 'finalized',
      draftReason: 'invitation_sent',
      invitationQueued: true,
      positionApprovalPending: false,
      checklistTasksCreated: true,
      messageKey: 'finalized'
    });
    const res = await finPromise;

    expect(store.finalizing()).toBe(false);
    expect(res?.draftId).toBe('draft-1');
    expect(store.finalizeResult()?.status).toBe('finalized');
    expect(store.finalizeError()).toBeNull();
  });

  it('finalizeDraft stores approval-pending response and updates status safely when positionApprovalPending is true', async () => {
    const finPromise = store.finalizeDraft('draft-pending');
    expect(store.finalizing()).toBe(true);

    const req = httpMock.expectOne(`${environment.apiUrl}/onboarding/drafts/draft-pending/finalize`);
    expect(req.request.method).toBe('POST');
    req.flush({
      draftId: 'draft-pending',
      employeeId: null,
      status: 'waiting_for_position_approval',
      draftReason: 'waiting_for_position_approval',
      invitationQueued: false,
      positionApprovalPending: true,
      checklistTasksCreated: false,
      messageKey: 'position_approval_requested'
    });
    const res = await finPromise;

    expect(store.finalizing()).toBe(false);
    expect(res?.draftId).toBe('draft-pending');
    expect(store.finalizeResult()?.positionApprovalPending).toBe(true);
    expect(store.lastSaveStatus()).toBe('waiting_for_position_approval');
    expect(store.lastSaveReason()).toBe('waiting_for_position_approval');
    expect(store.finalizeError()).toBeNull();
  });

  it('handles finalizeDraft failure with safe error message', async () => {
    const finPromise = store.finalizeDraft('draft-1');
    const req = httpMock.expectOne(`${environment.apiUrl}/onboarding/drafts/draft-1/finalize`);
    req.flush('Error', { status: 400, statusText: 'Bad Request' });
    const res = await finPromise;

    expect(store.finalizing()).toBe(false);
    expect(res).toBeNull();
    expect(store.finalizeError()).toBe('Please check the highlighted fields.');
  });
});
