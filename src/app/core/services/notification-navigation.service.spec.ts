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

  it('an invitation notification still opens the tree with the members panel', async () => {
    const { service, navigate } = setup({ projectId: 'p1', objectiveId: 'o1', taskId: null, targetTab: 'tree' });

    await service.navigate(item('project_member_invitation'));

    expect(navigate).toHaveBeenCalledWith(['/work', 'p1', 'milestones', 'o1', 'tree'], { queryParams: { openMembers: '1' } });
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

  it('opens the attendance alerts page on the alert from an exception notification', async () => {
    const service = TestBed.inject(NotificationNavigationService);

    await service.navigate({
      relatedEntityType: 'monitoring_exception', relatedEntityId: 'alert-7', isNavigable: false
    } as NotificationItem);

    expect(router.navigate).toHaveBeenCalledWith(['/attendance/alerts'], { queryParams: { alertId: 'alert-7' } });
    expect(taskApi.getNotificationNavigation).not.toHaveBeenCalled();
  });
});
