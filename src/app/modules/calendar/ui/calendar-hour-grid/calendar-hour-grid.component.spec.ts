import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { CalendarEventResponse } from '../../models/calendar-event.model';
import { CalendarHourGridComponent } from './calendar-hour-grid.component';

function makeEvent(id: string, date: string, startHHmm: string, endHHmm: string, isAllDay = false, hasConflict = false): CalendarEventResponse {
  return {
    id, title: id, description: null, startDate: `${date}T${startHHmm}:00Z`, endDate: `${date}T${endHHmm}:00Z`,
    sourceType: 'manual', color: '#2563EB', recurrence: 'none', isAllDay, timezone: 'UTC', eventStatus: null,
    isPrivate: false, location: null, meetingLink: null, externalSource: null, createdById: 'u1',
    isRecurringOccurrence: false, recurrenceMasterId: null, originalStart: null, participants: null, hasConflict
  };
}

describe('CalendarHourGridComponent', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<CalendarHourGridComponent>>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CalendarHourGridComponent] }).compileComponents();
    fixture = TestBed.createComponent(CalendarHourGridComponent);
    fixture.componentRef.setInput('days', ['2026-09-01', '2026-09-02']);
    fixture.componentRef.setInput('events', [
      makeEvent('timed', '2026-09-01', '09:00', '10:00'),
      makeEvent('allday', '2026-09-02', '00:00', '23:59', true)
    ]);
    fixture.detectChanges();
  });

  it('renders 24 hour labels', () => {
    expect(fixture.nativeElement.querySelectorAll('[data-testid="calendar-hour-label"]').length).toBe(24);
  });

  it('renders one day column per input day', () => {
    expect(fixture.nativeElement.querySelectorAll('[data-testid="calendar-hour-day-column"]').length).toBe(2);
  });

  it('places the timed event as a positioned block in its own day column', () => {
    const column = fixture.nativeElement.querySelector('[data-date="2026-09-01"]');
    const block = column.querySelector('[data-testid="calendar-hour-event-block"]');
    expect(block).not.toBeNull();
    expect(block.style.top).not.toBe('');
  });

  it('places the all-day event in the all-day row, not the hourly area', () => {
    const allDayRow = fixture.nativeElement.querySelector('[data-testid="calendar-hour-allday-row"]');
    expect(allDayRow.querySelector('[data-testid="calendar-hour-allday-chip"]')).not.toBeNull();
  });

  it('emits eventClick when a positioned event block is clicked', () => {
    const spy = vi.fn();
    fixture.componentInstance.eventClick.subscribe(spy);
    fixture.nativeElement.querySelector('[data-testid="calendar-hour-event-block"]').click();
    expect(spy).toHaveBeenCalledWith('timed');
  });

  it('emits slotClick with the clicked column\'s date when an empty area is pressed without dragging', () => {
    const spy = vi.fn();
    fixture.componentInstance.slotClick.subscribe(spy);
    const column = fixture.nativeElement.querySelector('[data-date="2026-09-01"] [data-testid="calendar-hour-slots"]') as HTMLElement;
    const ev = (type: string) => {
      const e = new Event(type, { bubbles: true }) as Event & { button: number; clientY: number; pointerId: number };
      e.button = 0; e.clientY = 0; e.pointerId = 1;
      return e;
    };
    column.dispatchEvent(ev('pointerdown'));
    document.dispatchEvent(ev('pointerup'));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].date).toBe('2026-09-01');
  });

  it('buckets an event into the correct day column using the given timezone, not the raw UTC date', () => {
    // 2026-09-01T20:00:00Z is already 2026-09-02 local time in Asia/Colombo (UTC+5:30)
    fixture.componentRef.setInput('timezone', 'Asia/Colombo');
    fixture.componentRef.setInput('days', ['2026-09-01', '2026-09-02']);
    fixture.componentRef.setInput('events', [makeEvent('late', '2026-09-01', '20:00', '20:30')]);
    fixture.detectChanges();

    expect(fixture.componentInstance.columns()[0].positioned.length).toBe(0);
    expect(fixture.componentInstance.columns()[1].positioned.length).toBe(1);
  });

  it('renders a conflict indicator on a timed event block flagged hasConflict', () => {
    fixture.componentRef.setInput('events', [makeEvent('timed', '2026-09-01', '09:00', '10:00', false, true)]);
    fixture.detectChanges();
    const block = fixture.nativeElement.querySelector('[data-testid="calendar-hour-event-block"]');
    expect(block.querySelector('[data-testid="calendar-conflict-marker"]')).not.toBeNull();
  });

  it('does not render a conflict indicator on a non-conflicting timed event block', () => {
    const block = fixture.nativeElement.querySelector('[data-testid="calendar-hour-event-block"]');
    expect(block.querySelector('[data-testid="calendar-conflict-marker"]')).toBeNull();
  });

  it('renders a conflict indicator on an all-day chip flagged hasConflict', () => {
    fixture.componentRef.setInput('events', [makeEvent('allday', '2026-09-02', '00:00', '23:59', true, true)]);
    fixture.detectChanges();
    const chip = fixture.nativeElement.querySelector('[data-testid="calendar-hour-allday-chip"]');
    expect(chip.querySelector('[data-testid="calendar-conflict-marker"]')).not.toBeNull();
  });

  it('scrolls the "now" line into view once, on first load, when today is shown', async () => {
    vi.useFakeTimers();
    const scrollIntoView = vi.fn();
    const original = (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView = scrollIntoView;
    try {
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(new Date());
      const f = TestBed.createComponent(CalendarHourGridComponent);
      f.componentRef.setInput('timezone', 'UTC');
      f.componentRef.setInput('days', [today]);
      f.componentRef.setInput('events', []);
      f.detectChanges();
      await vi.advanceTimersByTimeAsync(400);
      f.detectChanges();

      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      expect(scrollIntoView.mock.calls[0][0]).toMatchObject({ block: 'center' });

      scrollIntoView.mockClear();
      await vi.advanceTimersByTimeAsync(60_000);
      f.detectChanges();
      expect(scrollIntoView).not.toHaveBeenCalled();
    } finally {
      (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView = original;
      vi.useRealTimers();
    }
  });

  it('does not auto-scroll when the shown day is not today', async () => {
    vi.useFakeTimers();
    const scrollIntoView = vi.fn();
    const original = (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView = scrollIntoView;
    try {
      const f = TestBed.createComponent(CalendarHourGridComponent);
      f.componentRef.setInput('timezone', 'UTC');
      f.componentRef.setInput('days', ['2001-01-01']);
      f.componentRef.setInput('events', []);
      f.detectChanges();
      await vi.advanceTimersByTimeAsync(400);
      f.detectChanges();
      expect(scrollIntoView).not.toHaveBeenCalled();
    } finally {
      (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView = original;
      vi.useRealTimers();
    }
  });

  it('advances the "now" line as the clock ticks instead of freezing at first render', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-09-01T03:00:00Z'));
      const tzFixture = TestBed.createComponent(CalendarHourGridComponent);
      tzFixture.componentRef.setInput('days', ['2026-09-01']);
      tzFixture.componentRef.setInput('timezone', 'UTC');
      tzFixture.componentRef.setInput('events', []);
      tzFixture.detectChanges();

      const lineAt = () =>
        Number(tzFixture.nativeElement.querySelector('[data-testid="calendar-now-line"]').style.top.replace('%', ''));

      expect(lineAt()).toBeCloseTo((3 / 24) * 100, 1);

      vi.setSystemTime(new Date('2026-09-01T09:00:00Z'));
      vi.advanceTimersByTime(30_000);
      tzFixture.detectChanges();

      expect(lineAt()).toBeCloseTo((9 / 24) * 100, 1);
    } finally {
      vi.useRealTimers();
    }
  });

  describe('drag to select a time range', () => {
    // jsdom has no layout: pin the column's rect so 1px == 1 minute over a 1440px day.
    function pinColumnRect(): void {
      const slots = fixture.nativeElement.querySelector('[data-date="2026-09-01"] [data-testid="calendar-hour-slots"]') as HTMLElement;
      vi.spyOn(slots, 'getBoundingClientRect').mockReturnValue({
        top: 0, bottom: 1440, left: 0, right: 100, width: 100, height: 1440, x: 0, y: 0, toJSON: () => ({})
      } as DOMRect);
    }
    const ptr = (type: string, clientY: number): Event => {
      const e = new Event(type, { bubbles: true }) as Event & { button: number; clientY: number; pointerId: number };
      e.button = 0;
      e.clientY = clientY;
      e.pointerId = 1;
      return e;
    };
    const slots = () => fixture.nativeElement.querySelector('[data-date="2026-09-01"] [data-testid="calendar-hour-slots"]') as HTMLElement;

    beforeEach(() => {
      fixture.componentRef.setInput('days', ['2026-09-01']);
      fixture.componentRef.setInput('events', []);
      fixture.detectChanges();
      pinColumnRect();
    });

    it('emits slotRange with 15-min-snapped, ordered bounds after a press-drag', () => {
      const spy = vi.fn();
      fixture.componentInstance.slotRange.subscribe(spy);

      slots().dispatchEvent(ptr('pointerdown', 122)); // 122 -> snaps to 120 (02:00)
      document.dispatchEvent(ptr('pointermove', 313)); // 313 -> snaps to 315 (05:15)
      document.dispatchEvent(ptr('pointerup', 313));

      expect(spy).toHaveBeenCalledWith({ date: '2026-09-01', startMinutes: 120, endMinutes: 315 });
    });

    it('orders the range when dragged upward', () => {
      const spy = vi.fn();
      fixture.componentInstance.slotRange.subscribe(spy);
      slots().dispatchEvent(ptr('pointerdown', 600)); // 10:00
      document.dispatchEvent(ptr('pointermove', 450)); // 07:30
      document.dispatchEvent(ptr('pointerup', 450));
      expect(spy).toHaveBeenCalledWith({ date: '2026-09-01', startMinutes: 450, endMinutes: 600 });
    });

    it('falls back to slotClick when the press does not move', () => {
      const range = vi.fn();
      const click = vi.fn();
      fixture.componentInstance.slotRange.subscribe(range);
      fixture.componentInstance.slotClick.subscribe(click);

      slots().dispatchEvent(ptr('pointerdown', 130)); // 02:xx
      document.dispatchEvent(ptr('pointerup', 130));

      expect(range).not.toHaveBeenCalled();
      expect(click).toHaveBeenCalledWith({ date: '2026-09-01', hour: 2 });
    });

    it('maps the pointer against the full 24h stack, not the clipped scroll viewport', () => {
      // Real DOM: the day column is pinned to 1152px but sits in a max-h-[70vh] scroll
      // container, so getBoundingClientRect().height is the visible slice (~511) while
      // scrollHeight is the true 1152. minutesAt must divide by the latter.
      const spy = vi.fn();
      fixture.componentInstance.slotRange.subscribe(spy);
      const el = slots();
      vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
        top: 0, bottom: 511, left: 0, right: 100, width: 100, height: 511, x: 0, y: 0, toJSON: () => ({})
      } as DOMRect);
      Object.defineProperty(el, 'scrollHeight', { value: 1152, configurable: true });

      el.dispatchEvent(ptr('pointerdown', 576)); // 576/1152 = 0.5 -> 720 (12:00)
      document.dispatchEvent(ptr('pointermove', 720)); // 720/1152 = 0.625 -> 900 (15:00)
      document.dispatchEvent(ptr('pointerup', 720));

      expect(spy).toHaveBeenCalledWith({ date: '2026-09-01', startMinutes: 720, endMinutes: 900 });
    });

    it('renders a selection block while dragging and clears it on release', () => {
      slots().dispatchEvent(ptr('pointerdown', 120));
      document.dispatchEvent(ptr('pointermove', 240));
      fixture.detectChanges();
      const block = fixture.nativeElement.querySelector('[data-testid="calendar-hour-drag-selection"]');
      expect(block).not.toBeNull();
      expect(Number(block.style.top.replace('%', ''))).toBeCloseTo((120 / 1440) * 100, 1);
      expect(Number(block.style.height.replace('%', ''))).toBeCloseTo((120 / 1440) * 100, 1);

      document.dispatchEvent(ptr('pointerup', 240));
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[data-testid="calendar-hour-drag-selection"]')).toBeNull();
    });
  });
});
