import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { PeopleApiService } from './people-api.service';
import { EmployeeListItemResponse, EmployeeListPageResponse } from '../models/employee.model';
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
    employeeName: 'Ada Lovelace',
    workEmail: 'ada@test.dev',
    legalEntityId: 'le-1',
    departmentId: null,
    positionId: null,
    employmentType: 'full_time',
    startDate: '2026-08-10',
    employeeNumber: null,
    scheduleId: null,
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

  it('POSTs to create a new draft when draftId is absent, with an Idempotency-Key header', () => {
    const payload: SaveOnboardingDraftPayload = {
      employeeName: 'Ada Lovelace',
      workEmail: 'ada@test.dev',
      legalEntityId: 'le-1',
      departmentId: null,
      positionId: null,
      employmentType: 'full_time',
      startDate: '2026-08-10',
      employeeNumber: null,
      scheduleId: null,
      selectedTemplateId: null,
      editedTasksJson: null,
      lastSavedStep: 'employee_details'
    };

    service.saveDraft(payload, null).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/onboarding/drafts`);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.has('Idempotency-Key')).toBe(true);
    expect(req.request.body.draftId).toBeUndefined();
    req.flush(mockDraft);
  });

  it('PUTs with If-Match when draftId and an expected version are present', () => {
    const payload: SaveOnboardingDraftPayload = {
      draftId: 'draft-1',
      employeeName: 'Ada Lovelace',
      workEmail: 'ada@test.dev',
      legalEntityId: 'le-1',
      departmentId: null,
      positionId: null,
      employmentType: 'full_time',
      startDate: '2026-08-10',
      employeeNumber: null,
      scheduleId: null,
      selectedTemplateId: null,
      editedTasksJson: null,
      lastSavedStep: 'checklist_template'
    };

    service.saveDraft(payload, '1').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/onboarding/drafts/draft-1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.headers.get('If-Match')).toBe('1');
    req.flush(mockDraft);
  });
});
