import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TimeTrackingStore } from '../../../attendance/state/time-tracking.store';
import { DashboardHomeComponent } from './dashboard-home.component';

describe('DashboardHomeComponent', () => {
  async function setup() {
    const store = {
      today: signal(null),
      todayLoading: signal(false),
      todayError: signal(null),
      history: signal([]),
      historyLoading: signal(false),
      historyError: signal(null),
      loadToday: () => Promise.resolve(),
      loadMyHistory: () => Promise.resolve()
    };

    await TestBed.configureTestingModule({
      imports: [DashboardHomeComponent],
      providers: [{ provide: TimeTrackingStore, useValue: store }]
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
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });

  it('renders the Today at a Glance and Attendance Trend cards', async () => {
    const fixture = await setup();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Today at a glance');
    expect(text).toContain('Attendance Trend');
  });
});
