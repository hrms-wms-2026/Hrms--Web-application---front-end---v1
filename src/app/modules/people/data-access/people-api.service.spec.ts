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
    workModeId: '1',
    selectedTemplateId: null,
    editedTasksJson: null,
    status: 'waiting_for_seat',
    draftReason: 'waiting_for_seat',
    lastSavedStep: 'employee_details',
    startedById: 'user-1',
    reportsToEmployeeId: null,
    version: '1'
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PeopleApiService, provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(PeopleApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('sends repeated employmentType params for the list filter', () => {
    service.listEmployees({ employmentType: ['full_time', 'intern'], sortBy: 'name', sortDir: 'desc' }).subscribe();
    const req = httpMock.expectOne((r) => r.url.endsWith('/employees'));
    expect(req.request.params.getAll('employmentType')).toEqual(['full_time', 'intern']);
    expect(req.request.params.get('sortDir')).toBe('desc');
    req.flush({ items: [], totalCount: 0, page: 1, pageSize: 25 });
  });

  it('posts bulk actions to the bulk endpoints', () => {
    service.bulkChangeEmploymentType({ employeeIds: ['a'], employmentTypeCode: 'contract' }).subscribe();
    httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/employees/bulk/employment-type')).flush({ items: [], succeeded: 0, pendingApproval: 0, failed: 0 });
    service.bulkStartOffboarding({ employeeIds: ['a'], reason: 'resignation', lastWorkingDate: '2026-10-31', knowledgeRiskLevel: 'medium', rehireEligibility: null, notes: null }).subscribe();
    httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/employees/bulk/offboarding/start')).flush({ items: [], succeeded: 0, pendingApproval: 0, failed: 0 });
    service.bulkChangePosition({ employeeIds: ['a'], positionId: 'p', effectiveFrom: '2026-10-01', changeReason: 'Transfer', reportsToEmployeeId: null }).subscribe();
    httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/employees/bulk/change-position')).flush({ items: [], succeeded: 0, pendingApproval: 0, failed: 0 });
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('getWorkGraph GETs /employees/{id}/work-graph', () => {
    const response = { nodes: [], links: [], hiddenTaskCount: 0 };
    let received: unknown;

    service.getWorkGraph('emp-1').subscribe((r) => (received = r));

    const req = httpMock.expectOne(`${environment.apiUrl}/employees/emp-1/work-graph`);
    expect(req.request.method).toBe('GET');
    req.flush(response);
    expect(received).toEqual(response);
  });

  it('getOverviewAttendance GETs /employees/{id}/overview/attendance with from and to', () => {
    let received: unknown;
    service.getOverviewAttendance('emp-1', '2026-09-01', '2026-09-30').subscribe((r) => (received = r));

    const req = httpMock.expectOne(
      (r) => r.url === `${environment.apiUrl}/employees/emp-1/overview/attendance`
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('from')).toBe('2026-09-01');
    expect(req.request.params.get('to')).toBe('2026-09-30');
    req.flush({ days: [] });
    expect(received).toEqual({ days: [] });
  });

  it('getOverviewAttendanceDiscipline GETs /employees/{id}/overview/attendance-discipline with from and to', () => {
    service.getOverviewAttendanceDiscipline('emp-1', '2026-09-01', '2026-09-30').subscribe();

    const req = httpMock.expectOne(
      (r) => r.url === `${environment.apiUrl}/employees/emp-1/overview/attendance-discipline`
    );
    expect(req.request.params.get('from')).toBe('2026-09-01');
    expect(req.request.params.get('to')).toBe('2026-09-30');
    req.flush({});
  });

  it('getOverviewTimeOff GETs /employees/{id}/overview/time-off and sends year only when given', () => {
    service.getOverviewTimeOff('emp-1').subscribe();
    const noYear = httpMock.expectOne((r) => r.url === `${environment.apiUrl}/employees/emp-1/overview/time-off`);
    expect(noYear.request.params.has('year')).toBe(false);
    noYear.flush({});

    service.getOverviewTimeOff('emp-1', 2025).subscribe();
    const withYear = httpMock.expectOne((r) => r.url === `${environment.apiUrl}/employees/emp-1/overview/time-off`);
    expect(withYear.request.params.get('year')).toBe('2025');
    withYear.flush({});
  });

  const overviewUrl = (path: string) => (r: { url: string }) =>
    r.url === `${environment.apiUrl}/employees/emp-1/overview/${path}`;

  it('getOverviewWork GETs overview/work with from and to only', () => {
    service.getOverviewWork('emp-1', '2026-09-01', '2026-09-30').subscribe();

    const req = httpMock.expectOne(overviewUrl('work'));
    expect(req.request.params.get('from')).toBe('2026-09-01');
    expect(req.request.params.get('to')).toBe('2026-09-30');
    expect(req.request.params.has('compare')).toBe(false);
    req.flush({});
  });

  it.each([
    ['getOverviewDelivery', 'delivery'],
    ['getOverviewActivity', 'activity'],
    ['getOverviewAttendanceDiscipline', 'attendance-discipline']
  ] as const)('%s sends compare=previous only when asked', (method, path) => {
    const call = (compare?: boolean) =>
      (service[method] as (id: string, from: string, to: string, compare?: boolean) => any)
        .call(service, 'emp-1', '2026-09-01', '2026-09-30', compare);

    call().subscribe();
    const off = httpMock.expectOne(overviewUrl(path));
    expect(off.request.params.has('compare')).toBe(false);
    off.flush({});

    call(true).subscribe();
    const on = httpMock.expectOne(overviewUrl(path));
    expect(on.request.params.get('compare')).toBe('previous');
    expect(on.request.params.get('from')).toBe('2026-09-01');
    on.flush({});
  });

  it('getOverviewApprovals GETs overview/approvals with from and to', () => {
    service.getOverviewApprovals('emp-1', '2026-09-01', '2026-09-30').subscribe();

    const req = httpMock.expectOne(overviewUrl('approvals'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('from')).toBe('2026-09-01');
    req.flush({});
  });

  it('getOverviewUpcoming sends days and limit, defaulting to 14 and 10', () => {
    service.getOverviewUpcoming('emp-1').subscribe();
    const byDefault = httpMock.expectOne(overviewUrl('upcoming'));
    expect(byDefault.request.method).toBe('GET');
    expect(byDefault.request.params.get('days')).toBe('14');
    expect(byDefault.request.params.get('limit')).toBe('10');
    byDefault.flush({});

    service.getOverviewUpcoming('emp-1', 30, 3).subscribe();
    const custom = httpMock.expectOne(overviewUrl('upcoming'));
    expect(custom.request.params.get('days')).toBe('30');
    expect(custom.request.params.get('limit')).toBe('3');
    custom.flush({});
  });

  it('getOverviewChecklists GETs overview/checklists with no parameters', () => {
    service.getOverviewChecklists('emp-1').subscribe();

    const req = httpMock.expectOne(overviewUrl('checklists'));
    expect(req.request.params.keys()).toEqual([]);
    req.flush({});
  });

  it('getOverviewHistory sends limit, defaulting to 10', () => {
    service.getOverviewHistory('emp-1').subscribe();
    const byDefault = httpMock.expectOne(overviewUrl('history'));
    expect(byDefault.request.params.get('limit')).toBe('10');
    byDefault.flush({});

    service.getOverviewHistory('emp-1', 25).subscribe();
    const custom = httpMock.expectOne(overviewUrl('history'));
    expect(custom.request.params.get('limit')).toBe('25');
    custom.flush({});
  });

  it('getOverviewRecentActivity sends limit, and before only when given', () => {
    service.getOverviewRecentActivity('emp-1').subscribe();
    const first = httpMock.expectOne(overviewUrl('recent-activity'));
    expect(first.request.params.get('limit')).toBe('20');
    expect(first.request.params.has('before')).toBe(false);
    first.flush({});

    service.getOverviewRecentActivity('emp-1', '2026-09-20T00:00:00+00:00', 5).subscribe();
    const older = httpMock.expectOne(overviewUrl('recent-activity'));
    expect(older.request.params.get('before')).toBe('2026-09-20T00:00:00+00:00');
    // A literal '+' would reach ASP.NET as a space; the cursor's offset must be percent-encoded.
    expect(older.request.urlWithParams).toContain('before=2026-09-20T00:00:00%2B00:00');
    expect(older.request.params.get('limit')).toBe('5');
    older.flush({});

    service.getOverviewRecentActivity('emp-1', null).subscribe();
    expect(httpMock.expectOne(overviewUrl('recent-activity')).request.params.has('before')).toBe(false);
  });

  it('getOverviewSignals GETs /employees/{id}/overview/signals with the period', () => {
    service.getOverviewSignals('emp-1', '2026-09-01', '2026-09-30').subscribe();

    const req = httpMock.expectOne((r) => r.url.endsWith('/employees/emp-1/overview/signals'));
    expect(req.request.params.get('from')).toBe('2026-09-01');
    expect(req.request.params.get('to')).toBe('2026-09-30');
    req.flush({ from: '2026-09-01', to: '2026-09-30', signals: [] });
  });

  it('getOverviewSignalItems GETs /employees/{id}/overview/signals/{key}/items with the period', () => {
    service.getOverviewSignalItems('emp-1', 'over_break', '2026-09-01', '2026-09-30').subscribe();

    const req = httpMock.expectOne((r) => r.url.endsWith('/employees/emp-1/overview/signals/over_break/items'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('from')).toBe('2026-09-01');
    expect(req.request.params.get('to')).toBe('2026-09-30');
    req.flush({ key: 'over_break', total: 0, timezone: null, items: [] });
  });

  it('fetches work modes from /work-modes for a legal entity', () => {
    service.getWorkModes('le-1').subscribe((modes) => {
      expect(modes.length).toBe(1);
      expect(modes[0].label).toBe('On-Site');
    });

    const req = httpMock.expectOne(
      (r) => r.url === `${environment.apiUrl}/work-modes` && r.params.get('legalEntityId') === 'le-1'
    );
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 'wm-1', label: 'On-Site' }]);
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

  it('sends activeOnly as a query param when set, and omits it when unset', () => {
    service.listEmployees({ page: 1, pageSize: 25, activeOnly: true }).subscribe();
    const withFlag = httpMock.expectOne(
      (r) => r.url === `${environment.apiUrl}/employees` && r.params.has('activeOnly')
    );
    expect(withFlag.request.params.get('activeOnly')).toBe('true');
    withFlag.flush(mockEmployeePage);

    service.listEmployees({ page: 1, pageSize: 25 }).subscribe();
    const withoutFlag = httpMock.expectOne(`${environment.apiUrl}/employees?page=1&pageSize=25`);
    expect(withoutFlag.request.params.has('activeOnly')).toBe(false);
    withoutFlag.flush(mockEmployeePage);
  });

  it('preserves the backend attendance summary on the existing employee-list response', () => {
    const warningEmployee: EmployeeListItemResponse = {
      ...mockEmployee,
      attendanceSummary: {
        showNotClockedInWarning: true,
        shouldHaveClockedIn: true,
        hasClockedInToday: false,
        workDate: '2026-08-21',
        timezone: 'Asia/Colombo',
        scheduledStartTime: '09:00',
        warningLabel: 'Still has not clocked in',
        attendanceStatus: 'not_clocked_in',
        attendanceStatusLabel: 'Not clocked in',
        attentionType: 'not_clocked_in',
        attentionSeverity: 'critical',
        attentionLabel: 'Still has not clocked in',
        breakUsedMinutes: 0,
        breakAllowanceMinutes: 30,
        breakOverageMinutes: 0,
        isOverBreakAllowance: false
      }
    };

    service.listEmployees({ page: 1, pageSize: 25 }).subscribe((page) => {
      expect(page.items[0].attendanceSummary).toEqual(warningEmployee.attendanceSummary);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/employees?page=1&pageSize=25`);
    expect(req.request.method).toBe('GET');
    req.flush({ ...mockEmployeePage, items: [warningEmployee] });
  });

  it('preserves a null attendance summary without transforming the employee response', () => {
    const employeeWithNullSummary = { ...mockEmployee, attendanceSummary: null };

    service.listEmployees({ page: 1, pageSize: 25 }).subscribe((page) => {
      expect(page.items[0].attendanceSummary).toBeNull();
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/employees?page=1&pageSize=25`);
    req.flush({ ...mockEmployeePage, items: [employeeWithNullSummary] });
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

  it('fetches an employee identity (name + avatar only) by id', () => {
    const identity = { id: 'emp-1', name: 'Ada Lovelace', avatarFileId: null };
    service.getEmployeeIdentity('emp-1').subscribe((result) => {
      expect(result).toEqual(identity);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/employees/emp-1/identity`);
    expect(req.request.method).toBe('GET');
    req.flush(identity);
  });

  it('lists onboarding drafts', () => {
    service.listDrafts({ page: 1, pageSize: 25 }).subscribe();

    const req = httpMock.expectOne(
      (r) => r.url === `${environment.apiUrl}/onboarding/drafts` && r.params.get('page') === '1'
    );
    expect(req.request.method).toBe('GET');
    req.flush({ items: [], totalCount: 0, page: 1, pageSize: 25 });
  });

  it('lists only my open drafts when mine is set', () => {
    service.listDrafts({ mine: true, page: 1, pageSize: 50 }).subscribe();

    const req = httpMock.expectOne((r) => r.url === `${environment.apiUrl}/onboarding/drafts` && r.params.get('mine') === 'true');
    expect(req.request.method).toBe('GET');
    req.flush({ items: [], totalCount: 0, page: 1, pageSize: 50 });
  });

  it('cancels a draft with DELETE', () => {
    service.cancelDraft('draft-9').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/onboarding/drafts/draft-9`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
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
      workModeId: '1',
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
    expect(req.request.body.workModeId).toBe('1');
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
      workModeId: '1',
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
    expect(req.request.body.workModeId).toBe('1');
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

  it('posts the enabled flag to /employees/{id}/tray-app-access', () => {
    service.setTrayAppAccess('emp-1', false).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/employees/emp-1/tray-app-access`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ enabled: false });
    req.flush(null);
  });

  it('changePosition sends POST to /employees/{id}/change-position with the payload', () => {
    service.changePosition('emp-1', { positionId: 'pos-1', effectiveFrom: '2026-09-01', changeReason: 'Transfer' }).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/employees/emp-1/change-position`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ positionId: 'pos-1', effectiveFrom: '2026-09-01', changeReason: 'Transfer' });
    req.flush({ pendingApproval: false });
  });

  it('changePosition sends changeReason and returns pendingApproval', () => {
    service.changePosition('emp-1', { positionId: 'pos-1', effectiveFrom: '2026-09-01', changeReason: 'Promotion' })
      .subscribe((response) => expect(response.pendingApproval).toBe(true));
    const req = httpMock.expectOne(`${environment.apiUrl}/employees/emp-1/change-position`);
    expect(req.request.body).toEqual({ positionId: 'pos-1', effectiveFrom: '2026-09-01', changeReason: 'Promotion' });
    req.flush({ pendingApproval: true });
  });

  it('getActiveHolders requests the position active-holders endpoint', () => {
    service.getActiveHolders('legal-entity-1', 'position-1').subscribe();

    const req = httpMock.expectOne(
      `${environment.apiUrl}/org/legal-entities/legal-entity-1/positions/position-1/active-holders`
    );
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getChecklistAssignees requests the people checklist-assignees endpoint', () => {
    service.getChecklistAssignees('legal-entity-1', 'position-1').subscribe();

    const req = httpMock.expectOne(
      (r) => r.url === `${environment.apiUrl}/people/checklist-assignees`
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('legalEntityId')).toBe('legal-entity-1');
    expect(req.request.params.get('positionId')).toBe('position-1');
    req.flush([]);
  });

  it('getChecklistAssigneePositions requests the people checklist-assignee-positions endpoint', () => {
    service.getChecklistAssigneePositions('legal-entity-1').subscribe();

    const req = httpMock.expectOne(
      (r) => r.url === `${environment.apiUrl}/people/checklist-assignee-positions`
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('legalEntityId')).toBe('legal-entity-1');
    req.flush([{ id: 'pos-1', name: 'HR Partner' }]);
  });

  it('getEmployeeNumberSuggestion requests the onboarding suggestion endpoint', () => {
    service.getEmployeeNumberSuggestion('legal-entity-1').subscribe((result) => {
      expect(result.employeeNumber).toBe('DAPI-0005');
      expect(result.prefix).toBe('DAPI');
      expect(result.sequence).toBe(5);
    });

    const req = httpMock.expectOne(
      (r) => r.url === `${environment.apiUrl}/onboarding/employee-number-suggestion`
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('legalEntityId')).toBe('legal-entity-1');
    expect(req.request.params.get('tenantId')).toBeNull();
    req.flush({ employeeNumber: 'DAPI-0005', prefix: 'DAPI', sequence: 5 });
  });

  it('checkEmployeeNumberAvailability requests the onboarding availability endpoint', () => {
    service.checkEmployeeNumberAvailability('DAPI-0005').subscribe((result) => {
      expect(result.available).toBe(false);
    });

    const req = httpMock.expectOne(
      (r) => r.url === `${environment.apiUrl}/onboarding/employee-number-availability`
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('employeeNumber')).toBe('DAPI-0005');
    expect(req.request.params.get('tenantId')).toBeNull();
    req.flush({ employeeNumber: 'DAPI-0005', available: false });
  });

  it('checkEmployeeNumberAvailability passes excludeEmployeeId through when provided', () => {
    service.checkEmployeeNumberAvailability('DAPI-0005', 'emp-1').subscribe();

    const req = httpMock.expectOne(
      (r) => r.url === `${environment.apiUrl}/onboarding/employee-number-availability`
    );
    expect(req.request.params.get('excludeEmployeeId')).toBe('emp-1');
    req.flush({ employeeNumber: 'DAPI-0005', available: true });
  });

  it('checkEmployeeNumberAvailability omits excludeEmployeeId when not provided', () => {
    service.checkEmployeeNumberAvailability('DAPI-0005').subscribe();

    const req = httpMock.expectOne(
      (r) => r.url === `${environment.apiUrl}/onboarding/employee-number-availability`
    );
    expect(req.request.params.has('excludeEmployeeId')).toBe(false);
    req.flush({ employeeNumber: 'DAPI-0005', available: true });
  });

  it('updateJobDetails sends PUT to /employees/{id}/job-details with the payload', () => {
    service
      .updateJobDetails('emp-1', { employeeNumber: 'E-002', employmentTypeCode: 'part_time', workModeId: 'wm-1' })
      .subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/employees/emp-1/job-details`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ employeeNumber: 'E-002', employmentTypeCode: 'part_time', workModeId: 'wm-1' });
    req.flush(null);
  });
});
