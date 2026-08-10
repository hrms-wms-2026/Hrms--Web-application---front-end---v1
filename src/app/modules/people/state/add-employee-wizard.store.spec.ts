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
    employeeName: 'Ada Lovelace',
    workEmail: 'ada@test.dev',
    legalEntityId: 'le-1',
    departmentId: 'dept-1',
    positionId: 'pos-1',
    employmentType: 'full_time',
    startDate: '2026-08-10',
    employeeNumber: null,
    scheduleId: null,
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

  it('reports schedules and checklist templates as unavailable rather than fabricating options', () => {
    expect(store.schedulesUnavailable()).toBe(true);
    expect(store.checklistTemplatesUnavailable()).toBe(true);
    expect(store.schedules()).toEqual([]);
    expect(store.checklistTemplates()).toEqual([]);
  });

  it('resumeDraft restores step, selections, and form value from the drafts lastSavedStep', async () => {
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
    expect(store.formValue().employeeName).toBe('Ada Lovelace');
    expect(store.version()).toBe('1');
  });

  it('saveDraft never calls any invite/account/user endpoint', async () => {
    store.updateFormValue({ employeeName: 'Ada Lovelace', workEmail: 'ada@test.dev', employmentType: 'full_time', startDate: '2026-08-10' });
    const savePromise = store.saveDraft('employee_details');

    const req = httpMock.expectOne(`${environment.apiUrl}/onboarding/drafts`);
    expect(req.request.url).not.toMatch(/invite|user|account/i);
    req.flush(mockDraft);
    await savePromise;

    httpMock.verify();
  });

  it('maps a seat-blocked draft response into store state without a raw code leaking into saveError', async () => {
    store.updateFormValue({ employeeName: 'Ada Lovelace', workEmail: 'ada@test.dev', employmentType: 'full_time', startDate: '2026-08-10' });
    const savePromise = store.saveDraft('employee_details');
    httpMock.expectOne(`${environment.apiUrl}/onboarding/drafts`).flush(mockDraft);
    await savePromise;

    expect(store.lastSaveStatus()).toBe('waiting_for_seat');
    expect(store.lastSaveReason()).toBe('waiting_for_seat');
    expect(store.saveError()).toBeNull();
  });
});
