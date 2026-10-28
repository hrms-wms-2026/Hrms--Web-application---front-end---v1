import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { CalendarEventResponse } from '../../models/calendar-event.model';
import { PlannerRangeBlockView, PlannerWorkWindow } from '../../../work/planner/models/planner.models';
import { PlannerDragService } from '../../state/planner-drag.service';
import { CalendarHourGridComponent } from './calendar-hour-grid.component';

/** Planner = Calendar (2026-10-27 design, sections 4.3-4.5): blocks, bands, overlap and pointer drag in the hour grid. */

const TODAY = '2026-11-02';
const PAST = '2026-11-01';
const at = (date: string, hhmm: string) => `${date}T${hhmm}:00Z`;

function block(id: string, date: string, from: string, to: string, extra: Partial<PlannerRangeBlockView> = {}): PlannerRangeBlockView {
  const minutes = (Date.parse(at(date, to)) - Date.parse(at(date, from))) / 60000;
  return {
    id, taskId: `task-${id}`, projectId: 'p1', taskTitle: `Block ${id}`, startAt: at(date, from), endAt: at(date, to),
    plannedMinutes: minutes, actualMinutes: 15, stillAssigned: true, ...extra,
  };
}

function meeting(id: string, date: string, from: string, to: string): CalendarEventResponse {
  return {
    id, title: id, description: null, startDate: at(date, from), endDate: at(date, to), sourceType: 'manual', color: null,
    recurrence: 'none', isAllDay: false, timezone: 'UTC', eventStatus: null, isPrivate: false, location: null, meetingLink: null,
    externalSource: null, createdById: 'u1', isRecurringOccurrence: false, recurrenceMasterId: null, originalStart: null,
    participants: null, itemKind: 'meeting',
  } as CalendarEventResponse;
}

const window9to17: PlannerWorkWindow = {
  workStart: '09:00:00', workEnd: '17:00:00', breakMinutes: 60, breakStart: '12:30:00', isWorkingDay: true, workingMinutes: 420,
};

const ptr = (type: string, clientX: number, clientY: number): Event => {
  const e = new Event(type, { bubbles: true }) as Event & { button: number; clientX: number; clientY: number; pointerId: number };
  e.button = 0;
  e.clientX = clientX;
  e.clientY = clientY;
  e.pointerId = 1;
  return e;
};

