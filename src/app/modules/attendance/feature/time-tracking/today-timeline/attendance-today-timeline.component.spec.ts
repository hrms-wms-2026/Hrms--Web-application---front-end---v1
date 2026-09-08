import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { TimelineEvent } from '../../../models/time-tracking.model';
import { TimeTrackingStore } from '../../../state/time-tracking.store';
import { AttendanceTodayTimelineComponent } from './attendance-today-timeline.component';

describe('AttendanceTodayTimelineComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function setup(): Promise<{
    fixture: ComponentFixture<AttendanceTodayTimelineComponent>;
    todayTimelineEvents: ReturnType<typeof signal<readonly TimelineEvent[]>>;
  }> {
    const todayTimelineEvents = signal<readonly TimelineEvent[]>([]);

    await TestBed.configureTestingModule({
      imports: [AttendanceTodayTimelineComponent],
      providers: [
        {
          provide: TimeTrackingStore,
          useValue: { todayTimelineEvents, todayTimelineLoading: signal(false), todayTimelineError: signal(null), today: signal(null) }
        }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(AttendanceTodayTimelineComponent);
    return { fixture, todayTimelineEvents };
  }

  it('shows an empty state with no events', async () => {
    const { fixture } = await setup();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No activity recorded yet today');
  });

  it('lists each timeline event with its humanized label', async () => {
    const { fixture, todayTimelineEvents } = await setup();
    todayTimelineEvents.set([{ eventType: 'ClockIn', timestamp: '2026-09-08T04:00:00Z', source: 'web' }]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Clocked in');
  });
});
