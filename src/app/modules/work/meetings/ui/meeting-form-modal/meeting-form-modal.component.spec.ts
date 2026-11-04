import { vi } from 'vitest';
import { HttpErrorResponse } from '@angular/common/http';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AuthStore } from '../../../../../core/auth/state/auth.store';
import { NotificationService } from '../../../../../core/services/notification.service';
import { CalendarEventApiService } from '../../../../calendar/data-access/calendar-event-api.service';
import { ProjectApiService } from '../../../data-access/project-api.service';
import { MeetingApiService } from '../../data-access/meeting-api.service';
import { MeetingCreatedResponse, MeetingEditResponse, MeetingOccurrenceResponse } from '../../models/meeting.models';
import { MeetingFormModalComponent } from './meeting-form-modal.component';
import { toZonedParts } from '../../utils/meeting-time';

/** The specs' clock: 2026-10-30 10:10 in Colombo, before the 2026-11-02 meetings they create. */
const NOW = '2026-10-30T04:40:00Z';

describe('MeetingFormModalComponent', () => {
  let fixture: ComponentFixture<MeetingFormModalComponent>;
  let form: MeetingFormModalComponent;
  const api = { create: vi.fn(), edit: vi.fn(), getOccurrenceAt: vi.fn() };
  const notify = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
  const calendarApi = { checkConflicts: vi.fn() };

  const occurrence = (over: Partial<MeetingOccurrenceResponse> = {}): MeetingOccurrenceResponse => ({
    taskId: 't1', shortId: 'ACME-M1', seriesId: 's1', originalStart: '2026-11-02T03:30:00Z',
    startAt: '2026-11-02T03:30:00Z', endAt: '2026-11-02T04:00:00Z', isAllDay: false, timezone: 'Asia/Colombo',
    title: 'Weekly sync', description: null, location: null, isPrivate: false, status: 'scheduled', isDetached: false,
    revision: 3, seriesRevision: 7, recurrenceRule: null,
    placement: { projectId: 'p1', projectName: 'Acme', objectiveId: 'o1', moduleTitle: 'Delivery', isOffice: false },
    organizer: { employeeId: 'e1', name: 'Priya K.' }, myRole: 'organizer', myResponse: 'accepted', attendees: [], canEdit: true,
    ...over,
  });

  function build(inputs: Record<string, unknown>): void {
    fixture = TestBed.createComponent(MeetingFormModalComponent);
    form = fixture.componentInstance;
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
    Object.values(api).forEach((f) => f.mockReset());
    Object.values(notify).forEach((f) => f.mockReset());
    calendarApi.checkConflicts.mockReset();
    calendarApi.checkConflicts.mockReturnValue(of({ conflicts: [] }));
    TestBed.configureTestingModule({
      providers: [
        { provide: MeetingApiService, useValue: api },
        { provide: NotificationService, useValue: notify },
        { provide: CalendarEventApiService, useValue: calendarApi },
        { provide: AuthStore, useValue: { employeeId: () => 'me' } },
        { provide: ProjectApiService, useValue: { listMine: () => of({ items: [], totalCount: 0 }), getProjectTree: () => of([]) } },
      ],
    });
    TestBed.overrideComponent(MeetingFormModalComponent, { set: { imports: [], schemas: [NO_ERRORS_SCHEMA] } });
  });

  function fillOffice(): void {
    form.setOffice();
    form.form.patchValue({
      title: '  Board review  ', date: '2026-11-02', time: '09:00', durationMinutes: 45, timezone: 'Asia/Colombo',
      recurrence: 'none', platform: 'zoom', location: 'Room 4', isPrivate: true,
    });
    form.participantIds.set(['e2', 'e3']);
    form.guestEmails.set(['client@example.com']);
  }

  it('builds the create request for an Office meeting', () => {
    build({ mode: 'create' });
    fillOffice();

    expect(form.buildCreateRequest()).toEqual({
      projectId: null, objectiveId: null, title: 'Board review', description: null, location: 'Room 4', isPrivate: true,
      start: '2026-11-02T09:00:00+05:30', durationMinutes: 45, isAllDay: false, timezone: 'Asia/Colombo', recurrenceRule: null,
      participantEmployeeIds: ['e2', 'e3'], guestEmails: ['client@example.com'], platform: 'zoom',
    });
  });

  afterEach(() => vi.useRealTimers());

  it('a new meeting starts at the next half hour today, in the form\'s time zone', () => {
    build({ mode: 'create' });

    const tz = form.form.controls.timezone.value;
    // 04:40Z is HH:10 in UTC and in Colombo alike; the next half hour is 05:00Z.
    expect({ date: form.form.controls.date.value, time: form.form.controls.time.value })
      .toEqual(toZonedParts('2026-10-30T05:00:00Z', tz));
  });

  it('a calendar handover keeps its own start', () => {
    build({ mode: 'create', prefill: { title: 'Review', start: '2026-11-03T14:00', end: '2026-11-03T15:00' } });

    expect([form.form.controls.date.value, form.form.controls.time.value]).toEqual(['2026-11-03', '14:00']);
  });

  it('a start that has already passed cannot be created, and the form says so', () => {
    build({ mode: 'create' });
    fillOffice();
    const tz = form.form.controls.timezone.value;
    const earlier = toZonedParts('2026-10-30T03:00:00Z', tz);

    form.form.patchValue({ date: earlier.date, time: earlier.time, timezone: tz });
    fixture.detectChanges();
    expect(form.canSave()).toBe(false);
    expect((fixture.nativeElement.querySelector('[data-testid="meeting-start-past"]') as HTMLElement).textContent)
      .toContain('already passed');

    const later = toZonedParts('2026-10-30T06:00:00Z', tz);
    form.form.patchValue({ date: later.date, time: later.time });
    fixture.detectChanges();
    expect(form.canSave()).toBe(true);
    expect(fixture.nativeElement.querySelector('[data-testid="meeting-start-past"]')).toBeNull();
  });

  it('an all-day meeting today has already started, so it cannot be created', () => {
    build({ mode: 'create' });
    fillOffice();
    const tz = form.form.controls.timezone.value;

    form.form.patchValue({ date: toZonedParts(NOW, tz).date, isAllDay: true, timezone: tz });

    expect(form.canSave()).toBe(false);
  });

  it('the save button is drawn in the theme accent, so it shows on the white dialog', () => {
    build({ mode: 'create' });

    const save: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="meeting-save"]');
    expect(save.className).toContain('bg-[var(--color-accent)]');
    expect(save.className).toContain('text-[var(--color-accent-contrast)]');
  });

  it('created outcome toasts and emits so the caller can open the drawer', async () => {
    build({ mode: 'create' });
    fillOffice();
    const created: MeetingCreatedResponse = { outcome: 'created', seriesId: 's9', firstOccurrenceTaskId: 't9', approvalRequestId: null, skipped: [] };
    api.create.mockReturnValue(of(created));
    let saved: unknown;
    form.saved.subscribe((s) => (saved = s));

    await form.save();

    expect(notify.success).toHaveBeenCalledWith('Meeting created');
    // The start it sent, so the caller can open the new meeting's drawer by series and original start.
    expect(saved).toEqual({ ...created, originalStart: '2026-11-02T09:00:00+05:30' });
  });

  it('a duration outside 15 to 480 minutes cannot be saved', () => {
    build({ mode: 'create' });
    fillOffice();

    for (const [minutes, ok] of [[10, false], [500, false], [15, true], [480, true]] as const) {
      form.form.patchValue({ durationMinutes: minutes });
      expect(form.canSave(), `${minutes} min`).toBe(ok);
    }
  });

  it('requested outcome shows the approval toast', async () => {
    build({ mode: 'create', placement: { projectId: 'p1', objectiveId: 'o1' } });
    form.form.patchValue({ title: 'Design review', date: '2026-11-02', time: '09:00', timezone: 'UTC' });
    api.create.mockReturnValue(of({
      outcome: 'requested', seriesId: null, firstOccurrenceTaskId: null, approvalRequestId: 'r1',
      skipped: [{ employeeId: 'e5', reason: 'inactive' }, { employeeId: 'e6', reason: 'inactive' }],
    } satisfies MeetingCreatedResponse));

    await form.save();

    expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'p1', objectiveId: 'o1' }));
    expect(notify.success).toHaveBeenCalledWith('Sent for approval');
    expect(notify.warning).toHaveBeenCalledWith('2 people were not invited: no longer active');
  });

  it('edit asks for scope only for recurring meetings', async () => {
    const edited: MeetingEditResponse = { seriesId: 's1', occurrenceTaskId: 't1', split: false };
    api.edit.mockReturnValue(of(edited));

    build({ mode: 'edit', occurrence: occurrence({ recurrenceRule: null }) });
    form.form.patchValue({ title: 'Renamed' });
    await form.save();
    expect(form.scopeDialogOpen()).toBe(false);
    expect(api.edit).toHaveBeenCalledWith('s1', '2026-11-02T03:30:00Z', { scope: 'this', revision: 3, title: 'Renamed' });

    api.edit.mockClear();
    build({ mode: 'edit', occurrence: occurrence({ recurrenceRule: 'FREQ=WEEKLY;BYDAY=MO' }) });
    form.form.patchValue({ title: 'Renamed' });
    await form.save();
    expect(form.scopeDialogOpen()).toBe(true);
    expect(api.edit).not.toHaveBeenCalled();

    await form.applyScope('all');
    expect(api.edit).toHaveBeenCalledWith('s1', '2026-11-02T03:30:00Z', { scope: 'all', revision: 7, title: 'Renamed' });
  });

  it('meeting_changed reloads instead of overwriting', async () => {
    build({ mode: 'edit', occurrence: occurrence() });
    form.form.patchValue({ title: 'My rename' });
    api.edit.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { code: 'meeting_changed' } })));
    api.getOccurrenceAt.mockReturnValue(of(occurrence({ title: 'Their rename', revision: 4 })));

    await form.save();

    expect(api.edit).toHaveBeenCalledTimes(1);
    expect(api.getOccurrenceAt).toHaveBeenCalledWith('s1', '2026-11-02T03:30:00Z');
    expect(form.form.controls.title.value).toBe('Their rename');
    expect(notify.error).toHaveBeenCalledWith('Someone else changed this meeting. We reloaded it - check and save again.');
  });

  it('moving one occurrence to another day leaves the series rule alone', async () => {
    api.edit.mockReturnValue(of({ seriesId: 's1', occurrenceTaskId: 't1', split: false }));
    build({ mode: 'edit', occurrence: occurrence({ recurrenceRule: 'FREQ=WEEKLY;BYDAY=MO' }) });
    form.form.patchValue({ date: '2026-11-03' });

    await form.save();
    await form.applyScope('this');

    const request = api.edit.mock.calls[0][2];
    expect(request).toEqual({ scope: 'this', revision: 3, start: expect.any(String) });
    expect(Date.parse(request.start)).toBe(Date.parse('2026-11-03T03:30:00Z'));
  });

  it('a repeat or time zone change cannot be saved to one occurrence', async () => {
    build({ mode: 'edit', occurrence: occurrence({ recurrenceRule: 'FREQ=WEEKLY;BYDAY=MO' }) });
    form.form.patchValue({ recurrence: 'daily' });

    await form.save();
    await form.applyScope('this');

    expect(api.edit).not.toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalledWith('A repeat or time zone change applies to the series: choose this and following, or all.');
  });

  it('notes after a recurring meeting save to that occurrence without asking for a scope', async () => {
    api.edit.mockReturnValue(of({ seriesId: 's1', occurrenceTaskId: 't1', split: false }));
    build({ mode: 'edit', occurrence: occurrence({ status: 'completed', recurrenceRule: 'FREQ=WEEKLY;BYDAY=MO' }) });
    expect((fixture.nativeElement.querySelector('[data-testid="meeting-title"]') as HTMLInputElement).readOnly).toBe(true);
    form.form.patchValue({ title: 'Renamed' });
    form.onAgenda('<p>Minutes</p>');

    await form.save();

    expect(form.scopeDialogOpen()).toBe(false);
    expect(api.edit).toHaveBeenCalledWith('s1', '2026-11-02T03:30:00Z', { scope: 'this', revision: 3, description: '<p>Minutes</p>' });
  });

  it('a saved edit carries the start it sent, so the drawer can follow a split', async () => {
    api.edit.mockReturnValue(of({ seriesId: 's2', occurrenceTaskId: 't7', split: true }));
    build({ mode: 'edit', occurrence: occurrence({ recurrenceRule: 'FREQ=WEEKLY;BYDAY=MO' }) });
    const saved: unknown[] = [];
    form.saved.subscribe((e) => saved.push(e));
    form.form.patchValue({ time: '10:00' });

    await form.save();
    await form.applyScope('all');

    const event = saved[0] as { seriesId: string; sentStart: string };
    expect(event.seriesId).toBe('s2');
    expect(Date.parse(event.sentStart)).toBe(Date.parse('2026-11-02T04:30:00Z'));
  });

  it('shows the pre-selected project and module once their options load', async () => {
    TestBed.overrideProvider(ProjectApiService, { useValue: {
      listMine: () => of({ items: [{ id: 'p0', name: 'Other' }, { id: 'p1', name: 'Acme' }], totalCount: 2 }),
      getProjectTree: () => of([{ id: 'o0', title: 'Root' }, { id: 'o1', title: 'Delivery' }]),
    } });
    build({ mode: 'create', placement: { projectId: 'p1', objectiveId: 'o1' } });
    await fixture.whenStable();
    fixture.detectChanges();

    expect((fixture.nativeElement.querySelector('[data-testid="meeting-project"]') as HTMLSelectElement).value).toBe('p1');
    expect((fixture.nativeElement.querySelector('[data-testid="meeting-module"]') as HTMLSelectElement).value).toBe('o1');
  });

  it('offers Office once, by name, and never lists the Office project as a second choice', async () => {
    TestBed.overrideProvider(ProjectApiService, { useValue: {
      listMine: () => of({ items: [{ id: 'off', name: 'Office', systemPurpose: 'office' }, { id: 'p1', name: 'Acme' }], totalCount: 2 }),
      getProjectTree: () => of([]),
    } });
    build({ mode: 'create' });
    await fixture.whenStable();
    fixture.detectChanges();

    const options = Array.from((fixture.nativeElement.querySelector('[data-testid="meeting-project"]') as HTMLSelectElement).options)
      .map((o) => o.textContent?.trim());
    expect(options).toEqual(['Office', 'Acme']);
  });

  it('a calendar handoff fills the title, date, time and length', () => {
    build({ mode: 'create', prefill: { title: 'Design review', start: '2026-11-02T10:00', end: '2026-11-02T11:30' } });

    expect(form.form.getRawValue()).toMatchObject({ title: 'Design review', date: '2026-11-02', time: '10:00', durationMinutes: 90 });
  });

  it('an edit sends only the changed fields', async () => {
    build({ mode: 'edit', occurrence: occurrence() });
    expect(form.form.controls.date.value).toBe('2026-11-02');
    expect(form.form.controls.time.value).toBe('09:00');
    form.form.patchValue({ durationMinutes: 60 });
    api.edit.mockReturnValue(of({ seriesId: 's1', occurrenceTaskId: 't1', split: false }));

    await form.save();

    expect(api.edit).toHaveBeenCalledWith('s1', '2026-11-02T03:30:00Z', { scope: 'this', revision: 3, durationMinutes: 60 });
  });
  describe('availability warnings', () => {
    afterEach(() => vi.useRealTimers());

    it('checks availability debounced with organiser included', () => {
      vi.useFakeTimers();
      build({ mode: 'create' });
      form.onParticipantsChange(['e2', 'me']);
      form.form.patchValue({ date: '2026-11-03', time: '10:00', durationMinutes: 30, timezone: 'Asia/Colombo' });
      vi.advanceTimersByTime(399);
      expect(calendarApi.checkConflicts).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);

      expect(calendarApi.checkConflicts).toHaveBeenCalledTimes(1);
      expect(calendarApi.checkConflicts).toHaveBeenCalledWith({
        participantEmployeeIds: ['e2', 'me'], startDate: '2026-11-03T10:00:00+05:30', endDate: '2026-11-03T05:00:00.000Z',
        isAllDay: false, timeZone: 'Asia/Colombo',
      });
    });

    it('does not check without a valid time', () => {
      vi.useFakeTimers();
      build({ mode: 'create' });
      form.onParticipantsChange(['e2']);
      form.form.patchValue({ date: '' });
      vi.advanceTimersByTime(400);
      form.form.patchValue({ date: '2026-11-03', durationMinutes: 5 });
      vi.advanceTimersByTime(400);

      expect(calendarApi.checkConflicts).not.toHaveBeenCalled();
    });

    it('typing in the title does not re-check availability', () => {
      vi.useFakeTimers();
      build({ mode: 'create' });
      form.onParticipantsChange(['e2']);
      form.form.patchValue({ date: '2026-11-03', time: '10:00' });
      vi.advanceTimersByTime(400);
      calendarApi.checkConflicts.mockClear();

      form.form.patchValue({ title: 'Board review', location: 'Room 4', isPrivate: true });
      vi.advanceTimersByTime(400);

      expect(calendarApi.checkConflicts).not.toHaveBeenCalled();
    });

    it('an empty start time or duration clears the warnings without a request', () => {
      vi.useFakeTimers();
      build({ mode: 'create' });
      form.onParticipantsChange(['e2']);
      form.form.patchValue({ date: '2026-11-03', time: '' });
      vi.advanceTimersByTime(400);
      form.form.controls.durationMinutes.setValue(null as unknown as number);
      form.form.patchValue({ time: '10:00' });
      vi.advanceTimersByTime(400);

      expect(calendarApi.checkConflicts).not.toHaveBeenCalled();
      expect(form.checkingAvailability()).toBe(false);
    });

    it('edit sends series to exclude', () => {
      vi.useFakeTimers();
      build({ mode: 'edit', occurrence: occurrence({ attendees: [
        { kind: 'employee', employeeId: 'e7', name: 'Ravi', email: null, response: 'accepted', responseReason: null, source: 'series' },
        { kind: 'guest', employeeId: null, name: null, email: 'g@x.com', response: null, responseReason: null, source: 'series' },
      ] }) });
      form.form.patchValue({ time: '11:00' });
      vi.advanceTimersByTime(400);

      expect(calendarApi.checkConflicts).toHaveBeenLastCalledWith(expect.objectContaining({
        participantEmployeeIds: ['e7', 'e1', 'me'], excludeMeetingSeriesId: 's1',
      }));
    });

    it('create stays enabled with warnings', () => {
      build({ mode: 'create' });
      fillOffice();
      form.availability.set([{
        employeeId: 'e2', employeeName: 'Ravi', conflictingEventId: '00000000-0000-0000-0000-000000000000',
        conflictingEventTitle: 'On leave', kind: 'leave', overlapStart: '2026-11-02T03:30:00Z', overlapEnd: '2026-11-02T04:15:00Z',
      }]);
      fixture.detectChanges();

      expect((fixture.nativeElement.querySelector('[data-testid="meeting-save"]') as HTMLButtonElement).disabled).toBe(false);
    });

    it('failed check does not block', () => {
      vi.useFakeTimers();
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      calendarApi.checkConflicts.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
      build({ mode: 'create' });
      fillOffice();
      form.scheduleAvailabilityCheck();
      vi.advanceTimersByTime(400);
      fixture.detectChanges();

      expect(form.checkingAvailability()).toBe(false);
      expect(form.availability()).toEqual([]);
      expect(notify.error).not.toHaveBeenCalled();
      expect((fixture.nativeElement.querySelector('[data-testid="meeting-save"]') as HTMLButtonElement).disabled).toBe(false);
    });
  });
});
