import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { CalendarEventFormModalComponent } from './calendar-event-form-modal.component';

describe('CalendarEventFormModalComponent', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<CalendarEventFormModalComponent>>;
  let currentEmployeeId: string | null;

  beforeEach(async () => {
    currentEmployeeId = null;
    await TestBed.configureTestingModule({
      imports: [CalendarEventFormModalComponent],
      providers: [{ provide: AuthStore, useValue: { employeeId: () => currentEmployeeId } }]
    }).compileComponents();
    fixture = TestBed.createComponent(CalendarEventFormModalComponent);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
  });

  it('marks the form invalid until title and dates are filled', () => {
    expect(fixture.componentInstance.form.invalid).toBe(true);
  });

  it('does not emit save when the form is invalid', () => {
    const spy = vi.fn();
    fixture.componentInstance.save.subscribe(spy);
    fixture.componentInstance.onSubmit(null);
    expect(spy).not.toHaveBeenCalled();
  });

  it('hides the recurrence-until control until "until" end mode is chosen', () => {
    expect(fixture.componentInstance.form.controls.recurrenceEndMode.value).toBe('never');
    const untilField = fixture.nativeElement.querySelector('[data-testid="calendar-form-recurrence-until"]');
    expect(untilField).toBeNull();
  });

  it('emits a create payload with a built recurrenceRule when the form is valid and weekly is chosen', () => {
    const spy = vi.fn();
    fixture.componentInstance.save.subscribe(spy);
    fixture.componentInstance.form.patchValue({
      title: 'Standup', startDate: '2026-09-01', startTime: '09:00', endDate: '2026-09-01', endTime: '09:30',
      recurrenceFrequency: 'weekly', recurrenceEndMode: 'never'
    });
    fixture.componentInstance.onSubmit(null);
    expect(spy).toHaveBeenCalledTimes(1);
    const submission = spy.mock.calls[0][0] as { create: { recurrence: string; recurrenceRule: string | null } };
    expect('create' in submission).toBe(true);
    expect(submission.create.recurrenceRule).toBe('FREQ=WEEKLY');
  });

  it('spans the full day when "All day" is on, regardless of whatever time is in the time pickers', () => {
    // Regression test: toggleAllDay only flips the isAllDay flag and never touches
    // startTime/endTime, so before this fix the submitted range stayed whatever narrow window was
    // in the time pickers - the event never actually blocked the rest of that day.
    //
    // The end is the day AFTER the picked day, at 00:00 (exclusive) - same convention a pulled
    // Google/Outlook all-day event already uses, not 23:59 on the picked day itself.
    const spy = vi.fn();
    fixture.componentInstance.save.subscribe(spy);
    fixture.componentInstance.form.patchValue({
      title: 'Wedding', startDate: '2026-09-15', startTime: '11:30', endDate: '2026-09-15', endTime: '13:00',
      isAllDay: true
    });
    fixture.componentInstance.onSubmit(null);

    expect(spy).toHaveBeenCalledTimes(1);
    const submission = spy.mock.calls[0][0] as { create: { startDate: string; endDate: string; isAllDay: boolean } };
    expect(submission.create.isAllDay).toBe(true);
    expect(submission.create.startDate).toBe('2026-09-15T00:00:00.000Z');
    expect(submission.create.endDate).toBe('2026-09-16T00:00:00.000Z');
  });

  it('spans through the day after the last picked day for a multi-day all-day event', () => {
    const spy = vi.fn();
    fixture.componentInstance.save.subscribe(spy);
    fixture.componentInstance.form.patchValue({
      title: 'Conference', startDate: '2026-09-15', startTime: '09:00', endDate: '2026-09-17', endTime: '17:00',
      isAllDay: true
    });
    fixture.componentInstance.onSubmit(null);

    const submission = spy.mock.calls[0][0] as { create: { startDate: string; endDate: string } };
    expect(submission.create.startDate).toBe('2026-09-15T00:00:00.000Z');
    expect(submission.create.endDate).toBe('2026-09-18T00:00:00.000Z');
  });

  it('rolls the exclusive end back over a month boundary', () => {
    const spy = vi.fn();
    fixture.componentInstance.save.subscribe(spy);
    fixture.componentInstance.form.patchValue({
      title: 'Month-end retreat', startDate: '2026-09-30', startTime: '09:00', endDate: '2026-09-30', endTime: '17:00',
      isAllDay: true
    });
    fixture.componentInstance.onSubmit(null);

    const submission = spy.mock.calls[0][0] as { create: { endDate: string } };
    expect(submission.create.endDate).toBe('2026-10-01T00:00:00.000Z');
  });

  it('shows an existing all-day event\'s last real day in the End Date field, not the exclusive stored day after', () => {
    // A pulled Google/Outlook all-day event (and now a manually created one, see above) stores its
    // end as the day AFTER the last day at 00:00 - the edit form must show the day the event
    // actually covers, or editing and re-saving without touching the date would silently shift it.
    fixture.componentRef.setInput('event', {
      id: 'e1', title: 'Wedding', description: null,
      startDate: '2026-09-15T00:00:00Z', endDate: '2026-09-16T00:00:00Z',
      sourceType: 'manual', color: null, recurrence: 'none', isAllDay: true, timezone: 'UTC', eventStatus: null,
      isPrivate: false, location: null, meetingLink: null, externalSource: null, createdById: 'u1',
      isRecurringOccurrence: false, recurrenceMasterId: null, originalStart: null, participants: null
    });
    fixture.detectChanges();

    expect(fixture.componentInstance.form.controls.startDate.value).toBe('2026-09-15');
    expect(fixture.componentInstance.form.controls.endDate.value).toBe('2026-09-15');

    const spy = vi.fn();
    fixture.componentInstance.save.subscribe(spy);
    fixture.componentInstance.onSubmit(null);
    const submission = spy.mock.calls[0][0] as { update: { startDate: string; endDate: string } };
    expect(submission.update.startDate).toBe('2026-09-15T00:00:00.000Z');
    expect(submission.update.endDate).toBe('2026-09-16T00:00:00.000Z');
  });

  it('pre-fills the form and emits an update payload with scope=null for a plain event', () => {
    fixture.componentRef.setInput('event', {
      id: 'e1', title: 'Existing', description: null, startDate: '2026-09-01T09:00:00Z', endDate: '2026-09-01T09:30:00Z',
      sourceType: 'manual', color: null, recurrence: 'none', isAllDay: false, timezone: 'UTC', eventStatus: null,
      isPrivate: false, location: null, meetingLink: null, externalSource: null, createdById: 'u1',
      isRecurringOccurrence: false, recurrenceMasterId: null, originalStart: null, participants: null
    });
    fixture.detectChanges();
    expect(fixture.componentInstance.form.controls.title.value).toBe('Existing');

    const spy = vi.fn();
    fixture.componentInstance.save.subscribe(spy);
    fixture.componentInstance.onSubmit(null);
    const submission = spy.mock.calls[0][0] as { update: unknown; scope: unknown };
    expect('update' in submission).toBe(true);
    expect(submission.scope).toBeNull();

    expect(fixture.nativeElement.querySelector('[data-testid="calendar-form-save-this-event"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="calendar-form-save-plain"]')).not.toBeNull();
  });

  it('offers a this-event/all-events choice and emits the chosen scope for a recurring occurrence', () => {
    fixture.componentRef.setInput('event', {
      id: 'occurrence-id', title: 'Standup', description: null, startDate: '2026-09-08T09:00:00Z', endDate: '2026-09-08T09:30:00Z',
      sourceType: 'manual', color: null, recurrence: 'weekly', isAllDay: false, timezone: 'UTC', eventStatus: null,
      isPrivate: false, location: null, meetingLink: null, externalSource: null, createdById: 'u1',
      isRecurringOccurrence: true, recurrenceMasterId: 'master-1', originalStart: '2026-09-08T09:00:00Z', participants: null
    });
    fixture.detectChanges();

    const spy = vi.fn();
    fixture.componentInstance.save.subscribe(spy);
    fixture.nativeElement.querySelector('[data-testid="calendar-form-save-this-event"]').click();

    const submission = spy.mock.calls[0][0] as { update: unknown; scope: unknown };
    expect(submission.scope).toBe('ThisEventOnly');
  });

  it('emits the delete output with the chosen scope', () => {
    fixture.componentRef.setInput('event', {
      id: 'occurrence-id', title: 'Standup', description: null, startDate: '2026-09-08T09:00:00Z', endDate: '2026-09-08T09:30:00Z',
      sourceType: 'manual', color: null, recurrence: 'weekly', isAllDay: false, timezone: 'UTC', eventStatus: null,
      isPrivate: false, location: null, meetingLink: null, externalSource: null, createdById: 'u1',
      isRecurringOccurrence: true, recurrenceMasterId: 'master-1', originalStart: '2026-09-08T09:00:00Z', participants: null
    });
    fixture.detectChanges();

    const spy = vi.fn();
    fixture.componentInstance.delete.subscribe(spy);
    fixture.nativeElement.querySelector('[data-testid="calendar-form-delete-all-events"]').click();
    expect(spy).toHaveBeenCalledWith('AllEvents');
  });

  it('shows participants with their response status badge', () => {
    fixture.componentRef.setInput('event', {
      id: 'e1', title: 'Existing', description: null, startDate: '2026-09-01T09:00:00Z', endDate: '2026-09-01T09:30:00Z',
      sourceType: 'manual', color: null, recurrence: 'none', isAllDay: false, timezone: 'UTC', eventStatus: null,
      isPrivate: false, location: null, meetingLink: null, externalSource: null, createdById: 'u1',
      isRecurringOccurrence: false, recurrenceMasterId: null, originalStart: null,
      participants: [{ employeeId: 'emp-1', employeeName: 'Ada Lovelace', responseStatus: 'pending' }]
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Ada Lovelace');
    expect(fixture.nativeElement.textContent).toContain('pending');
  });

  it('does not show Accept/Decline when the viewer is not a participant', () => {
    fixture.componentRef.setInput('event', {
      id: 'e1', title: 'Existing', description: null, startDate: '2026-09-01T09:00:00Z', endDate: '2026-09-01T09:30:00Z',
      sourceType: 'manual', color: null, recurrence: 'none', isAllDay: false, timezone: 'UTC', eventStatus: null,
      isPrivate: false, location: null, meetingLink: null, externalSource: null, createdById: 'u1',
      isRecurringOccurrence: false, recurrenceMasterId: null, originalStart: null,
      participants: [{ employeeId: 'someone-else', employeeName: 'Bob', responseStatus: 'pending' }]
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="calendar-form-accept"]')).toBeNull();
  });

  it('emits respond when the viewer is a participant and clicks Accept', () => {
    currentEmployeeId = 'emp-1';
    fixture.componentRef.setInput('event', {
      id: 'e1', title: 'Existing', description: null, startDate: '2026-09-01T09:00:00Z', endDate: '2026-09-01T09:30:00Z',
      sourceType: 'manual', color: null, recurrence: 'none', isAllDay: false, timezone: 'UTC', eventStatus: null,
      isPrivate: false, location: null, meetingLink: null, externalSource: null, createdById: 'u1',
      isRecurringOccurrence: false, recurrenceMasterId: null, originalStart: null,
      participants: [{ employeeId: 'emp-1', employeeName: 'Ada Lovelace', responseStatus: 'pending' }]
    });
    fixture.detectChanges();

    const spy = vi.fn();
    fixture.componentInstance.respond.subscribe(spy);
    fixture.nativeElement.querySelector('[data-testid="calendar-form-accept"]').click();
    expect(spy).toHaveBeenCalledWith({ status: 'Accepted', reason: null, nomineeEmployeeId: null });
  });

  it('does not show "Nominate replacement" when there are no eligible nominees', () => {
    currentEmployeeId = 'emp-1';
    fixture.componentRef.setInput('event', {
      id: 'e1', title: 'Existing', description: null, startDate: '2026-09-01T09:00:00Z', endDate: '2026-09-01T09:30:00Z',
      sourceType: 'manual', color: null, recurrence: 'none', isAllDay: false, timezone: 'UTC', eventStatus: null,
      isPrivate: false, location: null, meetingLink: null, externalSource: null, createdById: 'u1',
      isRecurringOccurrence: false, recurrenceMasterId: null, originalStart: null,
      participants: [{ employeeId: 'emp-1', employeeName: 'Ada Lovelace', responseStatus: 'pending' }]
    });
    fixture.componentRef.setInput('eligibleNominees', []);
    fixture.detectChanges();

    fixture.nativeElement.querySelector('[data-testid="calendar-form-more"]').click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="calendar-form-nominate"]')).toBeNull();
  });

  it('shows "Nominate replacement" and submits the chosen nominee when eligible nominees exist', () => {
    currentEmployeeId = 'emp-1';
    fixture.componentRef.setInput('event', {
      id: 'e1', title: 'Existing', description: null, startDate: '2026-09-01T09:00:00Z', endDate: '2026-09-01T09:30:00Z',
      sourceType: 'manual', color: null, recurrence: 'none', isAllDay: false, timezone: 'UTC', eventStatus: null,
      isPrivate: false, location: null, meetingLink: null, externalSource: null, createdById: 'u1',
      isRecurringOccurrence: false, recurrenceMasterId: null, originalStart: null,
      participants: [{ employeeId: 'emp-1', employeeName: 'Ada Lovelace', responseStatus: 'pending' }]
    });
    fixture.componentRef.setInput('eligibleNominees', [{ employeeId: 'emp-2', employeeName: 'Grace Hopper' }]);
    fixture.detectChanges();

    const loadSpy = vi.fn();
    fixture.componentInstance.loadEligibleNominees.subscribe(loadSpy);
    fixture.nativeElement.querySelector('[data-testid="calendar-form-more"]').click();
    fixture.detectChanges();
    expect(loadSpy).toHaveBeenCalledTimes(1);

    fixture.nativeElement.querySelector('[data-testid="calendar-form-nominate"]').click();
    fixture.detectChanges();

    const respondSpy = vi.fn();
    fixture.componentInstance.respond.subscribe(respondSpy);
    fixture.nativeElement.querySelector('[data-testid="calendar-form-submit-nominate"]').click();
    expect(respondSpy).toHaveBeenCalledWith({ status: 'ReplacementNominated', reason: null, nomineeEmployeeId: 'emp-2' });
  });

  it('submits a reason when requesting conflict resolution', () => {
    currentEmployeeId = 'emp-1';
    fixture.componentRef.setInput('event', {
      id: 'e1', title: 'Existing', description: null, startDate: '2026-09-01T09:00:00Z', endDate: '2026-09-01T09:30:00Z',
      sourceType: 'manual', color: null, recurrence: 'none', isAllDay: false, timezone: 'UTC', eventStatus: null,
      isPrivate: false, location: null, meetingLink: null, externalSource: null, createdById: 'u1',
      isRecurringOccurrence: false, recurrenceMasterId: null, originalStart: null,
      participants: [{ employeeId: 'emp-1', employeeName: 'Ada Lovelace', responseStatus: 'pending' }]
    });
    fixture.detectChanges();

    fixture.nativeElement.querySelector('[data-testid="calendar-form-more"]').click();
    fixture.detectChanges();
    fixture.nativeElement.querySelector('[data-testid="calendar-form-request-resolution"]').click();
    fixture.detectChanges();

    const textarea = fixture.nativeElement.querySelector('[data-testid="calendar-form-resolution-reason"]');
    textarea.value = 'Need to check with my team';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const spy = vi.fn();
    fixture.componentInstance.respond.subscribe(spy);
    fixture.nativeElement.querySelector('[data-testid="calendar-form-submit-resolution"]').click();
    expect(spy).toHaveBeenCalledWith({ status: 'ResolutionRequested', reason: 'Need to check with my team', nomineeEmployeeId: null });
  });

  it('emits checkConflicts (debounced) once participants and both dates are set, but not while editing', () => {
    vi.useFakeTimers();
    const spy = vi.fn();
    fixture.componentInstance.checkConflicts.subscribe(spy);

    fixture.componentInstance.form.patchValue({ startDate: '2026-09-01', startTime: '09:00', endDate: '2026-09-01', endTime: '10:00' });
    fixture.componentInstance.onParticipantIdsChange(['emp-1']);
    expect(spy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(400);
    expect(spy).toHaveBeenCalledWith({
      participantEmployeeIds: ['emp-1'], startDate: '2026-09-01T09:00:00.000Z', endDate: '2026-09-01T10:00:00.000Z'
    });
    vi.useRealTimers();
  });

  it('does not emit checkConflicts while editing an existing event', () => {
    vi.useFakeTimers();
    fixture.componentRef.setInput('event', {
      id: 'e1', title: 'Existing', description: null, startDate: '2026-09-01T09:00:00Z', endDate: '2026-09-01T09:30:00Z',
      sourceType: 'manual', color: null, recurrence: 'none', isAllDay: false, timezone: 'UTC', eventStatus: null,
      isPrivate: false, location: null, meetingLink: null, externalSource: null, createdById: 'u1',
      isRecurringOccurrence: false, recurrenceMasterId: null, originalStart: null, participants: null
    });
    fixture.detectChanges();
    const spy = vi.fn();
    fixture.componentInstance.checkConflicts.subscribe(spy);

    fixture.componentInstance.onParticipantIdsChange(['emp-1']);
    vi.advanceTimersByTime(400);
    expect(spy).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('renders a non-blocking warning line per conflict', () => {
    fixture.componentRef.setInput('conflicts', [
      {
        employeeId: 'emp-1', employeeName: 'Ada Lovelace', conflictingEventId: 'e9', conflictingEventTitle: 'Standup',
        overlapStart: '2026-09-01T09:00:00Z', overlapEnd: '2026-09-01T09:30:00Z'
      }
    ]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Ada Lovelace is busy from 9:00 AM to 9:30 AM (Standup)');
    expect(fixture.nativeElement.querySelector('[data-testid="calendar-form-save-plain"] button').disabled).toBe(false);
  });

  it('shows the overlap time range in the conflict warning', () => {
    fixture.componentRef.setInput('myTimezone', 'Asia/Colombo');
    fixture.componentRef.setInput('conflicts', [
      {
        employeeId: 'emp-1', employeeName: 'Ada Lovelace', conflictingEventId: 'e9', conflictingEventTitle: 'Standup',
        overlapStart: '2026-04-10T09:00:00+05:30', overlapEnd: '2026-04-10T09:30:00+05:30'
      }
    ]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('9:00 AM to 9:30 AM');
  });

  it('pre-fills the form using the viewer timezone, not raw UTC digits', () => {
    fixture.componentRef.setInput('myTimezone', 'Asia/Colombo');
    fixture.componentRef.setInput('event', {
      id: 'e1', title: 'Existing', description: null, startDate: '2026-09-01T09:00:00Z', endDate: '2026-09-01T09:30:00Z',
      sourceType: 'manual', color: null, recurrence: 'none', isAllDay: false, timezone: 'Asia/Colombo', eventStatus: null,
      isPrivate: false, location: null, meetingLink: null, externalSource: null, createdById: 'u1',
      isRecurringOccurrence: false, recurrenceMasterId: null, originalStart: null, participants: null
    });
    fixture.detectChanges();

    // 2026-09-01T09:00:00Z is 14:30 in Asia/Colombo (UTC+5:30)
    expect(fixture.componentInstance.form.controls.startTime.value).toBe('14:30');
  });

  it('converts local wall-clock input to the correct UTC instant on save', () => {
    fixture.componentRef.setInput('myTimezone', 'Asia/Colombo');
    fixture.componentInstance.form.patchValue({
      title: 'Standup', startDate: '2026-09-01', startTime: '14:30', endDate: '2026-09-01', endTime: '15:00'
    });

    const spy = vi.fn();
    fixture.componentInstance.save.subscribe(spy);
    fixture.componentInstance.onSubmit(null);

    const submission = spy.mock.calls[0][0] as { create: { startDate: string; endDate: string } };
    expect(new Date(submission.create.startDate).toISOString()).toBe('2026-09-01T09:00:00.000Z');
  });

  it('shows a hint naming the timezone times are displayed in', () => {
    fixture.componentRef.setInput('myTimezone', 'Asia/Colombo');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Asia/Colombo');
  });

  it('emits cancel immediately when the form is not dirty', () => {
    const spy = vi.fn();
    fixture.componentInstance.cancel.subscribe(spy);
    fixture.componentInstance.attemptClose();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('shows a discard-confirmation instead of emitting cancel when the form is dirty', () => {
    fixture.componentInstance.setTitle('Something typed');
    const spy = vi.fn();
    fixture.componentInstance.cancel.subscribe(spy);

    fixture.componentInstance.attemptClose();

    expect(spy).not.toHaveBeenCalled();
    expect(fixture.componentInstance.discardConfirmOpen()).toBe(true);
  });

  it('emits cancel after the discard is confirmed', () => {
    fixture.componentInstance.setTitle('Something typed');
    fixture.componentInstance.attemptClose();

    const spy = vi.fn();
    fixture.componentInstance.cancel.subscribe(spy);
    fixture.componentInstance.confirmDiscard();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.discardConfirmOpen()).toBe(false);
  });

  it('treats a non-empty participant selection as dirty even with an untouched form', () => {
    fixture.componentInstance.onParticipantIdsChange(['emp-1']);
    const spy = vi.fn();
    fixture.componentInstance.cancel.subscribe(spy);

    fixture.componentInstance.attemptClose();

    expect(spy).not.toHaveBeenCalled();
    expect(fixture.componentInstance.discardConfirmOpen()).toBe(true);
  });

  it('starts pristine again when reopened after a previous dirty session, even without destroying the component', () => {
    fixture.componentInstance.setTitle('Something typed');
    fixture.componentInstance.onParticipantIdsChange(['emp-1']);

    // Simulate the page closing then reopening the same modal instance for a fresh create -
    // `open` toggles false then true again, exactly like calendar-page.component.ts does.
    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    const spy = vi.fn();
    fixture.componentInstance.cancel.subscribe(spy);
    fixture.componentInstance.attemptClose();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.discardConfirmOpen()).toBe(false);
  });

  it('defaults a new event to a 30-minute slot', () => {
    expect(fixture.componentInstance.form.controls.startTime.value).toBe('09:00');
    expect(fixture.componentInstance.form.controls.endTime.value).toBe('09:30');
  });

  it('follows the start time with a +30m end until the end is set by hand', () => {
    fixture.componentInstance.setStartTime('11:00');
    expect(fixture.componentInstance.form.controls.endTime.value).toBe('11:30');

    fixture.componentInstance.setEndTime('12:15');
    fixture.componentInstance.setStartTime('13:00');
    expect(fixture.componentInstance.form.controls.endTime.value).toBe('12:15');
  });

  it('reads the typed times in the picked timezone, not the tenant one, on save', () => {
    fixture.componentRef.setInput('myTimezone', 'Asia/Colombo');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="calendar-form-timezone"]')).not.toBeNull();

    fixture.componentInstance.setTimezone('America/New_York');
    fixture.componentInstance.form.patchValue({
      title: 'Standup', startDate: '2026-06-10', startTime: '09:00', endDate: '2026-06-10', endTime: '09:30'
    });
    const spy = vi.fn();
    fixture.componentInstance.save.subscribe(spy);
    fixture.componentInstance.onSubmit(null);

    // 2026-06-10 09:00 America/New_York (EDT, UTC-4) == 13:00Z
    const { create } = spy.mock.calls[0][0] as { create: { startDate: string } };
    expect(new Date(create.startDate).toISOString()).toBe('2026-06-10T13:00:00.000Z');
  });

  it('renders participants as overlapping avatar circles with a removable overflow badge', () => {
    const people = Array.from({ length: 8 }, (_, i) => ({ id: `e${i}`, name: `Person ${i}` }));
    fixture.componentInstance.onParticipantIdsChange(people.map((p) => p.id));
    fixture.componentInstance.onParticipantPeopleChange(people);
    fixture.detectChanges();

    const cluster = fixture.nativeElement.querySelector('[data-testid="calendar-form-participant-avatars"]');
    expect(cluster.className).toContain('-space-x-3');
    const removes = fixture.nativeElement.querySelectorAll('[data-testid="calendar-form-participant-remove"]');
    expect(removes.length).toBe(6);
    const overflow = fixture.nativeElement.querySelector('[data-testid="calendar-form-participant-overflow"]');
    expect(overflow.textContent.trim()).toBe('+2');

    (removes[0] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.participants().length).toBe(7);
    expect(fixture.componentInstance.participantIds().length).toBe(7);
    expect(fixture.componentInstance.participantIds()).not.toContain('e0');
  });

  it('uses prefillEnd for the end fields when a dragged range provides one', () => {
    fixture.componentRef.setInput('prefillStart', '2026-09-20T10:15');
    fixture.componentRef.setInput('prefillEnd', '2026-09-20T11:45');
    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    expect(fixture.componentInstance.form.controls.startTime.value).toBe('10:15');
    expect(fixture.componentInstance.form.controls.endTime.value).toBe('11:45');

    // a later start-time nudge must not clobber the explicitly dragged end
    fixture.componentInstance.setStartTime('09:00');
    expect(fixture.componentInstance.form.controls.endTime.value).toBe('11:45');
  });

  it('opens the participant picker when the overflow badge is clicked', () => {
    const people = Array.from({ length: 8 }, (_, i) => ({ id: `e${i}`, name: `Person ${i}` }));
    fixture.componentInstance.onParticipantPeopleChange(people);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[data-testid="calendar-form-participant-overflow"]') as HTMLButtonElement).click();
    expect(fixture.componentInstance.participantPickerOpen()).toBe(true);
  });

  it('uses the calendar-module styled dropdown for Repeat, not a native select', () => {
    const repeat = fixture.nativeElement.querySelector('[data-testid="calendar-form-repeat"]');
    expect(repeat).not.toBeNull();
    expect(repeat.tagName.toLowerCase()).toBe('app-calendar-select');
    expect(repeat.querySelector('select')).toBeNull();
  });
});
