import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { PeopleApiService } from './people-api.service';
import { EmployeeDetailResponse, EmployeeListItemResponse, EmployeeListPageResponse } from '../models/employee.model';
import { OnboardingDraftResponse, SaveOnboardingDraftPayload } from '../models/onboarding-draft.model';

describe('PeopleApiService', () => {
  let service: PeopleApiService;
  let httpMock: HttpTestingController;

  const mockEmployeePage: EmployeeListPageResponse = {
    items: [],
    totalCount: 0,
    page: 1,
    pageSize: 25
  };

  const mockEmployee: EmployeeListItemResponse = {
    id: 'emp-1',
    employeeNumber: 'E-001',
    fullName: 'Ada Lovelace',
    email: 'ada@test.dev',
    departmentId: null,
    departmentName: null,
    positionId: null,
    positionName: null,
    legalEntityId: null,
    legalEntityName: null,
    employmentTypeLabel: 'Full-time',
    status: 'active',
    reportingManagerId: null,
    reportingManagerName: null
  };

  const mockDraft: OnboardingDraftResponse = {
    id: 'draft-1',
    firstName: 'Ada',
    lastName: 'Lovelace',
    workEmail: 'ada@test.dev',
    legalEntityId: 'le-1',
    departmentId: null,
    positionId: null,
    employmentType: 'full_time',
    startDate: '2026-08-10',
    employeeNumber: null,
    workModeId: 1,
    selectedTemplateId: null,
    editedTasksJson: null,
    status: 'waiting_for_seat',
    draftReason: 'waiting_for_seat',
    lastSavedStep: 'employee_details',
    startedById: 'user-1',
    version: '1'
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PeopleApiService, provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(PeopleApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('fetches work modes from /work-modes', () => {
    service.getWorkModes().subscribe((modes) => {
      expect(modes.length).toBe(1);
      expect(modes[0].code).toBe('on_site');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/work-modes`);
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 1, code: 'on_site', label: 'On-Site' }]);
  });

  it('lists employees with query params', () => {
    service.listEmployees({ search: 'ada', page: 1, pageSize: 25 }).subscribe((page) => {
      expect(page).toEqual(mockEmployeePage);
    });

    const req = httpMock.expectOne(
      (r) => r.url === `${environment.apiUrl}/employees` && r.params.get('search') === 'ada'
    );
    expect(req.request.method).toBe('GET');
    req.flush(mockEmployeePage);
  });

  it('omits empty/undefined query params', () => {
    service.listEmployees({}).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/employees`);
    expect(req.request.params.keys().length).toBe(0);
    req.flush(mockEmployeePage);
  });

  it('fetches a single employee by id', () => {
    service.getEmployee('emp-1').subscribe((employee) => {
      expect(employee).toEqual(mockEmployee);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/employees/emp-1`);
    expect(req.request.method).toBe('GET');
    req.flush(mockEmployee);
  });

  it('lists onboarding drafts', () => {
    service.listDrafts({ page: 1, pageSize: 25 }).subscribe();

    const req = httpMock.expectOne(
      (r) => r.url === `${environment.apiUrl}/onboarding/drafts` && r.params.get('page') === '1'
    );
    expect(req.request.method).toBe('GET');
    req.flush({ items: [], totalCount: 0, page: 1, pageSize: 25 });
  });

  it('fetches a single draft by id', () => {
    service.getDraft('draft-1').subscribe((draft) => {
      expect(draft).toEqual(mockDraft);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/onboarding/drafts/draft-1`);
    expect(req.request.method).toBe('GET');
    req.flush(mockDraft);
  });

  it('POSTs to create a new draft with firstName, lastName, workModeId and omits employeeName & scheduleId', () => {
    const payload: SaveOnboardingDraftPayload = {
      firstName: 'Ada',
      lastName: 'Lovelace',
      workEmail: 'ada@test.dev',
      legalEntityId: 'le-1',
      departmentId: null,
      positionId: null,
      employmentType: 'full_time',
      startDate: '2026-08-10',
      employeeNumber: null,
      workModeId: 1,
      selectedTemplateId: null,
      editedTasksJson: null,
      lastSavedStep: 'employee_details'
    };

    service.saveDraft(payload, null).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/onboarding/drafts`);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.has('Idempotency-Key')).toBe(true);
    expect(req.request.body.firstName).toBe('Ada');
    expect(req.request.body.lastName).toBe('Lovelace');
    expect(req.request.body.workModeId).toBe(1);
    expect(req.request.body.employeeName).toBeUndefined();
    expect(req.request.body.scheduleId).toBeUndefined();
    req.flush(mockDraft);
  });

  it('PUTs with If-Match when draftId and expected version are present', () => {
    const payload: SaveOnboardingDraftPayload = {
      draftId: 'draft-1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      workEmail: 'ada@test.dev',
      legalEntityId: 'le-1',
      departmentId: null,
      positionId: null,
      employmentType: 'full_time',
      startDate: '2026-08-10',
      employeeNumber: null,
      workModeId: 1,
      selectedTemplateId: null,
      editedTasksJson: null,
      lastSavedStep: 'checklist_template'
    };

    service.saveDraft(payload, '1').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/onboarding/drafts/draft-1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.headers.get('If-Match')).toBe('1');
    expect(req.request.body.firstName).toBe('Ada');
    expect(req.request.body.lastName).toBe('Lovelace');
    expect(req.request.body.workModeId).toBe(1);
    expect(req.request.body.employeeName).toBeUndefined();
    expect(req.request.body.scheduleId).toBeUndefined();
    req.flush(mockDraft);
  });

  it('POSTs to finalize draft endpoint', () => {
    service.finalizeDraft('draft-1').subscribe((res) => {
      expect(res.draftId).toBe('draft-1');
    });

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
  });

  it('POSTs to approve access grant request endpoint', () => {
    service.approveAccessGrantRequest('req-1').subscribe((res) => {
      expect(res.accessGrantRequestId).toBe('req-1');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/onboarding/access-grant-requests/req-1/approve-and-send-invite`);
    expect(req.request.method).toBe('POST');
    req.flush({
      accessGrantRequestId: 'req-1',
      onboardingDraftId: 'draft-1',
      employeeId: 'emp-1',
      finalizationStatus: 'finalized',
      invitationQueued: true,
      checklistTaskCount: 3,
      positionApprovalStatus: 'Approved',
      messageKey: 'approved'
    });
  });

  it('POSTs to reject access grant request endpoint with decisionNote', () => {
    service.rejectAccessGrantRequest('req-1', { decisionNote: 'Position budget reduced' }).subscribe((res) => {
      expect(res.requestStatus).toBe('Rejected');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/onboarding/access-grant-requests/req-1/reject`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.decisionNote).toBe('Position budget reduced');
    req.flush({
      accessGrantRequestId: 'req-1',
      onboardingDraftId: 'draft-1',
      requestStatus: 'Rejected',
      draftStatus: 'draft',
      draftReason: 'position_approval_rejected',
      messageKey: 'rejected'
    });
  });

  it('getEmployeeDetail sends GET to /employees/{id}/detail', () => {
    service.getEmployeeDetail('emp-1').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/employees/emp-1/detail`);
    expect(req.request.method).toBe('GET');
    req.flush({} as EmployeeDetailResponse);
  });

  it('changePosition sends POST to /employees/{id}/change-position with the payload', () => {
    service.changePosition('emp-1', { positionId: 'pos-1', effectiveFrom: '2026-09-01' }).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/employees/emp-1/change-position`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ positionId: 'pos-1', effectiveFrom: '2026-09-01' });
    req.flush(null);
  });
});
