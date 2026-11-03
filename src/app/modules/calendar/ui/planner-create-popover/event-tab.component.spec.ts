import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
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
    fixture.componentRef.setInput('canMeet', true);
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

  it('the People/video note switches to the Meeting tab, keeping title and time', () => {
    const { fixture, q, shared } = setup();
    const spy = vi.fn();
    fixture.componentInstance.switchToMeeting.subscribe(spy);
    q('event-tab-to-meeting').click();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(shared.title()).toBe('Doctor');
  });

  it('More options emits the full EventDraft', () => {
    const { fixture, q } = setup();
    const spy = vi.fn();
    fixture.componentInstance.moreOptions.subscribe(spy);
    (q('event-tab-repeat') as HTMLSelectElement).value = 'weekly';
    q('event-tab-repeat').dispatchEvent(new Event('change'));
    q('event-tab-more').click();
    expect(spy).toHaveBeenCalledWith({
      title: 'Doctor', description: null, start: '2026-11-10T09:00', end: '2026-11-10T11:00', isAllDay: false,
      timezone: 'Asia/Colombo', repeat: 'weekly', location: null,
    });
  });
});
