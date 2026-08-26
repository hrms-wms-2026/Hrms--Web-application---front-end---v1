import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { NotificationBellComponent } from './notification-bell.component';
import { NotificationsStore } from '../../../../core/state/notifications.store';
import { TaskApiService } from '../../../../modules/work/data-access/task-api.service';

describe('NotificationBellComponent', () => {
  it('toggles dropdown and shows unread badge', async () => {
    const storeStub = {
      unreadCount: () => 3,
      items: () => [],
      refreshUnreadCount: vi.fn().mockResolvedValue(undefined),
      loadMine: vi.fn().mockResolvedValue(undefined),
      markRead: vi.fn().mockResolvedValue(undefined),
      markAllRead: vi.fn().mockResolvedValue(undefined)
    };
    const navigate = vi.fn().mockResolvedValue(true);

    TestBed.configureTestingModule({
      imports: [NotificationBellComponent],
      providers: [
        { provide: NotificationsStore, useValue: storeStub },
        { provide: Router, useValue: { navigate } },
        { provide: TaskApiService, useValue: { getNotificationNavigation: vi.fn() } }
      ]
    });

    const fixture = TestBed.createComponent(NotificationBellComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(storeStub.refreshUnreadCount).toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[data-testid="notification-badge"]')?.textContent.trim()).toBe('3');

    fixture.nativeElement.querySelector('[data-testid="notification-bell"]').click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(storeStub.loadMine).toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[data-testid="notification-dropdown"]')).toBeTruthy();
  });

  it('marks item read and navigates to Board for task_creation_request', async () => {
    const item = {
      id: 'n1',
      templateCode: 'x',
      title: 'Hello',
      body: 'World',
      relatedEntityType: 'task_creation_request',
      relatedEntityId: 'r1',
      isRead: false,
      readAt: null,
      createdAt: new Date()
    };
    const storeStub = {
      unreadCount: () => 1,
      items: () => [item],
      refreshUnreadCount: vi.fn().mockResolvedValue(undefined),
      loadMine: vi.fn().mockResolvedValue(undefined),
      markRead: vi.fn().mockResolvedValue(undefined),
      markAllRead: vi.fn().mockResolvedValue(undefined)
    };
    const navigate = vi.fn().mockResolvedValue(true);
    const getNotificationNavigation = vi.fn().mockReturnValue(
      of({ projectId: 'p1', objectiveId: 'o1', taskId: 't1', targetTab: 'board' })
    );

    TestBed.configureTestingModule({
      imports: [NotificationBellComponent],
      providers: [
        { provide: NotificationsStore, useValue: storeStub },
        { provide: Router, useValue: { navigate } },
        { provide: TaskApiService, useValue: { getNotificationNavigation } }
      ]
    });

    const fixture = TestBed.createComponent(NotificationBellComponent);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('[data-testid="notification-bell"]').click();
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.nativeElement.querySelector('.notification-dropdown__item').click();
    await fixture.whenStable();

    expect(storeStub.markRead).toHaveBeenCalledWith('n1');
    expect(getNotificationNavigation).toHaveBeenCalledWith('task_creation_request', 'r1');
    expect(navigate).toHaveBeenCalledWith(
      ['/work', 'p1', 'milestones', 'o1', 'board'],
      { queryParams: { highlightTaskId: 't1' } }
    );
  });

  it('navigates to Approvals for objective_change_request', async () => {
    const item = {
      id: 'n2',
      templateCode: 'x',
      title: 'Extend',
      body: 'body',
      relatedEntityType: 'objective_change_request',
      relatedEntityId: 'c1',
      isRead: false,
      readAt: null,
      createdAt: new Date()
    };
    const storeStub = {
      unreadCount: () => 1,
      items: () => [item],
      refreshUnreadCount: vi.fn().mockResolvedValue(undefined),
      loadMine: vi.fn().mockResolvedValue(undefined),
      markRead: vi.fn().mockResolvedValue(undefined),
      markAllRead: vi.fn().mockResolvedValue(undefined)
    };
    const navigate = vi.fn().mockResolvedValue(true);
    const getNotificationNavigation = vi.fn().mockReturnValue(
      of({ projectId: 'p1', objectiveId: 'o1', taskId: null, targetTab: 'approvals' })
    );

    TestBed.configureTestingModule({
      imports: [NotificationBellComponent],
      providers: [
        { provide: NotificationsStore, useValue: storeStub },
        { provide: Router, useValue: { navigate } },
        { provide: TaskApiService, useValue: { getNotificationNavigation } }
      ]
    });

    const fixture = TestBed.createComponent(NotificationBellComponent);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('[data-testid="notification-bell"]').click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.nativeElement.querySelector('.notification-dropdown__item').click();
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith(['/work', 'p1', 'milestones', 'o1', 'approvals'], {});
  });

  it('navigates an attendance correction approval notification to the approval inbox with its request id', async () => {
    const item = {
      id: 'n3', templateCode: 'attendance_correction_request_created', title: 'Correction request', body: 'Please review',
      relatedEntityType: 'attendance_correction', relatedEntityId: 'c1', isRead: false, readAt: null, createdAt: new Date(),
      notificationType: 'attendance_correction_request_created', attendanceCorrectionId: 'c1', destinationKey: 'attendance_correction_approval', isNavigable: true
    };
    const storeStub = {
      unreadCount: () => 1, items: () => [item], refreshUnreadCount: vi.fn().mockResolvedValue(undefined),
      loadMine: vi.fn().mockResolvedValue(undefined), markRead: vi.fn().mockResolvedValue(undefined), markAllRead: vi.fn().mockResolvedValue(undefined)
    };
    const navigate = vi.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({ imports: [NotificationBellComponent], providers: [
      { provide: NotificationsStore, useValue: storeStub }, { provide: Router, useValue: { navigate } },
      { provide: TaskApiService, useValue: { getNotificationNavigation: vi.fn() } }
    ] });
    const fixture = TestBed.createComponent(NotificationBellComponent);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('[data-testid="notification-bell"]').click();
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.notification-dropdown__item').click();
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith(['/attendance/corrections/approvals'], { queryParams: { requestId: 'c1' } });
  });

  it('does not navigate non-navigable requester correction notifications', async () => {
    const item = {
      id: 'n4', templateCode: 'attendance_correction_request_decided', title: 'Correction updated', body: 'Your request was reviewed',
      relatedEntityType: 'attendance_correction', relatedEntityId: 'c1', isRead: false, readAt: null, createdAt: new Date(),
      destinationKey: null, attendanceCorrectionId: 'c1', isNavigable: false
    };
    const storeStub = {
      unreadCount: () => 1, items: () => [item], refreshUnreadCount: vi.fn().mockResolvedValue(undefined),
      loadMine: vi.fn().mockResolvedValue(undefined), markRead: vi.fn().mockResolvedValue(undefined), markAllRead: vi.fn().mockResolvedValue(undefined)
    };
    const navigate = vi.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({ imports: [NotificationBellComponent], providers: [
      { provide: NotificationsStore, useValue: storeStub }, { provide: Router, useValue: { navigate } },
      { provide: TaskApiService, useValue: { getNotificationNavigation: vi.fn() } }
    ] });
    const fixture = TestBed.createComponent(NotificationBellComponent);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('[data-testid="notification-bell"]').click();
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.notification-dropdown__item').click();
    await fixture.whenStable();
    expect(navigate).not.toHaveBeenCalled();
  });
});
