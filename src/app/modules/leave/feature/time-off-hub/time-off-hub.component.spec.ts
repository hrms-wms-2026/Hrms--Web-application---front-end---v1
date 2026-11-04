import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { LeaveBalanceResponse } from '../../models/leave-balance.model';
import { LeaveRequestListItemResponse } from '../../models/leave-request.model';
import { LeaveTypeResponse } from '../../models/leave-type.model';
import { TimeOffHubComponent } from './time-off-hub.component';

const api = environment.apiUrl;

function leaveType(id: string, name: string): LeaveTypeResponse {
  return { id, name, code: id.toUpperCase(), description: null, color: '#2563EB', isPaid: true, applicableGender: 'all', requiresDocument: false, documentRequiredAfterHours: null, acceptedDocumentTypes: [], isActive: true, createdAt: '2026-01-01T00:00:00Z', policyCount: 1 };
}

function balance(leaveTypeId: string, leaveTypeName: string, remainingHours: number): LeaveBalanceResponse {
  return { employeeId: 'me', employeeNumber: 'E1', employeeName: 'Me', departmentId: null, departmentName: null, legalEntityId: null, legalEntityName: null, leaveTypeId, leaveTypeName, leaveTypeCode: leaveTypeId, year: 2026, entitledHours: 112, annualHours: 112, carriedForwardHours: 0, usedHours: 112 - remainingHours, pendingHours: 0, remainingHours, isNegative: false, carryForwardExpiresOn: null };
}

function myRequest(id: string, overrides: Partial<LeaveRequestListItemResponse> = {}): LeaveRequestListItemResponse {
  return { id, employeeId: 'me', leaveTypeId: 'al', leaveTypeName: 'Annual Leave', leaveTypeCode: 'AL', startAt: '2099-10-30T09:00:00Z', endAt: '2099-10-30T18:00:00Z', totalHours: 8, paidHours: 8, unpaidHours: 0, status: 'pending', noticePeriodMissed: false, approvedByName: null, createdAt: '2026-09-01T00:00:00Z', updatedAt: null, ...overrides };
}

