import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { InboxRealtimeService } from '../../../../core/realtime/inbox-realtime.service';
import { NotificationBellComponent } from './notification-bell.component';
import { NotificationsStore } from '../../../../core/state/notifications.store';
import { TrayPresenceStore } from '../../../../core/tray-presence/state/tray-presence.store';
import { TaskApiService } from '../../../../modules/work/data-access/task-api.service';
import { WorkApprovalsApiService } from '../../../../modules/work/data-access/work-approvals-api.service';

describe('NotificationBellComponent', () => {
  const realtime = {
    notificationsChanged$: new Subject<Record<string, never>>(),
    reconnected$: new Subject<void>(),
    connected: signal(true),
  };

  function setupBell() {
    const storeStub = {
      unreadCount: () => 0,
      items: () => [],
      refreshUnreadCount: vi.fn().mockResolvedValue(undefined),
      loadMine: vi.fn().mockResolvedValue(undefined),
      markRead: vi.fn().mockResolvedValue(undefined),
      markAllRead: vi.fn().mockResolvedValue(undefined),
    };
    TestBed.configureTestingModule({
      imports: [NotificationBellComponent],
      providers: [
        { provide: NotificationsStore, useValue: storeStub },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: TaskApiService, useValue: { getNotificationNavigation: vi.fn() } },
        { provide: AuthStore, useValue: { authenticated: () => true, activeModules: () => [] } },
        { provide: InboxRealtimeService, useValue: realtime },
      ],
    });
    const fixture = TestBed.createComponent(NotificationBellComponent);
    fixture.detectChanges();
    return { fixture, storeStub };
  }

  it('does not poll the unread count while the tab is hidden, and refreshes once when it is back', () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    try {
      const { storeStub } = setupBell();
      const calls = () => storeStub.refreshUnreadCount.mock.calls.length;
      const atStart = calls();

      vi.advanceTimersByTime(60_000);
      expect(calls()).toBe(atStart + 1);

      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
      vi.advanceTimersByTime(5 * 60_000);
      expect(calls()).toBe(atStart + 1);

      Reflect.deleteProperty(document, 'visibilityState');
      document.dispatchEvent(new Event('visibilitychange'));
      expect(calls()).toBe(atStart + 2);
    } finally {
      vi.useRealTimers();
      Reflect.deleteProperty(document, 'visibilityState');
    }
  });

  it('refreshes the unread count as soon as the hub says notifications changed, and after a reconnect', () => {
    const { storeStub } = setupBell();
    const before = storeStub.refreshUnreadCount.mock.calls.length;
    realtime.notificationsChanged$.next({});
    realtime.reconnected$.next();
    expect(storeStub.refreshUnreadCount.mock.calls.length).toBe(before + 2);
  });

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
        { provide: InboxRealtimeService, useValue: realtime },
        { provide: NotificationsStore, useValue: storeStub },
        { provide: Router, useValue: { navigate } },
        { provide: TaskApiService, useValue: { getNotificationNavigation: vi.fn() } },
        { provide: AuthStore, useValue: { authenticated: () => true, activeModules: () => [] } }
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

  it('marks all notifications read as soon as the panel is opened', async () => {
    const storeStub = {
      unreadCount: () => 3,
      items: () => [],
      refreshUnreadCount: vi.fn().mockResolvedValue(undefined),
      loadMine: vi.fn().mockResolvedValue(undefined),
      markRead: vi.fn().mockResolvedValue(undefined),
      markAllRead: vi.fn().mockResolvedValue(undefined)
    };

    TestBed.configureTestingModule({
      imports: [NotificationBellComponent],
      providers: [
        { provide: InboxRealtimeService, useValue: realtime },
        { provide: NotificationsStore, useValue: storeStub },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: TaskApiService, useValue: { getNotificationNavigation: vi.fn() } },
        { provide: AuthStore, useValue: { authenticated: () => true, activeModules: () => [] } }
      ]
    });

    const fixture = TestBed.createComponent(NotificationBellComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(storeStub.markAllRead).not.toHaveBeenCalled();

    fixture.nativeElement.querySelector('[data-testid="notification-bell"]').click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(storeStub.markAllRead).toHaveBeenCalled();
  });

  it('does not mark notifications read when the bell is toggled closed', async () => {
    const storeStub = {
      unreadCount: () => 3,
      items: () => [],
      refreshUnreadCount: vi.fn().mockResolvedValue(undefined),
      loadMine: vi.fn().mockResolvedValue(undefined),
      markRead: vi.fn().mockResolvedValue(undefined),
      markAllRead: vi.fn().mockResolvedValue(undefined)
    };

    TestBed.configureTestingModule({
      imports: [NotificationBellComponent],
      providers: [
        { provide: InboxRealtimeService, useValue: realtime },
        { provide: NotificationsStore, useValue: storeStub },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: TaskApiService, useValue: { getNotificationNavigation: vi.fn() } },
        { provide: AuthStore, useValue: { authenticated: () => true, activeModules: () => [] } }
      ]
    });

    const fixture = TestBed.createComponent(NotificationBellComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const bell = fixture.nativeElement.querySelector('[data-testid="notification-bell"]');
    bell.click();
    fixture.detectChanges();
    await fixture.whenStable();
    storeStub.markAllRead.mockClear();

    bell.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(storeStub.markAllRead).not.toHaveBeenCalled();
  });

  it('does not poll unread count while the tray activation gate is blocking', async () => {
    const storeStub = {
      unreadCount: () => 0,
      items: () => [],
      refreshUnreadCount: vi.fn().mockResolvedValue(undefined),
      loadMine: vi.fn().mockResolvedValue(undefined),
      markRead: vi.fn().mockResolvedValue(undefined),
      markAllRead: vi.fn().mockResolvedValue(undefined)
    };

    TestBed.configureTestingModule({
      imports: [NotificationBellComponent],
      providers: [
        { provide: InboxRealtimeService, useValue: realtime },
        { provide: NotificationsStore, useValue: storeStub },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: TaskApiService, useValue: { getNotificationNavigation: vi.fn() } },
        { provide: AuthStore, useValue: { authenticated: () => true, activeModules: () => [] } },
        { provide: PermissionService, useValue: { hasModule: (m: string) => m === 'activity_monitoring' } },
        { provide: TrayPresenceStore, useValue: { canRenderProtectedContent: () => false } }
      ]
    });

    const fixture = TestBed.createComponent(NotificationBellComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(storeStub.refreshUnreadCount).not.toHaveBeenCalled();
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
        { provide: InboxRealtimeService, useValue: realtime },
        { provide: NotificationsStore, useValue: storeStub },
        { provide: Router, useValue: { navigate } },
        { provide: TaskApiService, useValue: { getNotificationNavigation } },
        { provide: AuthStore, useValue: { authenticated: () => true, activeModules: () => [] } }
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
      ['/work', 'p1', 'board'],
      { queryParams: { highlightTaskId: 't1' } }
    );
  });

  it('sends an objective_change_request that resolves to the old Approvals tab to the Inbox', async () => {
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
        { provide: InboxRealtimeService, useValue: realtime },
        { provide: NotificationsStore, useValue: storeStub },
        { provide: Router, useValue: { navigate } },
        { provide: TaskApiService, useValue: { getNotificationNavigation } },
        { provide: AuthStore, useValue: { authenticated: () => true, activeModules: () => [] } }
      ]
    });

    const fixture = TestBed.createComponent(NotificationBellComponent);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('[data-testid="notification-bell"]').click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.nativeElement.querySelector('.notification-dropdown__item').click();
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith(['/inbox']);
  });

  it('navigates an attendance correction approval notification to the request in the Inbox', async () => {
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
        { provide: InboxRealtimeService, useValue: realtime },
      { provide: NotificationsStore, useValue: storeStub }, { provide: Router, useValue: { navigate } },
      { provide: TaskApiService, useValue: { getNotificationNavigation: vi.fn() } },
        { provide: AuthStore, useValue: { authenticated: () => true, activeModules: () => [] } }
    ] });
    const fixture = TestBed.createComponent(NotificationBellComponent);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('[data-testid="notification-bell"]').click();
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.notification-dropdown__item').click();
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith(['/inbox', 'attendance', 'correction', 'c1']);
  });

  it('navigates a Work Area approval notification to the request in the Inbox', async () => {
    const item = {
      id: 'n-work-area', templateCode: 'work_area_change_request_created', title: 'Work-area request', body: 'Please review',
      relatedEntityType: 'work_area_change_request', relatedEntityId: 'wa-1', isRead: false, readAt: null, createdAt: new Date(),
      notificationType: 'work_area_change_request_created', attendanceCorrectionId: null, workAreaChangeRequestId: 'wa-1', destinationKey: 'work_area_change_approval', isNavigable: true
    };
    const storeStub = {
      unreadCount: () => 1, items: () => [item], refreshUnreadCount: vi.fn().mockResolvedValue(undefined),
      loadMine: vi.fn().mockResolvedValue(undefined), markRead: vi.fn().mockResolvedValue(undefined), markAllRead: vi.fn().mockResolvedValue(undefined)
    };
    const navigate = vi.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({ imports: [NotificationBellComponent], providers: [
        { provide: InboxRealtimeService, useValue: realtime },
      { provide: NotificationsStore, useValue: storeStub }, { provide: Router, useValue: { navigate } },
      { provide: TaskApiService, useValue: { getNotificationNavigation: vi.fn() } },
        { provide: AuthStore, useValue: { authenticated: () => true, activeModules: () => [] } }
    ] });
    const fixture = TestBed.createComponent(NotificationBellComponent);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('[data-testid="notification-bell"]').click();
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.notification-dropdown__item').click();
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith(['/inbox', 'attendance', 'work_mode_change', 'wa-1']);
  });

  it('opens my attendance history for a non-navigable requester correction notification', async () => {
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
        { provide: InboxRealtimeService, useValue: realtime },
      { provide: NotificationsStore, useValue: storeStub }, { provide: Router, useValue: { navigate } },
      { provide: TaskApiService, useValue: { getNotificationNavigation: vi.fn() } },
        { provide: AuthStore, useValue: { authenticated: () => true, activeModules: () => [] } }
    ] });
    const fixture = TestBed.createComponent(NotificationBellComponent);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('[data-testid="notification-bell"]').click();
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.notification-dropdown__item').click();
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith(['/attendance']);
  });

  it('shows Approve/Reject buttons only for an actionable work_approval_requested notification', async () => {
    const actionable = {
      id: 'n5', templateCode: 'work_approval_requested', title: 'Approval needed', body: 'Please review',
      relatedEntityType: 'work_approval_request', relatedEntityId: 'req-1', isRead: false, readAt: null, createdAt: new Date()
    };
    const decided = {
      id: 'n6', templateCode: 'work_approval_decided', title: 'Approval decided', body: 'It was approved',
      relatedEntityType: 'work_approval_request', relatedEntityId: 'req-2', isRead: false, readAt: null, createdAt: new Date()
    };
    const storeStub = {
      unreadCount: () => 2, items: () => [actionable, decided],
      refreshUnreadCount: vi.fn().mockResolvedValue(undefined), loadMine: vi.fn().mockResolvedValue(undefined),
      markRead: vi.fn().mockResolvedValue(undefined), markAllRead: vi.fn().mockResolvedValue(undefined)
    };
    TestBed.configureTestingModule({ imports: [NotificationBellComponent], providers: [
        { provide: InboxRealtimeService, useValue: realtime },
      { provide: NotificationsStore, useValue: storeStub },
      { provide: Router, useValue: { navigate: vi.fn() } },
      { provide: TaskApiService, useValue: { getNotificationNavigation: vi.fn() } },
      { provide: AuthStore, useValue: { authenticated: () => true, activeModules: () => [] } },
      { provide: WorkApprovalsApiService, useValue: { approveWorkApproval: vi.fn(), rejectWorkApproval: vi.fn() } }
    ] });
    const fixture = TestBed.createComponent(NotificationBellComponent);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('[data-testid="notification-bell"]').click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelectorAll('[data-testid="notification-approve"]').length).toBe(1);
    expect(fixture.nativeElement.querySelectorAll('[data-testid="notification-reject"]').length).toBe(1);
  });

  it('approves a work approval request from the bell, marks it read, and does not navigate', async () => {
    const item = {
      id: 'n7', templateCode: 'work_approval_requested', title: 'Approval needed', body: 'Please review',
      relatedEntityType: 'work_approval_request', relatedEntityId: 'req-7', isRead: false, readAt: null, createdAt: new Date()
    };
    const storeStub = {
      unreadCount: () => 1, items: () => [item],
      refreshUnreadCount: vi.fn().mockResolvedValue(undefined), loadMine: vi.fn().mockResolvedValue(undefined),
      markRead: vi.fn().mockResolvedValue(undefined), markAllRead: vi.fn().mockResolvedValue(undefined)
    };
    const approveWorkApproval = vi.fn().mockReturnValue(of({ id: 'req-7', status: 'approved' }));
    const navigate = vi.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({ imports: [NotificationBellComponent], providers: [
        { provide: InboxRealtimeService, useValue: realtime },
      { provide: NotificationsStore, useValue: storeStub },
      { provide: Router, useValue: { navigate } },
      { provide: TaskApiService, useValue: { getNotificationNavigation: vi.fn() } },
      { provide: AuthStore, useValue: { authenticated: () => true, activeModules: () => [] } },
      { provide: WorkApprovalsApiService, useValue: { approveWorkApproval, rejectWorkApproval: vi.fn() } }
    ] });
    const fixture = TestBed.createComponent(NotificationBellComponent);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('[data-testid="notification-bell"]').click();
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.nativeElement.querySelector('[data-testid="notification-approve"]').click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(approveWorkApproval).toHaveBeenCalledWith('req-7');
    expect(storeStub.markRead).toHaveBeenCalledWith('n7');
    expect(navigate).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[data-testid="notification-decision"]').textContent.trim()).toBe('Approved');
  });

  it('rejects a work approval request from the bell', async () => {
    const item = {
      id: 'n8', templateCode: 'work_approval_requested', title: 'Approval needed', body: 'Please review',
      relatedEntityType: 'work_approval_request', relatedEntityId: 'req-8', isRead: false, readAt: null, createdAt: new Date()
    };
    const storeStub = {
      unreadCount: () => 1, items: () => [item],
      refreshUnreadCount: vi.fn().mockResolvedValue(undefined), loadMine: vi.fn().mockResolvedValue(undefined),
      markRead: vi.fn().mockResolvedValue(undefined), markAllRead: vi.fn().mockResolvedValue(undefined)
    };
    const rejectWorkApproval = vi.fn().mockReturnValue(of({ id: 'req-8', status: 'rejected' }));
    TestBed.configureTestingModule({ imports: [NotificationBellComponent], providers: [
        { provide: InboxRealtimeService, useValue: realtime },
      { provide: NotificationsStore, useValue: storeStub },
      { provide: Router, useValue: { navigate: vi.fn() } },
      { provide: TaskApiService, useValue: { getNotificationNavigation: vi.fn() } },
      { provide: AuthStore, useValue: { authenticated: () => true, activeModules: () => [] } },
      { provide: WorkApprovalsApiService, useValue: { approveWorkApproval: vi.fn(), rejectWorkApproval } }
    ] });
    const fixture = TestBed.createComponent(NotificationBellComponent);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('[data-testid="notification-bell"]').click();
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.nativeElement.querySelector('[data-testid="notification-reject"]').click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(rejectWorkApproval).toHaveBeenCalledWith('req-8');
    expect(fixture.nativeElement.querySelector('[data-testid="notification-decision"]').textContent.trim()).toBe('Rejected');
  });

  it('shows "Already handled" when deciding an approval that was already resolved', async () => {
    const item = {
      id: 'n9', templateCode: 'work_approval_requested', title: 'Approval needed', body: 'Please review',
      relatedEntityType: 'work_approval_request', relatedEntityId: 'req-9', isRead: true, readAt: new Date(), createdAt: new Date()
    };
    const storeStub = {
      unreadCount: () => 0, items: () => [item],
      refreshUnreadCount: vi.fn().mockResolvedValue(undefined), loadMine: vi.fn().mockResolvedValue(undefined),
      markRead: vi.fn().mockResolvedValue(undefined), markAllRead: vi.fn().mockResolvedValue(undefined)
    };
    const rejectWorkApproval = vi.fn().mockReturnValue(throwError(() => new Error('409 Conflict')));
    TestBed.configureTestingModule({ imports: [NotificationBellComponent], providers: [
        { provide: InboxRealtimeService, useValue: realtime },
      { provide: NotificationsStore, useValue: storeStub },
      { provide: Router, useValue: { navigate: vi.fn() } },
      { provide: TaskApiService, useValue: { getNotificationNavigation: vi.fn() } },
      { provide: AuthStore, useValue: { authenticated: () => true, activeModules: () => [] } },
      { provide: WorkApprovalsApiService, useValue: { approveWorkApproval: vi.fn(), rejectWorkApproval } }
    ] });
    const fixture = TestBed.createComponent(NotificationBellComponent);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('[data-testid="notification-bell"]').click();
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.nativeElement.querySelector('[data-testid="notification-reject"]').click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(rejectWorkApproval).toHaveBeenCalledWith('req-9');
    expect(fixture.nativeElement.querySelector('[data-testid="notification-decision"]').textContent.trim()).toBe('Already handled');
  });

  it('disables the Approve/Reject buttons while a decision is in flight so a double-click cannot fire twice', async () => {
    const item = {
      id: 'n10', templateCode: 'work_approval_requested', title: 'Approval needed', body: 'Please review',
      relatedEntityType: 'work_approval_request', relatedEntityId: 'req-10', isRead: false, readAt: null, createdAt: new Date()
    };
    const storeStub = {
      unreadCount: () => 1, items: () => [item],
      refreshUnreadCount: vi.fn().mockResolvedValue(undefined), loadMine: vi.fn().mockResolvedValue(undefined),
      markRead: vi.fn().mockResolvedValue(undefined), markAllRead: vi.fn().mockResolvedValue(undefined)
    };
    let resolveApprove!: (value: unknown) => void;
    const pending = new Promise(resolve => { resolveApprove = resolve; });
    const approveWorkApproval = vi.fn().mockReturnValue({
      subscribe: (observer: { next: (v: unknown) => void; complete: () => void }) => {
        pending.then(value => { observer.next(value); observer.complete(); });
        return { unsubscribe: () => {} };
      }
    });
    TestBed.configureTestingModule({ imports: [NotificationBellComponent], providers: [
        { provide: InboxRealtimeService, useValue: realtime },
      { provide: NotificationsStore, useValue: storeStub },
      { provide: Router, useValue: { navigate: vi.fn() } },
      { provide: TaskApiService, useValue: { getNotificationNavigation: vi.fn() } },
      { provide: AuthStore, useValue: { authenticated: () => true, activeModules: () => [] } },
      { provide: WorkApprovalsApiService, useValue: { approveWorkApproval, rejectWorkApproval: vi.fn() } }
    ] });
    const fixture = TestBed.createComponent(NotificationBellComponent);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('[data-testid="notification-bell"]').click();
    fixture.detectChanges();
    await fixture.whenStable();

    const approveBtn: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="notification-approve"]');
    approveBtn.click();
    fixture.detectChanges();
    expect(approveBtn.disabled).toBe(true);
    approveBtn.click();
    resolveApprove({ id: 'req-10', status: 'approved' });
    await fixture.whenStable();

    expect(approveWorkApproval).toHaveBeenCalledTimes(1);
  });

  it('shows Accept/Decline (not Approve/Reject) for a project invitation notification', async () => {
    const item = {
      id: 'n11', templateCode: 'work_project_member_invited', title: 'Invited', body: 'Join the project',
      relatedEntityType: 'project_member_invitation', relatedEntityId: 'inv-11', isRead: false, readAt: null, createdAt: new Date()
    };
    const storeStub = {
      unreadCount: () => 1, items: () => [item],
      refreshUnreadCount: vi.fn().mockResolvedValue(undefined), loadMine: vi.fn().mockResolvedValue(undefined),
      markRead: vi.fn().mockResolvedValue(undefined), markAllRead: vi.fn().mockResolvedValue(undefined)
    };
    TestBed.configureTestingModule({ imports: [NotificationBellComponent], providers: [
        { provide: InboxRealtimeService, useValue: realtime },
      { provide: NotificationsStore, useValue: storeStub },
      { provide: Router, useValue: { navigate: vi.fn() } },
      { provide: TaskApiService, useValue: { getNotificationNavigation: vi.fn() } },
      { provide: AuthStore, useValue: { authenticated: () => true, activeModules: () => [] } },
      {
        provide: WorkApprovalsApiService,
        useValue: { acceptObjectiveInvitation: vi.fn(), rejectObjectiveInvitation: vi.fn() }
      }
    ] });
    const fixture = TestBed.createComponent(NotificationBellComponent);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('[data-testid="notification-bell"]').click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('[data-testid="notification-approve"]').textContent.trim()).toBe('Accept');
    expect(fixture.nativeElement.querySelector('[data-testid="notification-reject"]').textContent.trim()).toBe('Decline');
  });

  it('accepts a module/objective invitation from the bell', async () => {
    const item = {
      id: 'n12', templateCode: 'work_objective_invitation_created', title: 'Invited to milestone', body: 'Join as member',
      relatedEntityType: 'project_member_invitation', relatedEntityId: 'inv-12', isRead: false, readAt: null, createdAt: new Date()
    };
    const storeStub = {
      unreadCount: () => 1, items: () => [item],
      refreshUnreadCount: vi.fn().mockResolvedValue(undefined), loadMine: vi.fn().mockResolvedValue(undefined),
      markRead: vi.fn().mockResolvedValue(undefined), markAllRead: vi.fn().mockResolvedValue(undefined)
    };
    const acceptObjectiveInvitation = vi.fn().mockReturnValue(of(undefined));
    const navigate = vi.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({ imports: [NotificationBellComponent], providers: [
        { provide: InboxRealtimeService, useValue: realtime },
      { provide: NotificationsStore, useValue: storeStub },
      { provide: Router, useValue: { navigate } },
      { provide: TaskApiService, useValue: { getNotificationNavigation: vi.fn() } },
      { provide: AuthStore, useValue: { authenticated: () => true, activeModules: () => [] } },
      {
        provide: WorkApprovalsApiService,
        useValue: { acceptObjectiveInvitation, rejectObjectiveInvitation: vi.fn() }
      }
    ] });
    const fixture = TestBed.createComponent(NotificationBellComponent);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('[data-testid="notification-bell"]').click();
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.nativeElement.querySelector('[data-testid="notification-approve"]').click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(acceptObjectiveInvitation).toHaveBeenCalledWith('inv-12');
    expect(storeStub.markRead).toHaveBeenCalledWith('n12');
    expect(navigate).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[data-testid="notification-decision"]').textContent.trim()).toBe('Accepted');
  });

  it('declines a module/objective invitation from the bell', async () => {
    const item = {
      id: 'n13', templateCode: 'work_project_member_invited', title: 'Invited', body: 'Join the project',
      relatedEntityType: 'project_member_invitation', relatedEntityId: 'inv-13', isRead: false, readAt: null, createdAt: new Date()
    };
    const storeStub = {
      unreadCount: () => 1, items: () => [item],
      refreshUnreadCount: vi.fn().mockResolvedValue(undefined), loadMine: vi.fn().mockResolvedValue(undefined),
      markRead: vi.fn().mockResolvedValue(undefined), markAllRead: vi.fn().mockResolvedValue(undefined)
    };
    const rejectObjectiveInvitation = vi.fn().mockReturnValue(of(undefined));
    TestBed.configureTestingModule({ imports: [NotificationBellComponent], providers: [
        { provide: InboxRealtimeService, useValue: realtime },
      { provide: NotificationsStore, useValue: storeStub },
      { provide: Router, useValue: { navigate: vi.fn() } },
      { provide: TaskApiService, useValue: { getNotificationNavigation: vi.fn() } },
      { provide: AuthStore, useValue: { authenticated: () => true, activeModules: () => [] } },
      {
        provide: WorkApprovalsApiService,
        useValue: { acceptObjectiveInvitation: vi.fn(), rejectObjectiveInvitation }
      }
    ] });
    const fixture = TestBed.createComponent(NotificationBellComponent);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('[data-testid="notification-bell"]').click();
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.nativeElement.querySelector('[data-testid="notification-reject"]').click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(rejectObjectiveInvitation).toHaveBeenCalledWith('inv-13');
    expect(fixture.nativeElement.querySelector('[data-testid="notification-decision"]').textContent.trim()).toBe('Declined');
  });

  it('does not show Accept/Decline for a work_project_member_accepted confirmation notification', async () => {
    const item = {
      id: 'n14', templateCode: 'work_project_member_accepted', title: 'Invitation accepted', body: 'They joined',
      relatedEntityType: 'project_member_invitation', relatedEntityId: 'inv-14', isRead: false, readAt: null, createdAt: new Date()
    };
    const storeStub = {
      unreadCount: () => 1, items: () => [item],
      refreshUnreadCount: vi.fn().mockResolvedValue(undefined), loadMine: vi.fn().mockResolvedValue(undefined),
      markRead: vi.fn().mockResolvedValue(undefined), markAllRead: vi.fn().mockResolvedValue(undefined)
    };
    TestBed.configureTestingModule({ imports: [NotificationBellComponent], providers: [
        { provide: InboxRealtimeService, useValue: realtime },
      { provide: NotificationsStore, useValue: storeStub },
      { provide: Router, useValue: { navigate: vi.fn() } },
      { provide: TaskApiService, useValue: { getNotificationNavigation: vi.fn() } },
      { provide: AuthStore, useValue: { authenticated: () => true, activeModules: () => [] } },
      {
        provide: WorkApprovalsApiService,
        useValue: { acceptObjectiveInvitation: vi.fn(), rejectObjectiveInvitation: vi.fn() }
      }
    ] });
    const fixture = TestBed.createComponent(NotificationBellComponent);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('[data-testid="notification-bell"]').click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('[data-testid="notification-approve"]')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('[data-testid="notification-reject"]')).toBeFalsy();
  });
});
