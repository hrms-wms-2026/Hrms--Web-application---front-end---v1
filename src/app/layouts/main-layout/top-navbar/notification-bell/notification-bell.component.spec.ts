import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { vi } from 'vitest';
import { NotificationBellComponent } from './notification-bell.component';
import { NotificationsStore } from '../../../../core/state/notifications.store';

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
        { provide: Router, useValue: { navigate } }
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

  it('marks item read and navigates on dropdown click', async () => {
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

    TestBed.configureTestingModule({
      imports: [NotificationBellComponent],
      providers: [
        { provide: NotificationsStore, useValue: storeStub },
        { provide: Router, useValue: { navigate } }
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
    expect(navigate).toHaveBeenCalledWith(['/work']);
  });
});
