import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskApiService } from '../../modules/work/data-access/task-api.service';
import { NotificationItem } from './notification-api.service';
import { NotificationNavigationService } from './notification-navigation.service';

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
