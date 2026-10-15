import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { OnboardingDraftResponse } from '../models/onboarding-draft.model';
import { ChecklistTemplateDetailResponse, OnboardingChecklistTemplateMatchResponse } from '../models/checklist-template.model';
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
    workModeId: 'wm-1',
    selectedTemplateId: null,
    editedTasksJson: null,
    status: 'waiting_for_seat',
    draftReason: 'waiting_for_seat',
    lastSavedStep: 'checklist_template',
    startedById: 'user-1',
    reportsToEmployeeId: null,
    version: '1'
  };

  function mockDetail(id: string, name: string): ChecklistTemplateDetailResponse {
    return {
      id,
      name,
      templateType: 'onboarding',
      legalEntityId: 'le-1',
      departmentId: null,
      departmentName: null,
      positionId: null,
      positionName: null,
      isActive: true,
      tasks: []
    };
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AddEmployeeWizardStore, provideHttpClient(), provideHttpClientTesting()]
    });

    store = TestBed.inject(AddEmployeeWizardStore);
    httpMock = TestBed.inject(HttpTestingController);
    store.reset();
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
    expect(store.selectedTemplateId()).toBeNull();
    expect(store.loadingChecklistTemplates()).toBe(false);
    expect(store.checklistTemplatesError()).toBeNull();
    expect(store.checklistTemplateMatches()).toEqual([]);
    expect(store.draftTasks()).toEqual([]);
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
    const loadPromise = store.loadWorkModes('le-1');
    expect(store.loadingWorkModes()).toBe(true);

    const req = httpMock.expectOne(
      (r) => r.url === `${environment.apiUrl}/work-modes` && r.params.get('legalEntityId') === 'le-1'
    );
    req.flush([{ id: 'wm-1', label: 'On-Site' }]);
    await loadPromise;

    expect(store.loadingWorkModes()).toBe(false);
    expect(store.workModes().length).toBe(1);
    expect(store.workModes()[0].label).toBe('On-Site');
  });

  it('handles loadWorkModes failure with safe error message', async () => {
    const loadPromise = store.loadWorkModes('le-1');
    const req = httpMock.expectOne(
      (r) => r.url === `${environment.apiUrl}/work-modes` && r.params.get('legalEntityId') === 'le-1'
    );
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
    await Promise.resolve();
    await Promise.resolve();
    httpMock.expectOne((r) => r.url.includes('/onboarding/checklist-templates/matches')).flush([]);
    await resumePromise;

    expect(store.step()).toBe('checklist_template');
    expect(store.companyId()).toBe('le-1');
    expect(store.departmentId()).toBe('dept-1');
    expect(store.positionId()).toBe('pos-1');
    expect(store.formValue().firstName).toBe('Ada');
    expect(store.formValue().lastName).toBe('Lovelace');
    expect(store.formValue().workModeId).toBe('wm-1');
    expect(store.version()).toBe('1');
  });

  it('resumeDraft restores selectedTemplateId from the draft and loads matches for the draft context', async () => {
    const draftWithTemplate: OnboardingDraftResponse = { ...mockDraft, selectedTemplateId: 'tmpl-9' };
    const resumePromise = store.resumeDraft('draft-1');
    httpMock.expectOne(`${environment.apiUrl}/onboarding/drafts/draft-1`).flush(draftWithTemplate);
    await Promise.resolve();
    await Promise.resolve();
    httpMock.expectOne((r) => r.url.includes('/departments')).flush({ items: [], page: 1, pageSize: 25, totalCount: 0, totalPages: 0 });
    await Promise.resolve();
    await Promise.resolve();
    httpMock.expectOne((r) => r.url.includes('/positions')).flush({ items: [], page: 1, pageSize: 25, totalCount: 0, totalPages: 0 });
    await Promise.resolve();
    await Promise.resolve();
    const matchesReq = httpMock.expectOne((r) => r.url.includes('/onboarding/checklist-templates/matches'));
    expect(matchesReq.request.params.get('legalEntityId')).toBe('le-1');
    expect(matchesReq.request.params.get('departmentId')).toBe('dept-1');
    expect(matchesReq.request.params.get('positionId')).toBe('pos-1');
    matchesReq.flush([{ id: 'tmpl-9', name: 'Dept Onboarding', matchLevel: 'department', departmentId: 'dept-1', positionId: null }]);
    await Promise.resolve();
    httpMock.expectOne(`${environment.apiUrl}/people/checklist-templates/tmpl-9`).flush(mockDetail('tmpl-9', 'Dept Onboarding'));
    await resumePromise;

    expect(store.selectedTemplateId()).toBe('tmpl-9');
    expect(store.checklistTemplateMatches().length).toBe(1);
    expect(store.selectedTemplateDetail()?.id).toBe('tmpl-9');
  });

  it('loadChecklistTemplateMatches populates matches and maps them to select options without auto-selecting any of them, even when there is exactly one match', async () => {
    store.setCompany('le-1');
    httpMock.expectOne((r) => r.url.includes('/departments')).flush({ items: [], page: 1, pageSize: 25, totalCount: 0, totalPages: 0 });
    await Promise.resolve();

    const loadPromise = store.loadChecklistTemplateMatches();
    expect(store.loadingChecklistTemplates()).toBe(true);

    const req = httpMock.expectOne((r) => r.url.includes('/onboarding/checklist-templates/matches'));
    req.flush([{ id: 'tmpl-1', name: 'Company Default Onboarding', matchLevel: 'company', departmentId: null, positionId: null }]);
    await loadPromise;

    expect(store.loadingChecklistTemplates()).toBe(false);
    expect(store.checklistTemplatesUnavailable()).toBe(false);
    expect(store.checklistTemplateMatches().length).toBe(1);
    expect(store.checklistTemplates()).toEqual([{ value: 'tmpl-1', label: 'Company Default Onboarding' }]);
    expect(store.selectedTemplateId()).toBeNull();
    expect(store.selectedTemplateDetail()).toBeNull();
    expect(store.draftTasks()).toEqual([]);
    // No selection means no detail request should ever be issued.
    httpMock.expectNone(`${environment.apiUrl}/people/checklist-templates/tmpl-1`);
  });

  it('loadChecklistTemplateMatches does not overwrite an already-selected template', async () => {
    store.setCompany('le-1');
    httpMock.expectOne((r) => r.url.includes('/departments')).flush({ items: [], page: 1, pageSize: 25, totalCount: 0, totalPages: 0 });
    await Promise.resolve();

    store.selectChecklistTemplate('tmpl-1');
    httpMock.expectOne(`${environment.apiUrl}/people/checklist-templates/tmpl-1`).flush(mockDetail('tmpl-1', 'Company Default Onboarding'));
    await Promise.resolve();
    expect(store.selectedTemplateId()).toBe('tmpl-1');

    const loadPromise = store.loadChecklistTemplateMatches();
    httpMock
      .expectOne((r) => r.url.includes('/onboarding/checklist-templates/matches'))
      .flush([
        { id: 'tmpl-1', name: 'Company Default Onboarding', matchLevel: 'company', departmentId: null, positionId: null },
        { id: 'tmpl-2', name: 'Dept Onboarding', matchLevel: 'department', departmentId: 'dept-1', positionId: null }
      ]);
    await loadPromise;

    expect(store.selectedTemplateId()).toBe('tmpl-1');
    // Detail for tmpl-1 was already cached from the explicit select above - reselecting it via matches must not re-fetch.
    httpMock.expectNone(`${environment.apiUrl}/people/checklist-templates/tmpl-1`);
    expect(store.selectedTemplateDetail()?.id).toBe('tmpl-1');
  });

  it('loadChecklistTemplateMatches sets checklistTemplatesUnavailable true when the response is empty', async () => {
    store.setCompany('le-1');
    httpMock.expectOne((r) => r.url.includes('/departments')).flush({ items: [], page: 1, pageSize: 25, totalCount: 0, totalPages: 0 });
    await Promise.resolve();

    const loadPromise = store.loadChecklistTemplateMatches();
    httpMock.expectOne((r) => r.url.includes('/onboarding/checklist-templates/matches')).flush([]);
    await loadPromise;

    expect(store.checklistTemplatesUnavailable()).toBe(true);
    expect(store.checklistTemplateMatches()).toEqual([]);
    expect(store.selectedTemplateId()).toBeNull();
  });

  it('loadChecklistTemplateMatches does not call the API when companyId is missing and sets empty state safely', async () => {
    const loadPromise = store.loadChecklistTemplateMatches();
    await loadPromise;

    httpMock.expectNone((r) => r.url.includes('/onboarding/checklist-templates/matches'));
    expect(store.checklistTemplatesUnavailable()).toBe(true);
    expect(store.loadingChecklistTemplates()).toBe(false);
    expect(store.checklistTemplateMatches()).toEqual([]);
  });

  it('loadChecklistTemplateMatches sets a safe error message on API failure and does not loop', async () => {
    store.setCompany('le-1');
    httpMock.expectOne((r) => r.url.includes('/departments')).flush({ items: [], page: 1, pageSize: 25, totalCount: 0, totalPages: 0 });
    await Promise.resolve();

    const loadPromise = store.loadChecklistTemplateMatches();
    httpMock
      .expectOne((r) => r.url.includes('/onboarding/checklist-templates/matches'))
      .flush('Error', { status: 500, statusText: 'Internal Error' });
    await loadPromise;

    expect(store.loadingChecklistTemplates()).toBe(false);
    expect(store.checklistTemplatesError()).toBe('Something went wrong while saving your changes.');
    httpMock.expectNone((r) => r.url.includes('/onboarding/checklist-templates/matches'));
  });

  it('saveDraft refuses to call API when companyId is missing', async () => {
    store.updateFormValue({ firstName: 'Ada', lastName: 'Lovelace', workEmail: 'ada@test.dev', employmentType: 'full_time', startDate: '2026-08-10', workModeId: 'wm-1' });
    const result = await store.saveDraft('employee_details');
    expect(result).toBeNull();
    expect(store.saveError()).toBe('Select a company before saving a draft.');
    httpMock.expectNone(`${environment.apiUrl}/onboarding/drafts`);
  });

  it('partial save sends only what is filled and skips the full-form pre-checks', async () => {
    store.setCompany('le-1');
    httpMock.expectOne((r) => r.url.includes('/departments')).flush({ items: [], page: 1, pageSize: 25, totalCount: 0, totalPages: 0 });
    await Promise.resolve();

    store.updateFormValue({ firstName: 'Jane', lastName: '', workEmail: '', employmentType: '', startDate: '', workModeId: null });
    const savePromise = store.saveDraft('employee_details', { partial: true });

    const req = httpMock.expectOne(`${environment.apiUrl}/onboarding/drafts`);
    expect(req.request.body).toEqual(expect.objectContaining({
      firstName: 'Jane',
      lastName: null,
      workEmail: null,
      employmentType: null,
      startDate: null,
      workModeId: null,
      editedTasksJson: null
    }));
    req.flush(mockDraft);
    const response = await savePromise;
    expect(response).not.toBeNull();
  });

  it('non-partial save still requires a work mode', async () => {
    store.setCompany('le-1');
    httpMock.expectOne((r) => r.url.includes('/departments')).flush({ items: [], page: 1, pageSize: 25, totalCount: 0, totalPages: 0 });
    await Promise.resolve();

    store.updateFormValue({ firstName: 'Jane', lastName: '', workEmail: '', employmentType: '', startDate: '', workModeId: null });
    const result = await store.saveDraft('employee_details');
    expect(result).toBeNull();
    expect(store.saveError()).toBe('Work mode is required.');
  });

  it('saveDraft sends firstName, lastName, workModeId and never sends employeeName or scheduleId', async () => {
    store.setCompany('le-1');
    httpMock.expectOne((r) => r.url.includes('/departments')).flush({ items: [], page: 1, pageSize: 25, totalCount: 0, totalPages: 0 });
    await Promise.resolve();
    store.syncSelectionFromForm('dept-1', 'pos-1');
    store.updateFormValue({ firstName: 'Ada', lastName: 'Lovelace', workEmail: 'ada@test.dev', employmentType: 'full_time', startDate: '2026-08-10', workModeId: 'wm-1' });
    const savePromise = store.saveDraft('employee_details');

    const req = httpMock.expectOne(`${environment.apiUrl}/onboarding/drafts`);
    expect(req.request.body.firstName).toBe('Ada');
    expect(req.request.body.lastName).toBe('Lovelace');
    expect(req.request.body.workModeId).toBe('wm-1');
    expect(req.request.body.employeeName).toBeUndefined();
    expect(req.request.body.scheduleId).toBeUndefined();
    req.flush(mockDraft);
    await savePromise;
  });

  it('saveDraft sends the selected checklist template id', async () => {
    store.setCompany('le-1');
    httpMock.expectOne((r) => r.url.includes('/departments')).flush({ items: [], page: 1, pageSize: 25, totalCount: 0, totalPages: 0 });
    await Promise.resolve();
    store.syncSelectionFromForm('dept-1', 'pos-1');

    store.selectChecklistTemplate('tmpl-1');
    httpMock.expectOne(`${environment.apiUrl}/people/checklist-templates/tmpl-1`).flush(mockDetail('tmpl-1', 'Company Default Onboarding'));
    await Promise.resolve();
    expect(store.selectedTemplateId()).toBe('tmpl-1');

    store.updateFormValue({ firstName: 'Ada', lastName: 'Lovelace', workEmail: 'ada@test.dev', employmentType: 'full_time', startDate: '2026-08-10', workModeId: 'wm-1' });
    const savePromise = store.saveDraft('checklist_template');

    const req = httpMock.expectOne(`${environment.apiUrl}/onboarding/drafts`);
    expect(req.request.body.selectedTemplateId).toBe('tmpl-1');
    expect(req.request.body.editedTasksJson).toBe('[]');
    req.flush(mockDraft);
    await savePromise;
  });

  it('saveDraft sends editedTasksJson null when no checklist selected', async () => {
    store.setCompany('le-1');
    httpMock.expectOne((r) => r.url.includes('/departments')).flush({ items: [], page: 1, pageSize: 25, totalCount: 0, totalPages: 0 });
    await Promise.resolve();
    store.syncSelectionFromForm('dept-1', 'pos-1');
    store.updateFormValue({ firstName: 'Ada', lastName: 'Lovelace', workEmail: 'ada@test.dev', employmentType: 'full_time', startDate: '2026-08-10', workModeId: 'wm-1' });
    const savePromise = store.saveDraft('employee_details');

    const req = httpMock.expectOne(`${environment.apiUrl}/onboarding/drafts`);
    expect(req.request.body.selectedTemplateId).toBeNull();
    expect(req.request.body.editedTasksJson).toBeNull();
    req.flush(mockDraft);
    await savePromise;
  });

  it('selecting a checklist copies template tasks into draft-local editable task state', async () => {
    store.selectChecklistTemplate('tmpl-1');
    httpMock.expectOne(`${environment.apiUrl}/people/checklist-templates/tmpl-1`).flush({
      ...mockDetail('tmpl-1', 'Onboarding'),
      tasks: [
        { title: 'Sign paperwork', ownerType: 'employee', assignedToId: null, dueOffsetDays: 0, sequence: 1, isRequired: true, isBypassable: false, bypassPenaltyDescription: null, category: null },
        { title: 'Provision laptop', ownerType: 'it', assignedToId: 'user-9', dueOffsetDays: 2, sequence: 2, isRequired: false, isBypassable: false, bypassPenaltyDescription: null, category: null }
      ]
    });
    await Promise.resolve();

    expect(store.draftTasks().length).toBe(2);
    expect(store.draftTasks()[0].title).toBe('Sign paperwork');
    expect(store.draftTasks()[0].assignee).toBe('employee');
    expect(store.draftTasks()[0].dueDays).toBe(0);
    expect(store.draftTasks()[1].title).toBe('Provision laptop');
    expect(store.draftTasks()[1].assignee).toBe('another');
    expect(store.draftTasks()[1].dueDays).toBe(2);
  });

  it('editing a draft-local task does not mutate selectedTemplateDetail.tasks', async () => {
    store.selectChecklistTemplate('tmpl-1');
    httpMock.expectOne(`${environment.apiUrl}/people/checklist-templates/tmpl-1`).flush({
      ...mockDetail('tmpl-1', 'Onboarding'),
      tasks: [{ title: 'Sign paperwork', ownerType: 'employee', assignedToId: null, dueOffsetDays: 0, sequence: 1, isRequired: true, isBypassable: false, bypassPenaltyDescription: null, category: null }]
    });
    await Promise.resolve();

    const clientId = store.draftTasks()[0].clientId;
    store.updateDraftTask(clientId, { title: 'Sign paperwork (updated)' });

    expect(store.draftTasks()[0].title).toBe('Sign paperwork (updated)');
    expect(store.selectedTemplateDetail()?.tasks[0].title).toBe('Sign paperwork');
  });

  it('saveDraft sends selectedTemplateId and editedTasksJson reflecting draft-local task edits', async () => {
    store.setCompany('le-1');
    httpMock.expectOne((r) => r.url.includes('/departments')).flush({ items: [], page: 1, pageSize: 25, totalCount: 0, totalPages: 0 });
    await Promise.resolve();
    store.syncSelectionFromForm('dept-1', 'pos-1');
    store.selectChecklistTemplate('tmpl-1');
    httpMock.expectOne(`${environment.apiUrl}/people/checklist-templates/tmpl-1`).flush({
      ...mockDetail('tmpl-1', 'Onboarding'),
      tasks: [{ title: 'Sign paperwork', ownerType: 'employee', assignedToId: null, dueOffsetDays: 3, sequence: 1, isRequired: true, isBypassable: false, bypassPenaltyDescription: null, category: null }]
    });
    await Promise.resolve();

    store.updateFormValue({ firstName: 'Ada', lastName: 'Lovelace', workEmail: 'ada@test.dev', employmentType: 'full_time', startDate: '2026-08-10', workModeId: 'wm-1' });
    const savePromise = store.saveDraft('checklist_template');

    const req = httpMock.expectOne(`${environment.apiUrl}/onboarding/drafts`);
    expect(req.request.body.selectedTemplateId).toBe('tmpl-1');
    expect(JSON.parse(req.request.body.editedTasksJson)).toEqual([
      { title: 'Sign paperwork', dueDate: '2026-08-13', sequence: 1, isRequired: true, ownerType: 'employee' }
    ]);
    req.flush(mockDraft);
    await savePromise;
  });

  it('changing selected checklist resets draft-local tasks from the newly selected template', async () => {
    store.selectChecklistTemplate('tmpl-1');
    httpMock.expectOne(`${environment.apiUrl}/people/checklist-templates/tmpl-1`).flush({
      ...mockDetail('tmpl-1', 'Onboarding A'),
      tasks: [{ title: 'Task A', ownerType: 'employee', assignedToId: null, dueOffsetDays: 0, sequence: 1, isRequired: true, isBypassable: false, bypassPenaltyDescription: null, category: null }]
    });
    await Promise.resolve();
    expect(store.draftTasks()[0].title).toBe('Task A');

    store.selectChecklistTemplate('tmpl-2');
    expect(store.draftTasks()).toEqual([]);

    httpMock.expectOne(`${environment.apiUrl}/people/checklist-templates/tmpl-2`).flush({
      ...mockDetail('tmpl-2', 'Onboarding B'),
      tasks: [{ title: 'Task B', ownerType: 'employee', assignedToId: null, dueOffsetDays: 1, sequence: 1, isRequired: true, isBypassable: false, bypassPenaltyDescription: null, category: null }]
    });
    await Promise.resolve();

    expect(store.draftTasks().length).toBe(1);
    expect(store.draftTasks()[0].title).toBe('Task B');
  });

  it('resuming draft restores selectedTemplateId and editedTasksJson', async () => {
    const draftWithTasks: OnboardingDraftResponse = {
      ...mockDraft,
      selectedTemplateId: 'tmpl-1',
      editedTasksJson: JSON.stringify([{ title: 'Custom task', ownerType: 'employee', dueDate: '2026-08-12', sequence: 1, isRequired: true, isBypassable: false, bypassPenaltyDescription: null, category: null }])
    };
    const resumePromise = store.resumeDraft('draft-1');
    httpMock.expectOne(`${environment.apiUrl}/onboarding/drafts/draft-1`).flush(draftWithTasks);
    await Promise.resolve();
    await Promise.resolve();
    httpMock.expectOne((r) => r.url.includes('/departments')).flush({ items: [], page: 1, pageSize: 25, totalCount: 0, totalPages: 0 });
    await Promise.resolve();
    await Promise.resolve();
    httpMock.expectOne((r) => r.url.includes('/positions')).flush({ items: [], page: 1, pageSize: 25, totalCount: 0, totalPages: 0 });
    await Promise.resolve();
    await Promise.resolve();
    const matchesReq = httpMock.expectOne((r) => r.url.includes('/onboarding/checklist-templates/matches'));
    matchesReq.flush([{ id: 'tmpl-1', name: 'Onboarding', matchLevel: 'company', departmentId: null, positionId: null }]);
    await Promise.resolve();
    httpMock.expectOne(`${environment.apiUrl}/people/checklist-templates/tmpl-1`).flush(mockDetail('tmpl-1', 'Onboarding'));
    await resumePromise;

    expect(store.selectedTemplateId()).toBe('tmpl-1');
    expect(store.draftTasks().length).toBe(1);
    expect(store.draftTasks()[0].title).toBe('Custom task');
    // dueDate 2026-08-12 minus the draft's startDate 2026-08-10 = a 2-day offset.
    expect(store.draftTasks()[0].dueDays).toBe(2);
  });

  it('resuming draft with editedTasksJson does not overwrite edits from template detail reload', async () => {
    const draftWithTasks: OnboardingDraftResponse = {
      ...mockDraft,
      selectedTemplateId: 'tmpl-1',
      editedTasksJson: JSON.stringify([{ title: 'HR-edited task', ownerType: 'employee', dueDate: '2026-08-11', sequence: 1, isRequired: true, isBypassable: false, bypassPenaltyDescription: null, category: null }])
    };
    const resumePromise = store.resumeDraft('draft-1');
    httpMock.expectOne(`${environment.apiUrl}/onboarding/drafts/draft-1`).flush(draftWithTasks);
    await Promise.resolve();
    await Promise.resolve();
    httpMock.expectOne((r) => r.url.includes('/departments')).flush({ items: [], page: 1, pageSize: 25, totalCount: 0, totalPages: 0 });
    await Promise.resolve();
    await Promise.resolve();
    httpMock.expectOne((r) => r.url.includes('/positions')).flush({ items: [], page: 1, pageSize: 25, totalCount: 0, totalPages: 0 });
    await Promise.resolve();
    await Promise.resolve();
    const matchesReq = httpMock.expectOne((r) => r.url.includes('/onboarding/checklist-templates/matches'));
    matchesReq.flush([{ id: 'tmpl-1', name: 'Onboarding', matchLevel: 'company', departmentId: null, positionId: null }]);
    await Promise.resolve();
    // The template's own current tasks are deliberately different from the restored edits - if
    // the detail load re-seeded draftTasks, this is what it would incorrectly flip to.
    httpMock.expectOne(`${environment.apiUrl}/people/checklist-templates/tmpl-1`).flush({
      ...mockDetail('tmpl-1', 'Onboarding'),
      tasks: [{ title: 'Template original task', ownerType: 'employee', assignedToId: null, dueOffsetDays: 0, sequence: 1, isRequired: true, isBypassable: false, bypassPenaltyDescription: null, category: null }]
    });
    await resumePromise;

    expect(store.draftTasks().length).toBe(1);
    expect(store.draftTasks()[0].title).toBe('HR-edited task');
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

  it('selectChecklistTemplate stores selectedTemplateId and loads its detail via GET /people/checklist-templates/{id}', async () => {
    store.selectChecklistTemplate('tmpl-1');
    expect(store.selectedTemplateId()).toBe('tmpl-1');
    expect(store.loadingSelectedTemplateDetail()).toBe(true);

    const req = httpMock.expectOne(`${environment.apiUrl}/people/checklist-templates/tmpl-1`);
    expect(req.request.method).toBe('GET');
    req.flush(mockDetail('tmpl-1', 'Company Default Onboarding'));
    await Promise.resolve();

    expect(store.loadingSelectedTemplateDetail()).toBe(false);
    expect(store.selectedTemplateDetail()?.id).toBe('tmpl-1');
    expect(store.selectedTemplateDetail()?.name).toBe('Company Default Onboarding');
    expect(store.selectedTemplateDetailError()).toBeNull();
  });

  it('does not repeatedly fetch detail for the same selected id', async () => {
    store.selectChecklistTemplate('tmpl-1');
    httpMock.expectOne(`${environment.apiUrl}/people/checklist-templates/tmpl-1`).flush(mockDetail('tmpl-1', 'Company Default Onboarding'));
    await Promise.resolve();

    // Reselecting the same id is a no-op; explicitly re-requesting the same id hits the cache.
    store.selectChecklistTemplate('tmpl-1');
    await store.loadSelectedTemplateDetail('tmpl-1');

    httpMock.expectNone(`${environment.apiUrl}/people/checklist-templates/tmpl-1`);
    expect(store.selectedTemplateDetail()?.id).toBe('tmpl-1');
  });

  it('sets a safe error message when the detail request fails', async () => {
    store.selectChecklistTemplate('tmpl-1');
    httpMock.expectOne(`${environment.apiUrl}/people/checklist-templates/tmpl-1`).flush('Error', { status: 500, statusText: 'Internal Error' });
    await Promise.resolve();

    expect(store.loadingSelectedTemplateDetail()).toBe(false);
    expect(store.selectedTemplateDetail()).toBeNull();
    expect(store.selectedTemplateDetailError()).toBe('Something went wrong while saving your changes.');
  });

  it('clears selectedTemplateId and selectedTemplateDetail when the department changes', async () => {
    store.setCompany('le-1');
    httpMock.expectOne((r) => r.url.includes('/departments')).flush({ items: [], page: 1, pageSize: 25, totalCount: 0, totalPages: 0 });
    await Promise.resolve();

    store.selectChecklistTemplate('tmpl-1');
    httpMock.expectOne(`${environment.apiUrl}/people/checklist-templates/tmpl-1`).flush(mockDetail('tmpl-1', 'Company Default Onboarding'));
    await Promise.resolve();
    expect(store.selectedTemplateId()).toBe('tmpl-1');
    expect(store.selectedTemplateDetail()).not.toBeNull();

    store.setDepartment('dept-1');
    httpMock.expectOne((r) => r.url.includes('/positions')).flush({ items: [], page: 1, pageSize: 25, totalCount: 0, totalPages: 0 });
    await Promise.resolve();

    expect(store.selectedTemplateId()).toBeNull();
    expect(store.selectedTemplateDetail()).toBeNull();
  });

  it('never calls the checklist template create/update APIs while selecting, editing, or saving a checklist', async () => {
    store.setCompany('le-1');
    httpMock.expectOne((r) => r.url.includes('/departments')).flush({ items: [], page: 1, pageSize: 25, totalCount: 0, totalPages: 0 });
    await Promise.resolve();
    store.syncSelectionFromForm('dept-1', 'pos-1');
    store.selectChecklistTemplate('tmpl-1');
    httpMock.expectOne(`${environment.apiUrl}/people/checklist-templates/tmpl-1`).flush({
      ...mockDetail('tmpl-1', 'Onboarding'),
      tasks: [{ title: 'Sign paperwork', ownerType: 'employee', assignedToId: null, dueOffsetDays: 0, sequence: 1, isRequired: true, isBypassable: false, bypassPenaltyDescription: null, category: null }]
    });
    await Promise.resolve();

    const clientId = store.draftTasks()[0].clientId;
    store.updateDraftTask(clientId, { title: 'Edited title' });

    store.updateFormValue({ firstName: 'Ada', lastName: 'Lovelace', workEmail: 'ada@test.dev', employmentType: 'full_time', startDate: '2026-08-10', workModeId: 'wm-1' });
    const savePromise = store.saveDraft('checklist_template');
    httpMock.expectOne(`${environment.apiUrl}/onboarding/drafts`).flush(mockDraft);
    await savePromise;

    // getChecklistTemplate above was a GET - the wizard never issues a write against the template itself.
    httpMock.expectNone((r) => r.method === 'PUT');
    httpMock.expectNone((r) => r.url === `${environment.apiUrl}/people/checklist-templates` && r.method === 'POST');
  });

  it('clears selectedTemplateId and selectedTemplateDetail when the position changes', async () => {
    store.setCompany('le-1');
    httpMock.expectOne((r) => r.url.includes('/departments')).flush({ items: [], page: 1, pageSize: 25, totalCount: 0, totalPages: 0 });
    await Promise.resolve();
    store.setDepartment('dept-1');
    httpMock.expectOne((r) => r.url.includes('/positions')).flush({ items: [], page: 1, pageSize: 25, totalCount: 0, totalPages: 0 });
    await Promise.resolve();

    store.selectChecklistTemplate('tmpl-1');
    httpMock.expectOne(`${environment.apiUrl}/people/checklist-templates/tmpl-1`).flush(mockDetail('tmpl-1', 'Company Default Onboarding'));
    await Promise.resolve();
    expect(store.selectedTemplateId()).toBe('tmpl-1');

    store.setPosition('pos-1');

    expect(store.selectedTemplateId()).toBeNull();
    expect(store.selectedTemplateDetail()).toBeNull();
  });

  it('setPosition loads active holders and needsReportsToPick reflects holder count', async () => {
    store.setCompany('le-1');
    httpMock.expectOne((r) => r.url.includes('/departments')).flush({ items: [], page: 1, pageSize: 25, totalCount: 0, totalPages: 0 });
    await Promise.resolve();

    const setPositionPromise = store.setPosition('position-1', 'reports-to-position-1');
    const req = httpMock.expectOne(
      `${environment.apiUrl}/org/legal-entities/le-1/positions/reports-to-position-1/active-holders`
    );
    req.flush([
      { employeeId: 'a', firstName: 'A', lastName: 'One', workEmail: 'a@acme.test', avatarFileId: null },
      { employeeId: 'b', firstName: 'B', lastName: 'Two', workEmail: 'b@acme.test', avatarFileId: null }
    ]);
    await Promise.resolve();
    httpMock
      .expectOne((r) => r.url.endsWith('/onboarding/drafts/reporting-chain') && r.params.get('managerEmployeeId') === 'a')
      .flush([]);
    await setPositionPromise;

    expect(store.needsReportsToPick()).toBe(true);
    expect(store.activeHolders().length).toBe(2);
    // Several holders: the first one is pre-selected as the default manager, still changeable.
    expect(store.selectedReportsToEmployeeId()).toBe('a');
    expect(store.effectiveManagerId()).toBe('a');
  });

  it('changing the reports-to pick reloads the reporting chain for the new manager', async () => {
    store.setCompany('le-1');
    httpMock.expectOne((r) => r.url.includes('/departments')).flush({ items: [], page: 1, pageSize: 25, totalCount: 0, totalPages: 0 });
    await Promise.resolve();

    const setPositionPromise = store.setPosition('position-1', 'reports-to-position-1');
    httpMock
      .expectOne(`${environment.apiUrl}/org/legal-entities/le-1/positions/reports-to-position-1/active-holders`)
      .flush([
        { employeeId: 'a', firstName: 'A', lastName: 'One', workEmail: 'a@acme.test', avatarFileId: null },
        { employeeId: 'b', firstName: 'B', lastName: 'Two', workEmail: 'b@acme.test', avatarFileId: null }
      ]);
    await Promise.resolve();
    httpMock.expectOne((r) => r.url.endsWith('/onboarding/drafts/reporting-chain')).flush([]);
    await setPositionPromise;

    store.setReportsToEmployeeId('b');
    const chainReq = httpMock.expectOne(
      (r) => r.url.endsWith('/onboarding/drafts/reporting-chain') && r.params.get('managerEmployeeId') === 'b'
    );
    chainReq.flush([
      { employeeId: 'ceo', firstName: 'Taylor', lastName: 'Reed', positionName: 'CEO', departmentName: null },
      { employeeId: 'b', firstName: 'B', lastName: 'Two', positionName: 'Team Lead', departmentName: 'Eng' }
    ]);
    await Promise.resolve();

    expect(store.reportingChain().map((n) => n.employeeId)).toEqual(['ceo', 'b']);
  });

  it('clock-in overrides stay null unless changed away from the inherited default', async () => {
    store.setCompany('le-1');
    httpMock.expectOne((r) => r.url.includes('/departments')).flush({ items: [], page: 1, pageSize: 25, totalCount: 0, totalPages: 0 });
    await Promise.resolve();

    const loadPromise = store.loadClockInDefaults('wm-1');
    httpMock
      .expectOne((r) => r.url.endsWith('/onboarding/drafts/clock-in-defaults') && r.params.get('workModeId') === 'wm-1')
      .flush({ photoRequired: true, locationCapture: false });
    await loadPromise;

    store.setPhotoRequiredOverride(true);
    expect(store.photoRequiredOverride()).toBeNull();

    store.setPhotoRequiredOverride(false);
    expect(store.photoRequiredOverride()).toBe(false);
    expect(store.effectivePhotoRequired()).toBe(false);

    store.setLocationCaptureOverride(true);
    expect(store.locationCaptureOverride()).toBe(true);
    expect(store.effectiveLocationCapture()).toBe(true);

    store.clearClockInOverrides();
    expect(store.photoRequiredOverride()).toBeNull();
    expect(store.locationCaptureOverride()).toBeNull();
    expect(store.effectivePhotoRequired()).toBe(true);
  });

  it('needsReportsToPick is false when the target position has a single holder', async () => {
    store.setCompany('le-1');
    httpMock.expectOne((r) => r.url.includes('/departments')).flush({ items: [], page: 1, pageSize: 25, totalCount: 0, totalPages: 0 });
    await Promise.resolve();

    const setPositionPromise = store.setPosition('position-1', 'reports-to-position-1');
    const req = httpMock.expectOne(
      `${environment.apiUrl}/org/legal-entities/le-1/positions/reports-to-position-1/active-holders`
    );
    req.flush([{ employeeId: 'a', firstName: 'A', lastName: 'One', workEmail: 'a@acme.test', avatarFileId: null }]);
    await Promise.resolve();
    httpMock.expectOne((r) => r.url.endsWith('/onboarding/drafts/reporting-chain')).flush([]);
    await setPositionPromise;

    expect(store.needsReportsToPick()).toBe(false);
    // A single holder is the manager implicitly - nothing is sent as an explicit pick.
    expect(store.selectedReportsToEmployeeId()).toBeNull();
    expect(store.effectiveManagerId()).toBe('a');

    // Clicking that only holder still stores no explicit pick, so the line keeps following the
    // position (a later replacement in the role becomes the manager automatically).
    store.setReportsToEmployeeId('a');
    httpMock.expectOne((r) => r.url.endsWith('/onboarding/drafts/reporting-chain')).flush([]);
    expect(store.selectedReportsToEmployeeId()).toBeNull();
    expect(store.effectiveManagerId()).toBe('a');
  });
});
