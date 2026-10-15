import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { TaskApiService } from '../../work/data-access/task-api.service';
import { MyTeamDeepLinkService } from './my-team-deep-link.service';

describe('MyTeamDeepLinkService', () => {
  function setup() {
    const navigate = vi.fn();
    const getNotificationNavigation = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        MyTeamDeepLinkService,
        { provide: Router, useValue: { navigate } },
        { provide: TaskApiService, useValue: { getNotificationNavigation } }
      ]
    });
    return { service: TestBed.inject(MyTeamDeepLinkService), navigate, getNotificationNavigation };
  }

  it('routes leave.approval to the leave request in the Inbox', async () => {
    const { service, navigate } = setup();
    await service.navigate({ kind: 'leave.approval', params: { requestId: 'r1' } });
    expect(navigate).toHaveBeenCalledWith(['/inbox', 'leave', 'request', 'r1']);
  });

  it('routes attendance.approval with its type param', async () => {
    const { service, navigate } = setup();
    await service.navigate({ kind: 'attendance.approval', params: { type: 'corrections', requestId: 'r2' } });
    expect(navigate).toHaveBeenCalledWith(['/attendance/time-tracking'], {
      queryParams: { view: 'team', type: 'corrections', requestId: 'r2' }
    });
  });

  it('routes monitoring.exception to the alerts screen', async () => {
    const { service, navigate } = setup();
    await service.navigate({ kind: 'monitoring.exception', params: { alertId: 'a1' } });
    expect(navigate).toHaveBeenCalledWith(['/attendance/alerts'], { queryParams: { alertId: 'a1' } });
  });

  it('resolves work.request via notification-navigation and routes to the tree tab', async () => {
    const { service, navigate, getNotificationNavigation } = setup();
    getNotificationNavigation.mockReturnValue(
      of({ projectId: 'p1', objectiveId: 'o1', taskId: null, targetTab: 'tree' })
    );
    await service.navigate({ kind: 'work.request', params: { relatedEntityType: 'task_creation_request', relatedEntityId: 't1' } });
    expect(getNotificationNavigation).toHaveBeenCalledWith('task_creation_request', 't1');
    expect(navigate).toHaveBeenCalledWith(['/work', 'p1', 'milestones', 'o1', 'tree'], {});
  });

  it('routes work.request to the board with a highlight when targetTab is board', async () => {
    const { service, navigate, getNotificationNavigation } = setup();
    getNotificationNavigation.mockReturnValue(
      of({ projectId: 'p1', objectiveId: 'o1', taskId: 't99', targetTab: 'board' })
    );
    await service.navigate({ kind: 'work.request', params: { relatedEntityType: 'task_edit_request', relatedEntityId: 't2' } });
    expect(navigate).toHaveBeenCalledWith(['/work', 'p1', 'board'], { queryParams: { highlightTaskId: 't99' } });
  });

  it("opens the exact request's detail on the Approvals page for a work approval request", async () => {
    const { service, navigate, getNotificationNavigation } = setup();
    getNotificationNavigation.mockReturnValue(
      of({ projectId: 'p1', objectiveId: 'o1', taskId: null, targetTab: 'approvals' })
    );
    await service.navigate({ kind: 'work.request', params: { relatedEntityType: 'work_approval_request', relatedEntityId: 'req-7' } });
    expect(navigate).toHaveBeenCalledWith(['/work', 'p1', 'approvals'], { queryParams: { request: 'req-7' } });
  });

  it('falls back to /work when the notification-navigation lookup fails', async () => {
    const { service, navigate, getNotificationNavigation } = setup();
    getNotificationNavigation.mockReturnValue(throwError(() => new Error('not found')));
    await service.navigate({ kind: 'work.request', params: { relatedEntityType: 'task_edit_request', relatedEntityId: 't3' } });
    expect(navigate).toHaveBeenCalledWith(['/work']);
  });
});
