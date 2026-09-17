import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { NotificationsStore } from '../../../../core/state/notifications.store';
import { NotificationItem } from '../../../../core/services/notification-api.service';
import { NotificationNavigationService } from '../../../../core/services/notification-navigation.service';
import { DashboardNotificationsCardComponent } from './dashboard-notifications-card.component';

function makeItem(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: 'n1',
    templateCode: 'x',
    title: 'Task assigned',
    body: 'You were assigned a new task',
    relatedEntityType: 'task',
    relatedEntityId: 'r1',
    isRead: false,
    readAt: null,
    createdAt: new Date(),
    ...overrides
  };
}

describe('DashboardNotificationsCardComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function setup(items: NotificationItem[] = [], unreadCount = 0): Promise<{
    fixture: ComponentFixture<DashboardNotificationsCardComponent>;
    store: { loadMine: ReturnType<typeof vi.fn>; markRead: ReturnType<typeof vi.fn>; markAllRead: ReturnType<typeof vi.fn> };
    navigate: ReturnType<typeof vi.fn>;
  }> {
    const store = {
      items: signal(items),
      unreadCount: signal(unreadCount),
      loading: signal(false),
      loadMine: vi.fn().mockResolvedValue(undefined),
      markRead: vi.fn().mockResolvedValue(undefined),
      markAllRead: vi.fn().mockResolvedValue(undefined)
    };
    const navigate = vi.fn().mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [DashboardNotificationsCardComponent],
      providers: [
        { provide: NotificationsStore, useValue: store },
        { provide: NotificationNavigationService, useValue: { navigate } }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(DashboardNotificationsCardComponent);
    fixture.detectChanges();
    return { fixture, store, navigate };
  }

  it('loads notifications on init', async () => {
    const { store } = await setup();
    expect(store.loadMine).toHaveBeenCalledOnce();
  });

  it('shows the empty state when there are no notifications', async () => {
    const { fixture } = await setup([]);
    expect(fixture.nativeElement.querySelector('[data-testid="dashboard-notifications-empty"]')).not.toBeNull();
  });

  it('shows at most 4 notifications', async () => {
    const items = Array.from({ length: 6 }, (_, i) => makeItem({ id: `n-${i}` }));
    const { fixture } = await setup(items);
    expect(fixture.nativeElement.querySelectorAll('[data-testid="dashboard-notifications-row"]').length).toBe(4);
  });

  it('marks an item read and navigates when clicked', async () => {
    const item = makeItem();
    const { fixture, store, navigate } = await setup([item]);

    fixture.nativeElement.querySelector('[data-testid="dashboard-notifications-row"]').click();
    await fixture.whenStable();

    expect(store.markRead).toHaveBeenCalledWith('n1');
    expect(navigate).toHaveBeenCalledWith(item);
  });

  it('shows "Mark all read" when there are unread notifications', async () => {
    const { fixture } = await setup([makeItem()], 1);
    expect(fixture.nativeElement.querySelector('[data-testid="dashboard-notifications-mark-all-read"]')).not.toBeNull();
  });

  it('hides "Mark all read" when nothing is unread', async () => {
    const { fixture } = await setup([makeItem({ isRead: true })], 0);
    expect(fixture.nativeElement.querySelector('[data-testid="dashboard-notifications-mark-all-read"]')).toBeNull();
  });

  it('marks all read when clicked', async () => {
    const { fixture, store } = await setup([makeItem()], 1);

    fixture.nativeElement.querySelector('[data-testid="dashboard-notifications-mark-all-read"]').click();
    await fixture.whenStable();

    expect(store.markAllRead).toHaveBeenCalledOnce();
  });
});
