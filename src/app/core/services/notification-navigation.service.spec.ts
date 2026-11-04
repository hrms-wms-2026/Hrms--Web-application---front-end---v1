import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskApiService } from '../../modules/work/data-access/task-api.service';
import { NotificationItem } from './notification-api.service';
import { NotificationNavigationService } from './notification-navigation.service';

describe('NotificationNavigationService (Work Management)', () => {
  function setup(nav: { projectId: string; objectiveId: string; taskId: string | null; targetTab: string }) {
    const navigate = vi.fn().mockResolvedValue(true);
    const getNotificationNavigation = vi.fn().mockReturnValue(of(nav));
    TestBed.configureTestingModule({
      providers: [
        NotificationNavigationService,
        { provide: Router, useValue: { navigate } },
        { provide: TaskApiService, useValue: { getNotificationNavigation } }
      ]
    });
    return { service: TestBed.inject(NotificationNavigationService), navigate, getNotificationNavigation };
  }

  afterEach(() => TestBed.resetTestingModule());

  const item = (relatedEntityType: string) => ({ relatedEntityType, relatedEntityId: 'x1' }) as unknown as NotificationItem;

  it.each(['module', 'sprint'])('a %s notification opens the tree without popping the members panel', async (type) => {
    const { service, navigate, getNotificationNavigation } = setup({ projectId: 'p1', objectiveId: 'o1', taskId: null, targetTab: 'tree' });

    await service.navigate(item(type));

    expect(getNotificationNavigation).toHaveBeenCalledWith(type, 'x1');
    expect(navigate).toHaveBeenCalledWith(['/work', 'p1', 'milestones', 'o1', 'tree'], {});
  });

  it.each([
    ['work_approval_request', ['/inbox', 'work', 'approval', 'x1']],
    ['project_member_invitation', ['/inbox', 'work', 'invitation', 'x1']],
    ['monitor_alert', ['/inbox', 'work', 'monitor_alert', 'x1']],
    ['inbox:work:approval', ['/inbox', 'work', 'approval', 'x1']],
    ['inbox:leave:request', ['/inbox', 'leave', 'request', 'x1']]
  ])('a %s notification opens the item in the Inbox', async (type, commands) => {
    const { service, navigate, getNotificationNavigation } = setup({ projectId: 'p1', objectiveId: 'o1', taskId: null, targetTab: 'tree' });

    await service.navigate(item(type));

    expect(navigate).toHaveBeenCalledWith(commands);
    expect(getNotificationNavigation).not.toHaveBeenCalled();
  });

  it('ignores a malformed inbox type', async () => {
    const { service, navigate } = setup({ projectId: 'p1', objectiveId: 'o1', taskId: null, targetTab: 'tree' });
    await service.navigate(item('inbox:work'));
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('NotificationNavigationService', () => {
  const router = { navigate: vi.fn(() => Promise.resolve(true)) };
  const taskApi = { getNotificationNavigation: vi.fn() };

  beforeEach(() => {
    router.navigate.mockClear();
    TestBed.configureTestingModule({
      providers: [{ provide: Router, useValue: router }, { provide: TaskApiService, useValue: taskApi }]
    });
  });

  afterEach(() => TestBed.resetTestingModule());

  it('opens an approver\'s attendance correction or work-mode request in the Inbox', async () => {
    const service = TestBed.inject(NotificationNavigationService);

    await service.navigate({ isNavigable: true, destinationKey: 'attendance_correction_approval', attendanceCorrectionId: 'c1' } as NotificationItem);
    await service.navigate({ isNavigable: true, destinationKey: 'work_area_change_approval', workAreaChangeRequestId: 'w1' } as NotificationItem);

    expect(router.navigate).toHaveBeenNthCalledWith(1, ['/inbox', 'attendance', 'correction', 'c1']);
    expect(router.navigate).toHaveBeenNthCalledWith(2, ['/inbox', 'attendance', 'work_mode_change', 'w1']);
  });

  it.each(['calendar_connection_reauth_required', 'calendar_connection_sync_conflict', 'calendar_connection_failed'])(
    'a %s notice opens Settings > Calendar Sync', async (templateCode) => {
      const service = TestBed.inject(NotificationNavigationService);

      await service.navigate({ templateCode, relatedEntityType: 'calendar_event', relatedEntityId: null } as NotificationItem);

      expect(router.navigate).toHaveBeenCalledWith(['/settings/calendar-connections']);
    });

  it('opens the exception case in the Inbox from an exception notification', async () => {
    const service = TestBed.inject(NotificationNavigationService);

    await service.navigate({
      relatedEntityType: 'monitoring_exception', relatedEntityId: 'alert-7', isNavigable: false
    } as NotificationItem);

    expect(router.navigate).toHaveBeenCalledWith(['/inbox', 'monitoring', 'exception_case', 'alert-7']);
    expect(taskApi.getNotificationNavigation).not.toHaveBeenCalled();
  });

  it('opens my attendance history when a correction decision notice is clicked (not an approval request, so isNavigable is false)', async () => {
    const service = TestBed.inject(NotificationNavigationService);

    await service.navigate({
      relatedEntityType: 'attendance_correction', relatedEntityId: 'corr-1', isNavigable: false, destinationKey: null
    } as NotificationItem);

    expect(router.navigate).toHaveBeenCalledWith(['/attendance']);
  });

  it('opens my attendance history when a work-area decision notice is clicked', async () => {
    const service = TestBed.inject(NotificationNavigationService);

    await service.navigate({
      relatedEntityType: 'work_area_change_request', relatedEntityId: 'wa-1', isNavigable: false, destinationKey: null
    } as NotificationItem);

    expect(router.navigate).toHaveBeenCalledWith(['/attendance']);
  });
});
