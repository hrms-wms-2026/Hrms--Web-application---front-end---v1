import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { AttendanceTodayResponse, TimelineEvent } from '../../../models/time-tracking.model';
import { TimeTrackingStore } from '../../../state/time-tracking.store';
import { AttendanceTodayTimelineComponent } from './attendance-today-timeline.component';

describe('AttendanceTodayTimelineComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function setup(): Promise<{
    fixture: ComponentFixture<AttendanceTodayTimelineComponent>;
    todayTimelineEvents: ReturnType<typeof signal<readonly TimelineEvent[]>>;
    today: ReturnType<typeof signal<Partial<AttendanceTodayResponse> | null>>;
  }> {
    const todayTimelineEvents = signal<readonly TimelineEvent[]>([]);
    const today = signal<Partial<AttendanceTodayResponse> | null>(null);

    await TestBed.configureTestingModule({
      imports: [AttendanceTodayTimelineComponent],
      providers: [
        {
          provide: TimeTrackingStore,
          useValue: { todayTimelineEvents, todayTimelineLoading: signal(false), todayTimelineError: signal(null), today }
        }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(AttendanceTodayTimelineComponent);
    return { fixture, todayTimelineEvents, today };
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

  it('appends a live "Now" row while still clocked in or on break', async () => {
    const { fixture, todayTimelineEvents, today } = await setup();
    todayTimelineEvents.set([{ eventType: 'ClockIn', timestamp: '2026-09-08T04:00:00Z', source: 'web' }]);
    today.set({ attendanceStatus: 'working', attendanceStatusLabel: null, totalWorkedMinutes: 177 });
    fixture.detectChanges();

    const nowRow = fixture.nativeElement.querySelector('.today-timeline-item--now');
    expect(nowRow?.textContent).toContain('Working');
    expect(nowRow?.textContent).toContain('2h 57m');
    expect(nowRow?.textContent).toContain('Now');
  });

  it('does not show a "Now" row once clocked out', async () => {
    const { fixture, todayTimelineEvents, today } = await setup();
    todayTimelineEvents.set([{ eventType: 'ClockOut', timestamp: '2026-09-08T12:00:00Z', source: 'web' }]);
    today.set({ attendanceStatus: 'clocked_out', attendanceStatusLabel: null, totalWorkedMinutes: 480 });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.today-timeline-item--now')).toBeNull();
  });

  it('only displays first 3 items in the inline card when more than 3 events exist, and shows a more button', async () => {
    const { fixture, todayTimelineEvents, today } = await setup();
    todayTimelineEvents.set([
      { eventType: 'ClockIn', timestamp: '2026-09-09T04:17:00Z', source: 'web' },
      { eventType: 'BreakStart', timestamp: '2026-09-09T06:11:00Z', source: 'web' },
      { eventType: 'BreakEnd', timestamp: '2026-09-09T06:14:00Z', source: 'web' },
      { eventType: 'BreakStart', timestamp: '2026-09-09T06:14:00Z', source: 'web' },
      { eventType: 'BreakEnd', timestamp: '2026-09-09T06:16:00Z', source: 'web' }
    ]);
    today.set({ attendanceStatus: 'clocked_out', attendanceStatusLabel: null, totalWorkedMinutes: 115 });
    fixture.detectChanges();

    const inlineItems = fixture.nativeElement.querySelectorAll('.today-timeline-item');
    expect(inlineItems.length).toBe(3);

    const moreBtn = fixture.nativeElement.querySelector('.today-timeline-more-btn');
    expect(moreBtn).not.toBeNull();
    expect(moreBtn?.textContent).toContain('+2 more actions');
    expect(moreBtn?.textContent).toContain('View full timeline & chart');
  });

  it('opens the modal with circle chart and all events when clicking the more button', async () => {
    const { fixture, todayTimelineEvents, today } = await setup();
    todayTimelineEvents.set([
      { eventType: 'ClockIn', timestamp: '2026-09-09T04:17:00Z', source: 'web' },
      { eventType: 'BreakStart', timestamp: '2026-09-09T06:11:00Z', source: 'web' },
      { eventType: 'BreakEnd', timestamp: '2026-09-09T06:14:00Z', source: 'web' },
      { eventType: 'BreakStart', timestamp: '2026-09-09T06:14:00Z', source: 'web' },
      { eventType: 'BreakEnd', timestamp: '2026-09-09T06:16:00Z', source: 'web' }
    ]);
    today.set({
      attendanceStatus: 'working',
      attendanceStatusLabel: null,
      totalWorkedMinutes: 115,
      requiredWorkMinutes: 360,
      breakUsedMinutes: 4,
      breakAllowanceMinutes: 33,
      workDate: '2026-09-09',
      timezone: 'Asia/Colombo'
    });
    fixture.detectChanges();

    const moreBtn = fixture.nativeElement.querySelector('.today-timeline-more-btn') as HTMLButtonElement;
    moreBtn.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.isModalOpen()).toBe(true);

    const modalTitle = fixture.nativeElement.querySelector('h2');
    expect(modalTitle?.textContent).toContain("Today's Activity & Time Distribution");

    // Check circular chart rendering
    const circleChart = fixture.nativeElement.querySelector('.circle-chart-svg');
    expect(circleChart).not.toBeNull();
    expect(circleChart?.textContent).toContain('1h 55m');
    expect(circleChart?.textContent).toContain('32% completed');

    // Check full stepper timeline items in modal
    const stepperItems = fixture.nativeElement.querySelectorAll('.modal-stepper-item');
    // 5 historical events + 1 live "Now" item = 6 items
    expect(stepperItems.length).toBe(6);

    // Verify break duration is computed (11:41 to 11:44 = 3m break)
    const durationBadges = fixture.nativeElement.querySelectorAll('.modal-badge--duration');
    expect(durationBadges.length).toBeGreaterThanOrEqual(1);
    expect(durationBadges[0].textContent).toContain('3m break');

    // Verify source is displayed under the timestamp
    const sourceLabels = fixture.nativeElement.querySelectorAll('.modal-stepper-source');
    expect(sourceLabels.length).toBeGreaterThanOrEqual(1);
    expect(sourceLabels[0].textContent).toContain('via web');

    // Close modal
    const closeBtn = fixture.nativeElement.querySelector('.modal-close-btn') as HTMLButtonElement;
    closeBtn.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.isModalOpen()).toBe(false);
  });
});