describe('CalendarHourGridComponent planner layer', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<CalendarHourGridComponent>>;
  let drag: PlannerDragService;
  const q = (sel: string): HTMLElement | null => fixture.nativeElement.querySelector(sel);
  const qa = (sel: string): HTMLElement[] => Array.from(fixture.nativeElement.querySelectorAll(sel));

  function render(blocks: Record<string, PlannerRangeBlockView[]>, events: CalendarEventResponse[] = []): void {
    fixture.componentRef.setInput('events', events);
    fixture.componentRef.setInput('blocks', new Map(Object.entries(blocks)));
    fixture.detectChanges();
    // jsdom has no layout: column i spans x [i*100, i*100+100) and 1px == 1 minute over a 1440px day.
    qa('[data-testid="calendar-hour-day-column"]').forEach((col, i) => {
      vi.spyOn(col, 'getBoundingClientRect').mockReturnValue({
        top: 0, bottom: 1440, left: i * 100, right: i * 100 + 100, width: 100, height: 1440, x: i * 100, y: 0, toJSON: () => ({}),
      } as DOMRect);
      Object.defineProperty(col, 'scrollHeight', { value: 1440, configurable: true });
    });
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CalendarHourGridComponent] }).compileComponents();
    drag = TestBed.inject(PlannerDragService);
    drag.end();
    fixture = TestBed.createComponent(CalendarHourGridComponent);
    fixture.componentRef.setInput('days', [PAST, TODAY]);
    fixture.componentRef.setInput('timezone', 'UTC');
    fixture.componentRef.setInput('editableDates', new Set([TODAY]));
    fixture.componentRef.setInput('workWindows', new Map([[TODAY, window9to17], [PAST, window9to17]]));
  });

  it('draws a block with a height proportional to its length and its times', () => {
    render({ [TODAY]: [block('a', TODAY, '09:00', '10:30')] });

    const el = q('[data-testid="planner-block"]')!;
    expect(el.style.height).toBe(`${(90 / 1440) * 100}%`);
    expect(el.textContent).toContain('Block a');
    expect(el.textContent).toContain('09:00–10:30');
    expect(el.textContent).toContain('1h 30m');
    expect(el.getAttribute('title')).toBe('Block a · 09:00–10:30 · 1h 30m planned · 15m actual');
  });

  it('shades outside working hours, and draws no break band (its time is only a guess from the schedule)', () => {
    render({});

    const column = q(`[data-date="${TODAY}"]`)!;
    expect(column.querySelectorAll('[data-testid="planner-off-hours"]').length).toBe(2);
    expect(column.querySelector('[data-testid="planner-break"]')).toBeNull();
  });

  it('tints the overlapping part amber and offers Move after, only when a meeting overlaps', () => {
    const spy = vi.fn();
    fixture.componentInstance.blockMoveAfter.subscribe(spy);
    render({ [TODAY]: [block('a', TODAY, '09:00', '10:30'), block('b', TODAY, '14:00', '15:00')] },
      [meeting('Sprint sync', TODAY, '10:00', '11:00')]);

    expect(qa('[data-testid="planner-overlap"]').length).toBe(1);
    const pill = q('[data-testid="planner-overlap-pill"]')!;
    expect(pill.textContent).toContain('Overlaps Sprint sync · Move after');
    pill.click();

    expect(spy).toHaveBeenCalledWith({ block: expect.objectContaining({ id: 'a' }), date: TODAY, afterMinute: 660 });
  });

  it('moves a block two slots down by dragging it', () => {
    const spy = vi.fn();
    fixture.componentInstance.blockMove.subscribe(spy);
    render({ [TODAY]: [block('a', TODAY, '09:00', '10:00')] });

    q('[data-testid="planner-block"]')!.dispatchEvent(ptr('pointerdown', 150, 560));
    document.dispatchEvent(ptr('pointermove', 150, 620));
    document.dispatchEvent(ptr('pointerup', 150, 620));

    expect(spy).toHaveBeenCalledWith({ blockId: 'a', date: TODAY, startMinutes: 600, endMinutes: 660 });
  });

  it('a press without movement opens the block instead', () => {
    const open = vi.fn();
    const move = vi.fn();
    fixture.componentInstance.blockOpen.subscribe(open);
    fixture.componentInstance.blockMove.subscribe(move);
    render({ [TODAY]: [block('a', TODAY, '09:00', '10:00')] });

    q('[data-testid="planner-block"]')!.dispatchEvent(ptr('pointerdown', 150, 560));
    document.dispatchEvent(ptr('pointerup', 150, 562));

    expect(open).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }));
    expect(move).not.toHaveBeenCalled();
  });

  it('makes a block longer by dragging its bottom edge', () => {
    const spy = vi.fn();
    fixture.componentInstance.blockMove.subscribe(spy);
    render({ [TODAY]: [block('a', TODAY, '09:00', '10:00')] });

    q('[data-testid="planner-block-resize"]')!.dispatchEvent(ptr('pointerdown', 150, 600));
    document.dispatchEvent(ptr('pointermove', 150, 630));
    document.dispatchEvent(ptr('pointerup', 150, 630));

    expect(spy).toHaveBeenCalledWith({ blockId: 'a', date: TODAY, startMinutes: 540, endMinutes: 630 });
  });

  it('drops a dragged Focus task sized to its estimate, but not onto another block', () => {
    const spy = vi.fn();
    fixture.componentInstance.blockCreate.subscribe(spy);
    render({ [TODAY]: [block('a', TODAY, '13:00', '14:00')] });

    drag.dragging.set({ taskId: 't9', projectId: 'p1', title: 'Payroll export fix', minutes: 180 });
    fixture.detectChanges();
    document.dispatchEvent(ptr('pointermove', 150, 600));
    fixture.detectChanges();
    expect(q('[data-testid="planner-drop-preview"]')!.getAttribute('data-invalid')).toBe('false');
    document.dispatchEvent(ptr('pointerup', 150, 600));

    // 10:00 + 3h would run into the 13:00 block, so the drop stops there.
    expect(spy).toHaveBeenCalledWith({ taskId: 't9', date: TODAY, startMinutes: 600, endMinutes: 780 });

    spy.mockClear();
    drag.dragging.set({ taskId: 't9', projectId: 'p1', title: 'Payroll export fix', minutes: 60 });
    fixture.detectChanges();
    document.dispatchEvent(ptr('pointermove', 150, 790));
    fixture.detectChanges();
    expect(q('[data-testid="planner-drop-preview"]')!.getAttribute('data-invalid')).toBe('true');
    document.dispatchEvent(ptr('pointerup', 150, 790));
    expect(spy).not.toHaveBeenCalled();
  });

  it('keeps a past day read-only: no handle, no menu, no drop', () => {
    const spy = vi.fn();
    fixture.componentInstance.blockCreate.subscribe(spy);
    render({ [PAST]: [block('old', PAST, '09:00', '10:00')] });

    expect(q('[data-testid="planner-block-resize"]')).toBeNull();
    expect(q('[data-testid="planner-block-menu"]')).toBeNull();

    drag.dragging.set({ taskId: 't9', projectId: 'p1', title: 'Fix', minutes: 60 });
    fixture.detectChanges();
    document.dispatchEvent(ptr('pointermove', 50, 600));
    fixture.detectChanges();
    expect(q('[data-testid="planner-drop-preview"]')).toBeNull();
    document.dispatchEvent(ptr('pointerup', 50, 600));
    expect(spy).not.toHaveBeenCalled();
  });

  it('shows each day\'s load under its date, red with "· Over" when over', () => {
    fixture.componentRef.setInput('loads', new Map([
      [TODAY, { plannedMinutes: 450, workingMinutes: 420, over: true }],
      [PAST, { plannedMinutes: 330, workingMinutes: 420, over: false }],
    ]));
    render({});

    const loads = qa('[data-testid="planner-load"]');
    expect(loads[0].textContent).toContain('5h 30m / 7h');
    expect(loads[0].querySelector('[data-testid="planner-load-label"]')!.className).not.toContain('color-danger');
    expect(loads[1].textContent).toContain('7h 30m / 7h · Over');
    expect(loads[1].getAttribute('data-over')).toBe('true');
    expect(loads[1].querySelector('[data-testid="planner-load-label"]')!.className).toContain('text-[var(--color-danger)]');
  });

  describe('day headers and today', () => {
    afterEach(() => vi.useRealTimers());

    function renderAt(nowIso: string): void {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(nowIso));
      fixture = TestBed.createComponent(CalendarHourGridComponent);
      fixture.componentRef.setInput('days', [PAST, TODAY]);
      fixture.componentRef.setInput('timezone', 'UTC');
      fixture.componentRef.setInput('workWindows', new Map([[TODAY, window9to17], [PAST, window9to17]]));
      fixture.detectChanges();
    }

    it('each header reads the weekday, then the day and month', () => {
      renderAt('2026-11-02T10:00:00Z');

      const past = qa('[data-testid="calendar-hour-header-cell"]')[0];
      expect(past.querySelector('[data-testid="calendar-hour-weekday"]')!.textContent!.trim()).toBe('Sun');
      expect(past.querySelector('[data-testid="calendar-hour-daylabel"]')!.textContent!.trim()).toBe('1 Nov');
    });

    it("today's column and header are tinted, and its date sits in an accent circle", () => {
      renderAt('2026-11-02T10:00:00Z');

      const tinted = qa('[data-testid="calendar-hour-day-column"][data-today="true"]');
      expect(tinted.map((c) => c.getAttribute('data-date'))).toEqual([TODAY]);
      expect(qa('[data-testid="calendar-hour-header-cell"][data-today="true"]').length).toBe(1);
      expect(q('[data-testid="calendar-hour-header-today"]')!.textContent!.trim()).toBe('2');
    });

    it('no column is tinted on a week without today', () => {
      renderAt('2026-12-15T10:00:00Z');

      expect(qa('[data-today="true"]').length).toBe(0);
    });
  });

  it('the block menu moves, resizes and removes on editable days', () => {
    const move = vi.fn();
    const remove = vi.fn();
    fixture.componentInstance.blockMove.subscribe(move);
    fixture.componentInstance.blockRemove.subscribe(remove);
    render({ [TODAY]: [block('a', TODAY, '09:00', '10:00')] });

    q('[data-testid="planner-block-menu"]')!.click();
    fixture.detectChanges();
    (q('[data-testid="planner-menu-later"]') as HTMLButtonElement).click();
    expect(move).toHaveBeenLastCalledWith({ blockId: 'a', date: TODAY, startMinutes: 555, endMinutes: 615 });
    (q('[data-testid="planner-menu-shorter"]') as HTMLButtonElement).click();
    expect(move).toHaveBeenLastCalledWith({ blockId: 'a', date: TODAY, startMinutes: 540, endMinutes: 585 });
    (q('[data-testid="planner-menu-remove"]') as HTMLButtonElement).click();
    expect(remove).toHaveBeenCalledWith('a');
  });

  it('tints a block just after midnight that a meeting from the evening before still covers', () => {
    const late = { ...meeting('Late sync', PAST, '23:00', '23:59'), endDate: at(TODAY, '01:00') };
    render({ [TODAY]: [block('early', TODAY, '00:00', '00:30')] }, [late]);

    const column = q(`[data-date="${TODAY}"]`)!;
    expect(column.querySelectorAll('[data-testid="planner-overlap"]').length).toBe(1);
    expect(column.querySelector('[data-testid="planner-overlap-pill"]')!.textContent).toContain('Overlaps Late sync');
  });
});
