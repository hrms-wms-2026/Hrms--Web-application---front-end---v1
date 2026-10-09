import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeviceChangeRequestApiService } from '../../attendance/data-access/device-change-request-api.service';
import { LocationChangeRequestApiService } from '../../attendance/data-access/location-change-request-api.service';
import { TimeTrackingApiService } from '../../attendance/data-access/time-tracking-api.service';
import { LeaveApprovalApiService } from '../../leave/data-access/leave-approval-api.service';
import { WorkApprovalsApiService } from '../../work/data-access/work-approvals-api.service';
import { ActionCenterDecisionService, canDecideInline, rejectReasonRequired } from './action-center-decision.service';

describe('ActionCenterDecisionService', () => {
  const ok = () => vi.fn(() => of({}));
  let apis: Record<string, Record<string, ReturnType<typeof vi.fn>>>;

  afterEach(() => TestBed.resetTestingModule());

  function setup(): ActionCenterDecisionService {
    apis = {
      leave: { approve: ok(), reject: ok() },
      time: { approveCorrection: ok(), rejectCorrection: ok(), approveWorkAreaChangeRequest: ok(), rejectWorkAreaChangeRequest: ok() },
      device: { approve: ok(), reject: ok() },
      location: { approve: ok(), reject: ok() },
      work: { approveWorkApproval: ok(), rejectWorkApproval: ok() }
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: LeaveApprovalApiService, useValue: apis['leave'] },
        { provide: TimeTrackingApiService, useValue: apis['time'] },
        { provide: DeviceChangeRequestApiService, useValue: apis['device'] },
        { provide: LocationChangeRequestApiService, useValue: apis['location'] },
        { provide: WorkApprovalsApiService, useValue: apis['work'] }
      ]
    });
    return TestBed.inject(ActionCenterDecisionService);
  }

  it("sends each approval to its own module API with that page's payload shape", async () => {
    const service = setup();
    await service.decide('leave.approval', 'l1', 'approve', null);
    await service.decide('leave.approval', 'l1', 'reject', 'Busy week');
    await service.decide('attendance.correction', 'c1', 'reject', 'Wrong time');
    await service.decide('attendance.work_area', 'w1', 'approve', 'ok');
    await service.decide('attendance.location', 'p1', 'reject', 'No');
    await service.decide('attendance.device_change', 'd1', 'approve', null);
    await service.decide('work.objective_change', 'o1', 'approve', null);
    await service.decide('work.task_creation', 't1', 'reject', null);

    expect(apis['leave']['approve']).toHaveBeenCalledWith('l1', { comment: null });
    expect(apis['leave']['reject']).toHaveBeenCalledWith('l1', { reason: 'Busy week' });
    expect(apis['time']['rejectCorrection']).toHaveBeenCalledWith('c1', { reviewComment: 'Wrong time' });
    expect(apis['time']['approveWorkAreaChangeRequest']).toHaveBeenCalledWith('w1', 'ok');
    expect(apis['location']['reject']).toHaveBeenCalledWith('p1', 'No');
    expect(apis['device']['approve']).toHaveBeenCalledWith('d1', null);
    expect(apis['work']['approveWorkApproval']).toHaveBeenCalledWith('o1', undefined, undefined);
    expect(apis['work']['rejectWorkApproval']).toHaveBeenCalledWith('t1', undefined);
  });

  it('knows which approvals can be decided inline and which need a reject reason', () => {
    expect(canDecideInline('work.objective_change')).toBe(true);
    expect(canDecideInline('monitoring.exception')).toBe(false);
    expect(canDecideInline('something.new')).toBe(false);
    expect(rejectReasonRequired('leave.approval')).toBe(true);
    expect(rejectReasonRequired('work.task_creation')).toBe(false);
  });

  it('refuses sources it has no API for', () => {
    expect(() => setup().decide('monitoring.exception', 'e1', 'approve', null)).toThrow();
  });
});
