import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { NotificationNavigationService } from '../../../../core/services/notification-navigation.service';
import { NotificationsStore } from '../../../../core/state/notifications.store';
import { TimeTrackingStore } from '../../../attendance/state/time-tracking.store';
import { CalendarEventApiService } from '../../../calendar/data-access/calendar-event-api.service';
import { ActivityTimelineApiService } from '../../data-access/activity-timeline-api.service';
import { FocusStatusApiService } from '../../data-access/focus-status-api.service';
import { MyTasksApiService } from '../../data-access/my-tasks-api.service';
import { WorkPatternApiService } from '../../data-access/work-pattern-api.service';
import { DashboardHomeComponent } from './dashboard-home.component';

describe('DashboardHomeComponent', () => {
  async function setup() {
    const store = {
      today: signal(null),
      todayLoading: signal(false),
      todayError: signal(null),
      actionLoading: signal(false),
      activeAction: signal(null),
      history: signal([]),
      historyLoading: signal(false),
      historyError: signal(null),
      loadToday: () => Promise.resolve(),
      loadMyHistory: () => Promise.resolve(),
      startBreak: () => Promise.resolve(),
      endBreak: () => Promise.resolve()
    };

    await TestBed.configureTestingModule({
      imports: [DashboardHomeComponent],
      providers: [
        provideRouter([]),
        { provide: TimeTrackingStore, useValue: store },
        { provide: ActivityTimelineApiService, useValue: { getMyTimeline: () => of({ date: '', segments: [] }) } },
        { provide: MyTasksApiService, useValue: { getMyTasks: () => of({ tasks: [] }) } },
        { provide: WorkPatternApiService, useValue: { getMyWorkPattern: () => of({ days: [] }) } },
        { provide: FocusStatusApiService, useValue: { getMyFocusStatus: () => of({ isBreakReminderDue: false, continuousFocusMinutes: 0 }) } },
        { provide: CalendarEventApiService, useValue: { getEvents: () => of({ events: [] }), getMyTimezone: () => of({ timezone: 'UTC' }) } },
        { provide: AuthStore, useValue: { email: signal('arjun.kumar@onevo.dev'), employeeId: signal(null) } },
        {
          provide: NotificationsStore,
          useValue: {
            items: signal([]),
            unreadCount: signal(0),
            loading: signal(false),
            loadMine: () => Promise.resolve(),
            markRead: () => Promise.resolve(),
            markAllRead: () => Promise.resolve()
          }
        },
        { provide: NotificationNavigationService, useValue: { navigate: () => Promise.resolve() } }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(DashboardHomeComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('renders the dashboard cards without the removed placeholder UI', async () => {
    const fixture = await setup();

    const text = (fixture.nativeElement.textContent as string).trim();
    expect(text).not.toContain('Welcome');
    expect(text).not.toContain('Sign out');
  });

  it('renders the greeting, Today at a Glance, Quick Actions, My Tasks, Notifications, Today\'s Schedule, Work Pattern, and Wellbeing cards', async () => {
    const fixture = await setup();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Arjun Kumar');
    expect(text).toContain('Activity Timeline');
    expect(text).toContain('Quick Actions');
    expect(text).toContain('My Tasks');
    expect(text).toContain('Notifications');
    expect(text).toContain('Today\'s Schedule');
    expect(text).toContain('Work Pattern');
    expect(text).toContain('Wellbeing');
  });
});
