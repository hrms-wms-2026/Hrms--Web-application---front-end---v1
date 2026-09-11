import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { TimeTrackingStore } from '../../../attendance/state/time-tracking.store';
import { TaskProgressApiService } from '../../data-access/task-progress-api.service';
import { MyInsightsPageComponent } from './my-insights-page.component';

describe('MyInsightsPageComponent', () => {
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
      imports: [MyInsightsPageComponent],
      providers: [
        provideRouter([]),
        { provide: TimeTrackingStore, useValue: store },
        { provide: TaskProgressApiService, useValue: { getMyTaskProgress: () => of({ completed: 0, inProgress: 0, notStarted: 0, overdue: 0, total: 0 }) } }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(MyInsightsPageComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('renders a back-to-home link and the page title', async () => {
    const fixture = await setup();
    expect(fixture.nativeElement.querySelector('[data-testid="back-to-home-link"]').getAttribute('href')).toBe('/dashboard');
    expect((fixture.nativeElement.textContent as string)).toContain('My Insights');
  });

  it('renders the Task Progress and Attendance Trend cards', async () => {
    const fixture = await setup();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Task Progress');
    expect(text).toContain('Attendance Trend');
  });
});