describe('TimeOffHubComponent', () => {
  let fixture: ComponentFixture<TimeOffHubComponent>;
  let http: HttpTestingController;

  function setUp(permissions: string[], managesPeople = false): void {
    TestBed.configureTestingModule({
      imports: [TimeOffHubComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthStore, useValue: { permissions: signal(permissions), activeModules: signal(['leave']), email: signal('anu.raman@dapi.com'), managesPeople: signal(managesPeople) } }
      ]
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TimeOffHubComponent);
    fixture.detectChanges();
  }

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  async function flushEmployeeLoads(types: LeaveTypeResponse[], balances: LeaveBalanceResponse[], requests: LeaveRequestListItemResponse[]): Promise<void> {
    http.expectOne((r) => r.url === `${api}/leave/types`).flush(types);
    http.expectOne((r) => r.url === `${api}/leave/balances/my`).flush(balances);
    http.expectOne(`${api}/leave/balances/work-window`).flush({ workStartTime: '09:00', workEndTime: '18:00', breakDurationMinutes: 60, timezone: 'UTC' });
    http.expectOne((r) => r.url === `${api}/leave/requests/my`).flush(requests);
    await fixture.whenStable();
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  it('shows three balance cards and "More" for the rest, and greets by name', async () => {
    setUp(['leave:read-own']);
    const balances = [balance('al', 'Annual Leave', 96), balance('cl', 'Casual Leave', 40), balance('sl', 'Sick Leave', 80), balance('ml', 'Maternity Leave', 480)];
    await flushEmployeeLoads([leaveType('al', 'Annual Leave')], balances, []);

    expect(el().querySelectorAll('[data-testid="balance-card"]').length).toBe(3);
    expect(el().querySelector('[data-testid="more-balances"]')?.textContent).toContain('More (1)');
    expect(el().textContent).toContain('Anu Raman!');
    expect(el().textContent).toContain('You have 96.00 hours of Annual Leave remaining');
  });

  it('lists recent requests by last activity, and shows a plain employee no Upcoming Time Off or Quick Actions', async () => {
    setUp(['leave:read-own']);
    const requests = [
      myRequest('decided', { createdAt: '2026-08-01T00:00:00Z', updatedAt: '2026-09-20T00:00:00Z', status: 'approved', leaveTypeName: 'December Trip' }),
      myRequest('newer', { createdAt: '2026-09-10T00:00:00Z', leaveTypeName: 'Casual Leave' })
    ];
    await flushEmployeeLoads([leaveType('al', 'Annual Leave')], [balance('al', 'Annual Leave', 96)], requests);

    const recent = Array.from(el().querySelectorAll('[data-testid="recent-request"]')).map((row) => row.textContent);
    expect(recent[0]).toContain('December Trip');
    expect(el().querySelector('[data-testid="approval-progress"]')).toBeNull();
    expect(el().querySelector('[data-testid="hub-upcoming"]')).toBeNull();
    expect(el().querySelector('[data-testid="hub-quick-actions"]')).toBeNull();
    expect(el().querySelector('.hub-row.hub-wide')).not.toBeNull();
    expect(el().textContent).not.toContain('Team Availability (Today)');
  });

  it('shows total, used and remaining hours and the reset date on a balance card', async () => {
    setUp(['leave:read-own']);
    await flushEmployeeLoads([leaveType('al', 'Annual Leave')], [{ ...balance('al', 'Annual Leave', 96), resetsOn: '2027-01-01' }, balance('cl', 'Casual Leave', 40)], []);
    const [annual, casual] = Array.from(el().querySelectorAll('[data-testid="balance-card"]')).map((card) => card.textContent ?? '');
    expect(annual).toContain('86%');
    expect(annual).toContain('112.00 h');
    expect(annual).toContain('16.00 h');
    expect(annual).toContain('Jan 01, 2027');
    // Without resetsOn from the API it falls back to 1 January after the leave year.
    expect(casual).toContain('Jan 01, 2027');
  });

  it('shows "1 of 2 approved" under a pending request part-way through its approvals', async () => {
    setUp(['leave:read-own']);
    await flushEmployeeLoads([leaveType('al', 'Annual Leave')], [], [myRequest('two-step', { approvedApproverCount: 1, approverCount: 2, updatedAt: '2026-10-20T00:00:00Z' })]);
    expect(el().querySelector('[data-testid="recent-request"] [data-testid="approval-progress"]')?.textContent).toContain('1 of 2 approved');
  });

  it('shows requests waiting on an approver in Upcoming Time Off, linking to the Inbox', async () => {
    setUp(['leave:read-own', 'leave:approve'], true);
    http.expectOne(`${api}/leave/requests/pending-approvals`).flush([
      { requestId: 'req-9', employeeId: 'e2', employeeName: 'Suthan Nadarajah', leaveTypeId: 'sl', leaveTypeName: 'Sick Leave', leaveTypeCode: 'SL', startAt: '2099-11-12T09:00:00Z', endAt: '2099-11-13T18:00:00Z', totalHours: 16, paidHours: 16, unpaidHours: 0, status: 'pending', submittedAt: '2026-10-28T00:00:00Z' }
    ]);
    await flushEmployeeLoads([leaveType('al', 'Annual Leave')], [], []);

    const row = el().querySelector('[data-testid="upcoming-row"]') as HTMLAnchorElement;
    expect(row.textContent).toContain('Suthan Nadarajah');
    expect(row.textContent).toContain('2 days');
    expect(row.getAttribute('href')).toBe('/inbox/leave/request/req-9');
  });

  it('leaves requests whose dates have passed out of Upcoming Time Off, and links the footer to the soonest request', async () => {
    setUp(['leave:read-own', 'leave:approve'], true);
    const pending = (requestId: string, startAt: string, endAt: string) => ({ requestId, employeeId: 'e2', employeeName: 'Vithya G', leaveTypeId: 'cl', leaveTypeName: 'Casual Leave', leaveTypeCode: 'CL', startAt, endAt, totalHours: 8, paidHours: 8, unpaidHours: 0, status: 'pending', submittedAt: '2026-10-28T00:00:00Z' });
    http.expectOne(`${api}/leave/requests/pending-approvals`).flush([
      pending('later', '2099-12-25T09:00:00Z', '2099-12-25T18:00:00Z'),
      pending('past', '2020-10-30T09:00:00Z', '2020-10-30T18:00:00Z'),
      pending('soon', '2099-11-02T09:00:00Z', '2099-11-02T18:00:00Z')
    ]);
    await flushEmployeeLoads([leaveType('al', 'Annual Leave')], [], []);

    const links = Array.from(el().querySelectorAll('[data-testid="upcoming-row"]')).map((row) => row.getAttribute('href'));
    expect(links).toEqual(['/inbox/leave/request/soon', '/inbox/leave/request/later']);
    const footer = el().querySelector('[data-testid="upcoming-all"]') as HTMLAnchorElement;
    expect(footer.textContent).toContain('2 upcoming time off');
    expect(footer.getAttribute('href')).toBe('/inbox/leave/request/soon');
  });

  it('gives a leave manager Create Leave Type in Quick Actions, and no New Request there', async () => {
    setUp(['leave:read-own', 'leave:manage']);
    await flushEmployeeLoads([leaveType('al', 'Annual Leave')], [], []);
    const actions = el().querySelector('[data-testid="hub-quick-actions"]') as HTMLElement;
    expect(actions.textContent).toContain('Create Leave Type');
    expect(actions.textContent).not.toContain('New Request');
    expect(el().querySelector('[data-testid="quick-create-leave-type"]')?.getAttribute('href')).toBe('/settings/time-off/types?new=1');
    expect(el().querySelector('[data-testid="hub-upcoming"]')).toBeNull();
  });

  it('puts Quick Actions beside Recent Requests for a leave manager with nobody under them', async () => {
    setUp(['leave:read-own', 'leave:manage', 'leave:approve', 'leave:read-team']);
    await flushEmployeeLoads([leaveType('al', 'Annual Leave')], [], []);
    expect(el().querySelector('[data-testid="hub-quick-actions"]')).not.toBeNull();
    expect(el().querySelector('.hub-main.hub-wide')).not.toBeNull();
    expect(el().querySelector('.hub-row.hub-wide')).toBeNull();
    expect(el().querySelector('[data-testid="hub-upcoming"]')).toBeNull();
    expect(el().textContent).not.toContain('Team Availability (Today)');
  });

  it('shows Team Availability and Upcoming Time Off, but no Quick Actions, to a manager without leave:manage', async () => {
    setUp(['leave:read-own', 'leave:approve', 'leave:read-team'], true);
    http.expectOne(`${api}/leave/requests/pending-approvals`).flush([]);
    http.expectOne((r) => r.url.startsWith(`${api}/leave/calendar`)).flush({ year: 2026, month: 11, days: [] });
    await flushEmployeeLoads([leaveType('al', 'Annual Leave')], [], []);
    expect(el().querySelector('[data-testid="hub-upcoming"]')).not.toBeNull();
    expect(el().textContent).toContain('Team Availability (Today)');
    expect(el().querySelector('[data-testid="hub-quick-actions"]')).toBeNull();
  });

  it('walks an admin through setup when there are no leave types', async () => {
    setUp(['leave:manage']);
    http.expectOne((r) => r.url === `${api}/leave/types`).flush([]);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el().querySelector('[data-testid="time-off-setup"]')).not.toBeNull();
    // Get started and step 1 open the Create leave type dialog straight away.
    expect(el().querySelector('[data-testid="setup-get-started"]')?.getAttribute('href')).toBe('/settings/time-off/types?new=1');
    expect(el().querySelector('[data-testid="setup-create-leave-type"]')?.getAttribute('href')).toBe('/settings/time-off/types?new=1');
    expect(el().querySelector('[data-testid="new-request-button"]')).toBeNull();
  });

  it('shows the setup steps, not the hub, to an admin who also requests leave', async () => {
    setUp(['leave:read-own', 'leave:manage']);
    await flushEmployeeLoads([], [], []);
    expect(el().querySelector('[data-testid="time-off-setup"]')).not.toBeNull();
    expect(el().querySelector('[data-testid="hub-greeting"]')).toBeNull();
  });

  it('tells an employee Time Off is not set up yet instead of showing setup steps', async () => {
    setUp(['leave:read-own']);
    await flushEmployeeLoads([], [], []);
    expect(el().querySelector('[data-testid="time-off-not-ready"]')).not.toBeNull();
    expect(el().querySelector('[data-testid="time-off-setup"]')).toBeNull();
  });
});
