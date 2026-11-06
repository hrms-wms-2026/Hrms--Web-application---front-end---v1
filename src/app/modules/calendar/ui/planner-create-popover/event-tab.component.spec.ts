import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';
import { selectDisplayText } from '../../../../shared/ui/select/select.testing';
import { CalendarEventStore } from '../../state/calendar-event.store';
import { eventCreateRequest } from '../../utils/event-draft';
import { EventTabComponent } from './event-tab.component';
import { CreateSlot, SharedCreateDraft } from './planner-create-draft';

describe('EventTabComponent', () => {
  const slot: CreateSlot = { date: '2026-11-10', startMinutes: 540, endMinutes: 660, startIso: '2026-11-10T03:30:00.000Z', endIso: '2026-11-10T05:30:00.000Z' };

  function setup(createEvent: ReturnType<typeof vi.fn> = vi.fn(async () => ({ id: 'e1' }))) {
    TestBed.configureTestingModule({
      imports: [EventTabComponent],
      providers: [{ provide: CalendarEventStore, useValue: { createEvent } }],
    });
    const fixture = TestBed.createComponent(EventTabComponent);
    const shared: SharedCreateDraft = { title: signal('Doctor'), isAllDay: signal(false) };
    fixture.componentRef.setInput('slot', slot);
    fixture.componentRef.setInput('shared', shared);
    fixture.componentRef.setInput('timezone', 'Asia/Colombo');
    fixture.detectChanges();
    const q = (id: string) => fixture.nativeElement.querySelector(`[data-testid="${id}"]`) as HTMLElement;
    return { fixture, q, createEvent, shared };
  }

  it('Save sends eventCreateRequest(draft) once and emits created', async () => {
    const { fixture, q, createEvent } = setup();
    const created = vi.fn();
    fixture.componentInstance.created.subscribe(created);
    (q('event-tab-location') as HTMLInputElement).value = 'Clinic';
    q('event-tab-location').dispatchEvent(new Event('input'));

    q('event-tab-save').click();
    q('event-tab-save').click();
    await fixture.whenStable();

    expect(createEvent).toHaveBeenCalledTimes(1);
    expect(createEvent).toHaveBeenCalledWith(eventCreateRequest({
      title: 'Doctor', description: null, start: '2026-11-10T09:00', end: '2026-11-10T11:00', isAllDay: false,
      timezone: 'Asia/Colombo', repeat: 'none', location: 'Clinic',
    }));
    expect(created).toHaveBeenCalledTimes(1);
  });

  it('a new date moves the event, keeping its times', async () => {
    const { fixture, q, createEvent } = setup();

    fixture.debugElement.query(By.css('[data-testid="event-tab-date"]')).triggerEventHandler('valueChange', '2026-11-14');
    q('event-tab-save').click();
    await fixture.whenStable();

    expect(createEvent).toHaveBeenCalledWith(eventCreateRequest({
      title: 'Doctor', description: null, start: '2026-11-14T09:00', end: '2026-11-14T11:00', isAllDay: false,
      timezone: 'Asia/Colombo', repeat: 'none', location: null,
    }));
  });

  it('shows the dragged time in the start and end inputs', () => {
    const { q } = setup();
    expect((q('event-tab-start') as HTMLInputElement).value).toBe('09:00');
    expect((q('event-tab-end') as HTMLInputElement).value).toBe('11:00');
  });

  it('Repeat reads "Repeat" until one is chosen, and is saved', () => {
    const { fixture, q } = setup();
    expect(selectDisplayText(q('event-tab-repeat'))).toBe('Repeat');

    fixture.componentInstance.setRepeat('weekly');
    fixture.detectChanges();

    expect(selectDisplayText(q('event-tab-repeat'))).toBe('Weekly');
    expect(fixture.componentInstance.draft().repeat).toBe('weekly');
  });

  it('shows the planner zone, and a picked zone is saved', () => {
    const { fixture, q } = setup();
    expect(selectDisplayText(q('event-tab-timezone'))).toBe('Asia/Colombo');

    fixture.componentInstance.pickedZone.set('Europe/London');

    expect(fixture.componentInstance.draft().timezone).toBe('Europe/London');
  });

  it('Save needs a title', () => {
    const { fixture, q, shared } = setup();
    shared.title.set('  ');
    fixture.detectChanges();
    expect((q('event-tab-save') as HTMLButtonElement).disabled).toBe(true);
  });

  it('a failed save keeps the tab open (no created)', async () => {
    const { fixture, q } = setup(vi.fn(async () => null));
    const created = vi.fn();
    fixture.componentInstance.created.subscribe(created);
    q('event-tab-save').click();
    await fixture.whenStable();
    expect(created).not.toHaveBeenCalled();
  });

  it('has no "People or a video call?" note (the Meeting tab is right there)', () => {
    const { fixture } = setup();
    expect(fixture.nativeElement.textContent).not.toContain('People or a video call');
  });

});
