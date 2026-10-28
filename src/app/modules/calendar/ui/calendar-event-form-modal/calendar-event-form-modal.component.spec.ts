import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { UnsavedChangesService } from '../../../../shared/services/unsaved-changes.service';
import { CalendarEventApiService } from '../../data-access/calendar-event-api.service';
import { PeopleApiService } from '../../../people/data-access/people-api.service';
import { CalendarEventResponse } from '../../models/calendar-event.model';
import { CalendarEventFormModalComponent } from './calendar-event-form-modal.component';

describe('CalendarEventFormModalComponent', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<CalendarEventFormModalComponent>>;
  let currentEmployeeId: string | null;

  beforeEach(async () => {
    currentEmployeeId = null;
    await TestBed.configureTestingModule({
      imports: [CalendarEventFormModalComponent],
      providers: [
        { provide: AuthStore, useValue: { employeeId: () => currentEmployeeId, email: () => 'nadesh@dapi.test' } },
        // Only the nested CalendarEventAttendanceComponent (rendered when the Attendance section
        // shows) actually calls this - stubbed here so those tests don't need real HTTP infra.
        { provide: CalendarEventApiService, useValue: { getMeetingAttendance: vi.fn().mockReturnValue(of({ available: false, attendees: [] })), getMeeting: vi.fn().mockReturnValue(of({ status: 'none', provider: null, joinUrl: null, failureReason: null })) } },
        { provide: PeopleApiService, useValue: { listEmployees: vi.fn().mockReturnValue(of({ items: [], totalCount: 0, page: 1, pageSize: 20 })) } },
        provideRouter([])
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(CalendarEventFormModalComponent);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
  });

  /** Who's already added (and their remove buttons) shows in the dropdown opened from the avatar stack. */
  function openParticipants(): void {
    (fixture.nativeElement.querySelector('[data-testid="calendar-form-participant-stack"]') as HTMLElement).click();
    fixture.detectChanges();
  }

  describe('meetings as work items', () => {
    const q = (id: string) => fixture.nativeElement.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

    it('a new event offers the meeting form instead of people and a link', () => {
      fixture.componentRef.setInput('meetingsAsWorkItems', true);
      fixture.detectChanges();

      expect(q('calendar-form-participant-box')).toBeNull();
      expect(q('calendar-form-meeting-trigger')).toBeNull();
      expect(q('calendar-form-meeting-handoff')).not.toBeNull();
    });

    it('the handoff carries the title and time to the meeting form', () => {
      fixture.componentRef.setInput('meetingsAsWorkItems', true);
      fixture.detectChanges();
      fixture.componentInstance.form.patchValue({ title: 'Design review', startDate: '2026-11-02', startTime: '10:00',
        endDate: '2026-11-02', endTime: '11:30' });
      const spy = vi.fn();
      fixture.componentInstance.convertToMeeting.subscribe(spy);

      (q('calendar-form-meeting-handoff-button') as HTMLButtonElement).click();

      expect(spy).toHaveBeenCalledWith({ title: 'Design review', start: '2026-11-02T10:00', end: '2026-11-02T11:30' });
    });

    it('people and a link stay available while meetings are off', () => {
      expect(q('calendar-form-participant-box')).not.toBeNull();
      expect(q('calendar-form-meeting-handoff')).toBeNull();
    });
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

  it('rejects a meeting link with no http(s) scheme', () => {
    fixture.componentInstance.setMeetingLink('meet.google.com/abc-defg-hij');
    fixture.detectChanges();

    expect(fixture.componentInstance.form.controls.meetingLink.invalid).toBe(true);
    expect(
      fixture.nativeElement.querySelector('[data-testid="calendar-form-meeting-link-error"]')
    ).not.toBeNull();
  });

  it('rejects a non-http(s) meeting link', () => {
    fixture.componentInstance.setMeetingLink('javascript:alert(1)');
    expect(fixture.componentInstance.form.controls.meetingLink.invalid).toBe(true);
  });

  it('accepts a blank meeting link - the field is optional', () => {
    fixture.componentInstance.setMeetingLink('');
    expect(fixture.componentInstance.form.controls.meetingLink.invalid).toBe(false);
  });

  it('accepts a valid https meeting link and does not show the error', () => {
    fixture.componentInstance.setMeetingLink('https://meet.google.com/abc-defg-hij');
    fixture.detectChanges();

    expect(fixture.componentInstance.form.controls.meetingLink.invalid).toBe(false);
    expect(
      fixture.nativeElement.querySelector('[data-testid="calendar-form-meeting-link-error"]')
    ).toBeNull();
  });

  it('does not emit save when the meeting link is invalid, even with title and dates filled', () => {
    const spy = vi.fn();
    fixture.componentInstance.save.subscribe(spy);
    fixture.componentInstance.form.patchValue({
      title: 'Standup', startDate: '2026-09-01', startTime: '09:00', endDate: '2026-09-01', endTime: '09:30'
    });
    fixture.componentInstance.setMeetingLink('not a url');

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

  it('hides the time pickers while "Full day event" is on, since the times are ignored on save', () => {
    const query = () => document.querySelector('[data-testid="calendar-form-time-range"]');
    const toggle = () => (document.querySelector('[data-testid="calendar-form-full-day"]') as HTMLButtonElement).click();
    expect(query()).not.toBeNull();

    toggle();
    fixture.detectChanges();
    expect(query()).toBeNull();

    toggle();
    fixture.detectChanges();
    expect(query()).not.toBeNull();
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
    openParticipants();

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

  it('renders leave kind label', () => {
    fixture.componentRef.setInput('conflicts', [
      {
        employeeId: 'emp-1', employeeName: 'Ada Lovelace', conflictingEventId: '00000000-0000-0000-0000-000000000000',
        conflictingEventTitle: 'On leave', kind: 'leave', overlapStart: '2026-09-01T09:00:00Z', overlapEnd: '2026-09-01T09:30:00Z'
      },
      {
        employeeId: 'emp-1', employeeName: 'Ada Lovelace', conflictingEventId: '00000000-0000-0000-0000-000000000000',
        conflictingEventTitle: 'Public holiday: Deepavali', kind: 'holiday', overlapStart: '2026-09-01T09:00:00Z', overlapEnd: '2026-09-01T09:30:00Z'
      }
    ]);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Ada Lovelace: On leave · from 9:00 AM to 9:30 AM.');
    expect(text).toContain('Ada Lovelace: Public holiday: Deepavali · from 9:00 AM to 9:30 AM.');
    expect(text).not.toContain('is busy');
  });

  it('busy-only conflicts show Busy and no title', () => {
    // A task meeting the caller may not see comes back with its time only (meetings-as-tasks spec 5.9).
    fixture.componentRef.setInput('conflicts', [
      {
        employeeId: 'emp-1', employeeName: 'Ada Lovelace', conflictingEventId: '00000000-0000-0000-0000-000000000000',
        conflictingEventTitle: 'Busy', isBusyOnly: true, overlapStart: '2026-09-01T09:00:00Z', overlapEnd: '2026-09-01T09:30:00Z'
      }
    ]);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Ada Lovelace: Busy · from 9:00 AM to 9:30 AM');
    expect(text).not.toContain('(Busy)');
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

  const flush = () => new Promise<void>((resolve) => setTimeout(resolve));

  it('emits cancel immediately when the form is not dirty', async () => {
    const spy = vi.fn();
    fixture.componentInstance.cancel.subscribe(spy);
    fixture.componentInstance.attemptClose();
    await flush();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('asks through the shared dialog instead of emitting cancel when the form is dirty', async () => {
    fixture.componentInstance.setTitle('Something typed');
    const spy = vi.fn();
    fixture.componentInstance.cancel.subscribe(spy);

    fixture.componentInstance.attemptClose();
    await flush();

    const unsaved = TestBed.inject(UnsavedChangesService);
    expect(spy).not.toHaveBeenCalled();
    expect(unsaved.prompt()).toEqual({ canSaveDraft: false, saving: false, error: null });
    unsaved.choose('keep');
    await flush();
    expect(spy).not.toHaveBeenCalled();
  });

  it('emits cancel after the discard is chosen', async () => {
    fixture.componentInstance.setTitle('Something typed');
    const spy = vi.fn();
    fixture.componentInstance.cancel.subscribe(spy);

    fixture.componentInstance.attemptClose();
    TestBed.inject(UnsavedChangesService).choose('discard');
    await flush();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(TestBed.inject(UnsavedChangesService).prompt()).toBeNull();
  });

  it('treats a non-empty participant selection as dirty even with an untouched form', async () => {
    fixture.componentInstance.onParticipantIdsChange(['emp-1']);
    const spy = vi.fn();
    fixture.componentInstance.cancel.subscribe(spy);

    fixture.componentInstance.attemptClose();
    await flush();

    expect(spy).not.toHaveBeenCalled();
    expect(TestBed.inject(UnsavedChangesService).prompt()).not.toBeNull();
    TestBed.inject(UnsavedChangesService).choose('keep');
    await flush();
  });

  it('starts pristine again when reopened after a previous dirty session, even without destroying the component', async () => {
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
    await flush();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(TestBed.inject(UnsavedChangesService).prompt()).toBeNull();
  });

  it('opens a new event with an empty form after a previous event was edited', () => {
    const previous = {
      id: 'evt-9', title: 'zoom test 5', description: 'old notes', startDate: '2026-10-02T06:15:00Z',
      endDate: '2026-10-02T09:15:00Z', isAllDay: false, location: 'via zoom',
      meetingLink: 'https://us05web.zoom.us/j/85908732617', color: '#16A34A', participants: []
    } as unknown as CalendarEventResponse;
    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    fixture.componentRef.setInput('event', previous);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    expect(fixture.componentInstance.form.controls.title.value).toBe('zoom test 5');

    fixture.componentRef.setInput('open', false);
    fixture.componentRef.setInput('event', null);
    fixture.detectChanges();
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    const form = fixture.componentInstance.form;
    expect(form.controls.title.value).toBe('');
    expect(form.controls.description.value).toBe('');
    expect(form.controls.location.value).toBe('');
    expect(form.controls.meetingLink.value).toBe('');
    expect(form.controls.color.value).toBe('#2563EB');
    expect(form.controls.isAllDay.value).toBe(false);
    expect(form.pristine).toBe(true);
    expect(fixture.nativeElement.querySelector('[data-testid="calendar-form-teams-meeting-attached"]')).toBeNull();
  });

  it('opens a new event with an empty form after a previous create was typed into and closed', () => {
    fixture.componentInstance.setTitle('Half typed');
    fixture.componentInstance.setLocation('Room 4');
    fixture.componentInstance.setRecurrenceFrequency('weekly');

    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    const form = fixture.componentInstance.form;
    expect(form.controls.title.value).toBe('');
    expect(form.controls.location.value).toBe('');
    expect(form.controls.recurrenceFrequency.value).toBe('none');
    expect(form.controls.startTime.value).toBe('09:00');
    expect(form.controls.endTime.value).toBe('09:30');
  });

  it('applies the prefilled slot on top of the reset form', () => {
    fixture.componentInstance.setTitle('Old title');
    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    fixture.componentRef.setInput('prefillStart', '2026-09-20T10:15');
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    const form = fixture.componentInstance.form;
    expect(form.controls.title.value).toBe('');
    expect(form.controls.startDate.value).toBe('2026-09-20');
    expect(form.controls.startTime.value).toBe('10:15');
    expect(form.controls.endTime.value).toBe('10:45');
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
    const link = fixture.nativeElement.querySelector('[data-testid="calendar-form-timezone-link"]') as HTMLButtonElement;
    expect(link.textContent).toContain('Asia/Colombo (GMT+05:30)');
    link.click();
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

  it('lists every picked participant as a row with a name and an always-visible remove button', () => {
    const people = Array.from({ length: 8 }, (_, i) => ({ id: `e${i}`, name: `Person ${i}` }));
    fixture.componentInstance.onParticipantIdsChange(people.map((p) => p.id));
    fixture.componentInstance.onParticipantPeopleChange(people);
    fixture.detectChanges();
    openParticipants();

    const rows = fixture.nativeElement.querySelectorAll('[data-testid="calendar-form-participant-row"]');
    expect(rows.length).toBe(8);
    expect(rows[0].textContent).toContain('Person 0');
    const removes = fixture.nativeElement.querySelectorAll('[data-testid="calendar-form-participant-remove"]');
    expect(removes.length).toBe(8);
    for (const remove of Array.from(removes) as HTMLElement[]) {
      expect(remove.className).not.toMatch(/(^|\s)hidden(\s|$)/);
    }
    expect(fixture.nativeElement.querySelector('[data-testid="calendar-form-participant-avatars"]')).toBeNull();

    (removes[0] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.participants().length).toBe(7);
    expect(fixture.componentInstance.participantIds().length).toBe(7);
    expect(fixture.componentInstance.participantIds()).not.toContain('e0');
  });

  it('does not put the creator in the participants box automatically when creating an event', () => {
    expect(fixture.nativeElement.querySelector('[data-testid="calendar-form-organizer"]')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('[data-testid="calendar-form-participant-row"]').length).toBe(0);
    expect(fixture.nativeElement.querySelector('[data-testid="calendar-form-add-participants"]').getAttribute('placeholder')).toContain('Add participants');
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

  it('uses the calendar-module styled dropdown for Repeat, not a native select', () => {
    expect(fixture.nativeElement.querySelector('[data-testid="calendar-form-repeat"]')).toBeNull();
    (fixture.nativeElement.querySelector('[data-testid="calendar-form-repeat-link"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    const repeat = fixture.nativeElement.querySelector('[data-testid="calendar-form-repeat"]');
    expect(repeat).not.toBeNull();
    expect(repeat.tagName.toLowerCase()).toBe('app-select');
    expect(repeat.querySelector('select')).toBeNull();
  });

  const editingEvent = {
    id: 'e1', title: 'Sprint planning', description: null, startDate: '2026-09-01T09:00:00Z', endDate: '2026-09-01T09:30:00Z',
    sourceType: 'manual', color: null, recurrence: 'none', isAllDay: false, timezone: 'UTC', eventStatus: null,
    isPrivate: false, location: null, meetingLink: null, externalSource: null, createdById: 'u1',
    isRecurringOccurrence: false, recurrenceMasterId: null, originalStart: null, participants: null
  };

  /** Teams/Zoom/connect options live in the "Add Microsoft Teams or Zoom meeting" dropdown - open it first. */
  const openMeetingMenu = () => {
    (fixture.nativeElement.querySelector('[data-testid="calendar-form-meeting-trigger"]') as HTMLButtonElement).click();
    fixture.detectChanges();
  };

  it('shows "Add Teams meeting" when editing and a meeting-capable connection exists', () => {
    fixture.componentRef.setInput('event', editingEvent);
    fixture.componentRef.setInput('hasTeamsCapableConnection', true);
    fixture.detectChanges();
    openMeetingMenu();

    expect(fixture.nativeElement.querySelector('[data-testid="calendar-form-add-teams-meeting"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="calendar-form-connect-microsoft-prompt"]')).toBeNull();
  });

  it('shows a Connect Microsoft prompt when editing without a meeting-capable connection', () => {
    fixture.componentRef.setInput('event', editingEvent);
    fixture.componentRef.setInput('hasTeamsCapableConnection', false);
    fixture.detectChanges();
    openMeetingMenu();

    expect(fixture.nativeElement.querySelector('[data-testid="calendar-form-connect-microsoft-prompt"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="calendar-form-add-teams-meeting"]')).toBeNull();
  });

  it('shows the Add-meeting control in create mode too, as a pending selection rather than an immediate action', () => {
    fixture.componentRef.setInput('hasTeamsCapableConnection', true);
    fixture.detectChanges();
    openMeetingMenu();

    expect(fixture.nativeElement.querySelector('[data-testid="calendar-form-add-teams-meeting"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="calendar-form-connect-microsoft-prompt"]')).toBeNull();
  });

  it('clicking "Add Teams meeting" emits addMeeting with "microsoft_teams"', () => {
    fixture.componentRef.setInput('event', editingEvent);
    fixture.componentRef.setInput('hasTeamsCapableConnection', true);
    fixture.detectChanges();
    openMeetingMenu();
    const spy = vi.fn();
    fixture.componentInstance.addMeeting.subscribe(spy);

    (fixture.nativeElement.querySelector('[data-testid="calendar-form-add-teams-meeting"]') as HTMLButtonElement).click();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('microsoft_teams');
  });

  it('shows an "Add Zoom meeting" button when hasZoomCapableConnection is true', () => {
    fixture.componentRef.setInput('event', editingEvent);
    fixture.componentRef.setInput('hasZoomCapableConnection', true);
    fixture.detectChanges();
    openMeetingMenu();

    const button = fixture.nativeElement.querySelector('[data-testid="calendar-form-add-zoom-meeting"]');
    expect(button).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="calendar-form-add-teams-meeting"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="calendar-form-connect-microsoft-prompt"]')).toBeNull();
  });

  it('emits addMeeting with "zoom" when the Add Zoom meeting button is clicked', () => {
    fixture.componentRef.setInput('event', editingEvent);
    fixture.componentRef.setInput('hasZoomCapableConnection', true);
    fixture.detectChanges();
    openMeetingMenu();
    const emitted: string[] = [];
    fixture.componentInstance.addMeeting.subscribe((p: string) => emitted.push(p));

    (fixture.nativeElement.querySelector('[data-testid="calendar-form-add-zoom-meeting"]') as HTMLButtonElement).click();

    expect(emitted).toEqual(['zoom']);
  });

  it('shows both "Add Teams meeting" and "Add Zoom meeting" buttons simultaneously when both connections exist', () => {
    fixture.componentRef.setInput('event', editingEvent);
    fixture.componentRef.setInput('hasTeamsCapableConnection', true);
    fixture.componentRef.setInput('hasZoomCapableConnection', true);
    fixture.detectChanges();
    openMeetingMenu();

    expect(fixture.nativeElement.querySelector('[data-testid="calendar-form-add-teams-meeting"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="calendar-form-add-zoom-meeting"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="calendar-form-connect-microsoft-prompt"]')).toBeNull();
  });

  it('shows an "Add Zoom meeting" button in create mode when hasZoomCapableConnection is true', () => {
    fixture.componentRef.setInput('hasZoomCapableConnection', true);
    fixture.detectChanges();
    openMeetingMenu();

    expect(fixture.nativeElement.querySelector('[data-testid="calendar-form-add-zoom-meeting"]')).toBeTruthy();
  });

  it('clicking "Add Zoom meeting" in create mode shows a pending-meeting badge instead of emitting addMeeting', () => {
    fixture.componentRef.setInput('hasZoomCapableConnection', true);
    fixture.detectChanges();
    openMeetingMenu();
    const addMeetingSpy = vi.fn();
    fixture.componentInstance.addMeeting.subscribe(addMeetingSpy);

    (fixture.nativeElement.querySelector('[data-testid="calendar-form-add-zoom-meeting"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(addMeetingSpy).not.toHaveBeenCalled();
    expect(fixture.componentInstance.pendingMeetingProvider()).toBe('zoom');
    expect(fixture.nativeElement.querySelector('[data-testid="calendar-form-pending-meeting"]')?.textContent).toContain('Zoom');
    expect(fixture.nativeElement.querySelector('[data-testid="calendar-form-add-zoom-meeting"]')).toBeNull();
  });

  it('"Remove" on the pending-meeting badge clears the selection', () => {
    fixture.componentRef.setInput('hasZoomCapableConnection', true);
    fixture.detectChanges();
    fixture.componentInstance.selectPendingMeeting('zoom');
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('[data-testid="calendar-form-remove-pending-meeting"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.componentInstance.pendingMeetingProvider()).toBeNull();
    openMeetingMenu();
    expect(fixture.nativeElement.querySelector('[data-testid="calendar-form-add-zoom-meeting"]')).toBeTruthy();
  });

  it('includes the selected meetingProvider in the emitted create payload', () => {
    const spy = vi.fn();
    fixture.componentInstance.save.subscribe(spy);
    fixture.componentInstance.form.patchValue({
      title: 'Standup', startDate: '2026-09-01', startTime: '09:00', endDate: '2026-09-01', endTime: '09:30'
    });
    fixture.componentInstance.selectPendingMeeting('zoom');

    fixture.componentInstance.onSubmit(null);

    expect(spy).toHaveBeenCalledTimes(1);
    const submission = spy.mock.calls[0][0] as { meetingProvider: string | null; create: { pendingMeetingProvider: string | null } };
    expect(submission.meetingProvider).toBe('zoom');
    // Also carried in the create request body itself, so the backend can defer the participant/
    // guest invite email until the follow-up createMeeting call succeeds and the link exists.
    expect(submission.create.pendingMeetingProvider).toBe('zoom');
  });

  it('emits a null meetingProvider when no Teams/Zoom meeting was selected', () => {
    const spy = vi.fn();
    fixture.componentInstance.save.subscribe(spy);
    fixture.componentInstance.form.patchValue({
      title: 'Standup', startDate: '2026-09-01', startTime: '09:00', endDate: '2026-09-01', endTime: '09:30'
    });

    fixture.componentInstance.onSubmit(null);

    const submission = spy.mock.calls[0][0] as { meetingProvider: string | null };
    expect(submission.meetingProvider).toBeNull();
  });

  it('isAutoGeneratedMeetingLink recognizes a Zoom join URL', () => {
    fixture.componentInstance.form.controls.meetingLink.setValue('https://us05web.zoom.us/j/987654321?pwd=abc');
    expect(fixture.componentInstance.isAutoGeneratedMeetingLink()).toBe(true);
  });

  it('shows the auto-generated join link as read-only with a Remove action, not an editable input', () => {
    fixture.componentRef.setInput('event', { ...editingEvent, meetingLink: 'https://teams.microsoft.com/l/meetup-join/abc' });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="calendar-form-teams-meeting-attached"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('input[placeholder="Paste a meeting link"]')).toBeNull();
  });

  it('clicking Remove on an auto-generated meeting emits removeMeeting', () => {
    fixture.componentRef.setInput('event', { ...editingEvent, meetingLink: 'https://teams.microsoft.com/l/meetup-join/abc' });
    fixture.detectChanges();
    const spy = vi.fn();
    fixture.componentInstance.removeMeeting.subscribe(spy);

    (fixture.nativeElement.querySelector('[data-testid="calendar-form-remove-meeting"]') as HTMLButtonElement).click();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  describe('copy meeting link', () => {
    const link = 'https://us05web.zoom.us/j/85718616083?pwd=abc';
    let writeText: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
      fixture.componentRef.setInput('event', { ...editingEvent, meetingLink: link });
      fixture.detectChanges();
    });

    it('copies the full join link to the clipboard in one click and confirms it', async () => {
      const copy = fixture.nativeElement.querySelector('[data-testid="calendar-form-copy-meeting-link"]') as HTMLButtonElement;
      copy.click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(writeText).toHaveBeenCalledWith(link);
      expect(copy.getAttribute('data-state')).toBe('copied');
      expect(copy.getAttribute('aria-label')).toBe('Link copied');
    });

    it('says so when the browser refuses clipboard access', async () => {
      writeText.mockRejectedValue(new Error('denied'));
      const copy = fixture.nativeElement.querySelector('[data-testid="calendar-form-copy-meeting-link"]') as HTMLButtonElement;
      copy.click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(copy.getAttribute('data-state')).toBe('failed');
      expect(copy.getAttribute('aria-label')).toBe('Could not copy the link');
    });
  });

  it('a manually-typed non-Teams meeting link still renders as a normal editable input', () => {
    fixture.componentRef.setInput('event', { ...editingEvent, meetingLink: 'https://meet.google.com/abc-defg-hij' });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="calendar-form-teams-meeting-attached"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('input[placeholder="Paste a meeting link"]')).not.toBeNull();
  });

  it('shows the Attendance section for a past event with an auto-generated Teams meeting', () => {
    fixture.componentRef.setInput('event', {
      ...editingEvent, isOrganizer: true, endDate: '2020-01-01T10:00:00Z', meetingLink: 'https://teams.microsoft.com/l/meetup-join/abc'
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="calendar-form-attendance-section"]')).not.toBeNull();
  });

  it('hides the Attendance section for a future event even with an auto-generated meeting', () => {
    fixture.componentRef.setInput('event', {
      ...editingEvent, endDate: '2099-01-01T10:00:00Z', meetingLink: 'https://teams.microsoft.com/l/meetup-join/abc'
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="calendar-form-attendance-section"]')).toBeNull();
  });

  it('shows the Attendance section for a past event with no meeting attached too - it may still have raised incidents', () => {
    fixture.componentRef.setInput('event', { ...editingEvent, isOrganizer: true, endDate: '2020-01-01T10:00:00Z' });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="calendar-form-attendance-section"]')).not.toBeNull();
  });

  it('hides the Attendance section from a participant who is not the organizer - the backend refuses them', () => {
    fixture.componentRef.setInput('event', {
      ...editingEvent, isOrganizer: false, endDate: '2020-01-01T10:00:00Z', meetingLink: 'https://teams.microsoft.com/l/meetup-join/abc'
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="calendar-form-attendance-section"]')).toBeNull();
  });

  it('clears a stale picker selection from a previous session when the modal reopens for a different event', () => {
    // Simulate leftover picker state from an earlier create-mode session in the same component
    // instance (the bug: this used to survive into the next open because ngOnChanges only reset
    // it on the create-mode branch, which edit mode's early `return` never reached).
    fixture.componentInstance.participantIds.set(['stale-emp-1', 'stale-emp-2']);
    fixture.componentInstance.participants.set([{ id: 'stale-emp-1', name: 'Stale Person' }]);

    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    fixture.componentRef.setInput('event', editingEvent);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    expect(fixture.componentInstance.participantIds()).toEqual([]);
    expect(fixture.componentInstance.participants()).toEqual([]);
  });

  it('shows an "Add participants" control in edit mode', () => {
    fixture.componentRef.setInput('event', editingEvent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="calendar-form-add-participants-edit"]')).toBeTruthy();
  });

  it('closing the picker in edit mode with a selection emits addParticipantsToEvent and clears the local selection', () => {
    fixture.componentRef.setInput('event', editingEvent);
    fixture.detectChanges();
    const spy = vi.fn();
    fixture.componentInstance.addParticipantsToEvent.subscribe(spy);

    fixture.componentInstance.onParticipantIdsChange(['emp-1', 'emp-2']);
    fixture.componentInstance.onParticipantPickerClosed();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(['emp-1', 'emp-2']);
    expect(fixture.componentInstance.participantIds()).toEqual([]);
    expect(fixture.componentInstance.participantPickerOpen()).toBe(false);
  });

  it('closing the picker in edit mode with no selection does not emit addParticipantsToEvent', () => {
    fixture.componentRef.setInput('event', editingEvent);
    fixture.detectChanges();
    const spy = vi.fn();
    fixture.componentInstance.addParticipantsToEvent.subscribe(spy);

    fixture.componentInstance.onParticipantPickerClosed();

    expect(spy).not.toHaveBeenCalled();
  });

  it('clicking Remove on an existing participant emits removeExistingParticipant with the employee id', () => {
    fixture.componentRef.setInput('event', {
      ...editingEvent,
      participants: [{ employeeId: 'emp-1', employeeName: 'Kiru B', responseStatus: 'pending' }]
    });
    fixture.detectChanges();
    openParticipants();
    const spy = vi.fn();
    fixture.componentInstance.removeExistingParticipant.subscribe(spy);

    (fixture.nativeElement.querySelector('[data-testid="calendar-form-existing-participant-remove"]') as HTMLButtonElement).click();

    expect(spy).toHaveBeenCalledWith('emp-1');
  });

  it('shows the viewer as "You · Organizer" when editing their own event', () => {
    fixture.componentRef.setInput('event', { ...editingEvent, isOrganizer: true, organizerName: 'Nadesh C' });
    fixture.detectChanges();
    openParticipants();

    const organizer = fixture.nativeElement.querySelector('[data-testid="calendar-form-organizer"]');
    expect(organizer.textContent).toContain('You');
    expect(organizer.textContent).toContain('Organizer');
    expect(fixture.nativeElement.querySelector('[data-testid="calendar-form-add-participants-edit"]')).toBeTruthy();
  });

  it('shows the organizer by name to another viewer and hides participant management from them', () => {
    fixture.componentRef.setInput('event', {
      ...editingEvent,
      isOrganizer: false, organizerName: 'Nadesh C',
      participants: [{ employeeId: 'emp-viewer', employeeName: 'Viewer V', responseStatus: 'pending' }]
    });
    fixture.detectChanges();
    openParticipants();

    const organizer = fixture.nativeElement.querySelector('[data-testid="calendar-form-organizer"]');
    expect(organizer.textContent).toContain('Nadesh C');
    expect(organizer.textContent).not.toContain('You');
    expect(fixture.nativeElement.querySelector('[data-testid="calendar-form-add-participants-edit"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="calendar-form-existing-participant-remove"]')).toBeNull();
  });

  it('keeps participant management available when the event carries no organizer information', () => {
    fixture.componentRef.setInput('event', {
      ...editingEvent,
      participants: [{ employeeId: 'emp-1', employeeName: 'Kiru B', responseStatus: 'pending' }]
    });
    fixture.detectChanges();
    openParticipants();

    expect(fixture.nativeElement.querySelector('[data-testid="calendar-form-organizer"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="calendar-form-add-participants-edit"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="calendar-form-existing-participant-remove"]')).toBeTruthy();
  });

  describe('guests invited by email', () => {
    const guestRows = () => Array.from(fixture.nativeElement.querySelectorAll('[data-testid="calendar-form-guest-row"]')) as HTMLElement[];

    it('lists picked guests with a Guest badge in create mode and no "No participants yet" text', () => {
      fixture.componentInstance.onGuestEmailsChange(['vendor@example.com']);
      fixture.detectChanges();
      openParticipants();

      expect(guestRows().length).toBe(1);
      expect(guestRows()[0].textContent).toContain('vendor@example.com');
      expect(guestRows()[0].textContent).toContain('Guest');
      expect(fixture.nativeElement.textContent).not.toContain('No participants yet');
    });

    it('removes a picked guest with its remove button', () => {
      fixture.componentInstance.onGuestEmailsChange(['a@x.co', 'b@x.co']);
      fixture.detectChanges();
      openParticipants();

      (guestRows()[0].querySelector('[data-testid="calendar-form-guest-remove"]') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(fixture.componentInstance.guestEmails()).toEqual(['b@x.co']);
      expect(guestRows().length).toBe(1);
    });

    it('sends the picked guests in the create payload', () => {
      fixture.componentInstance.form.patchValue({
        title: 'Vendor sync', startDate: '2026-09-01', startTime: '09:00', endDate: '2026-09-01', endTime: '09:30'
      });
      fixture.componentInstance.onGuestEmailsChange(['vendor@example.com']);
      const spy = vi.fn();
      fixture.componentInstance.save.subscribe(spy);

      fixture.componentInstance.onSubmit(null);

      const { create } = spy.mock.calls[0][0] as { create: { guestEmails: string[] } };
      expect(create.guestEmails).toEqual(['vendor@example.com']);
    });

    it('counts picked guests as unsaved changes', () => {
      fixture.componentInstance.onGuestEmailsChange(['vendor@example.com']);
      const spy = vi.fn();
      fixture.componentInstance.cancel.subscribe(spy);

      fixture.componentInstance.attemptClose();

      expect(spy).not.toHaveBeenCalled();
      expect(fixture.componentInstance.discardConfirmOpen()).toBe(true);
    });

    it('starts with no guests when the modal reopens', () => {
      fixture.componentInstance.onGuestEmailsChange(['vendor@example.com']);

      fixture.componentRef.setInput('open', false);
      fixture.detectChanges();
      fixture.componentRef.setInput('open', true);
      fixture.detectChanges();

      expect(fixture.componentInstance.guestEmails()).toEqual([]);
    });

    it('shows the event\'s existing guests when editing and emits removeExistingGuest from the remove button', () => {
      fixture.componentRef.setInput('event', { ...editingEvent, isOrganizer: true, guests: [{ email: 'vendor@example.com' }] });
      fixture.detectChanges();
      openParticipants();
      const spy = vi.fn();
      fixture.componentInstance.removeExistingGuest.subscribe(spy);

      expect(fixture.nativeElement.querySelector('[data-testid="calendar-form-existing-guest"]').textContent).toContain('vendor@example.com');
      (fixture.nativeElement.querySelector('[data-testid="calendar-form-existing-guest-remove"]') as HTMLButtonElement).click();

      expect(spy).toHaveBeenCalledWith('vendor@example.com');
    });

    it('hides the remove button on existing guests from someone who is not the organizer', () => {
      fixture.componentRef.setInput('event', { ...editingEvent, isOrganizer: false, organizerName: 'Nadesh C', guests: [{ email: 'vendor@example.com' }] });
      fixture.detectChanges();
      openParticipants();

      expect(fixture.nativeElement.querySelector('[data-testid="calendar-form-existing-guest"]')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('[data-testid="calendar-form-existing-guest-remove"]')).toBeNull();
    });

    it('closing the picker while editing emits addGuestsToEvent with the picked guests and clears them', () => {
      fixture.componentRef.setInput('event', { ...editingEvent, isOrganizer: true });
      fixture.detectChanges();
      const guestsSpy = vi.fn();
      const participantsSpy = vi.fn();
      fixture.componentInstance.addGuestsToEvent.subscribe(guestsSpy);
      fixture.componentInstance.addParticipantsToEvent.subscribe(participantsSpy);

      fixture.componentInstance.onGuestEmailsChange(['vendor@example.com']);
      fixture.componentInstance.onParticipantPickerClosed();

      expect(guestsSpy).toHaveBeenCalledWith(['vendor@example.com']);
      expect(participantsSpy).not.toHaveBeenCalled();
      expect(fixture.componentInstance.guestEmails()).toEqual([]);
    });

    it('closing the picker while editing with both people and guests picked emits both', () => {
      fixture.componentRef.setInput('event', { ...editingEvent, isOrganizer: true });
      fixture.detectChanges();
      const guestsSpy = vi.fn();
      const participantsSpy = vi.fn();
      fixture.componentInstance.addGuestsToEvent.subscribe(guestsSpy);
      fixture.componentInstance.addParticipantsToEvent.subscribe(participantsSpy);

      fixture.componentInstance.onParticipantIdsChange(['emp-1']);
      fixture.componentInstance.onGuestEmailsChange(['vendor@example.com']);
      fixture.componentInstance.onParticipantPickerClosed();

      expect(participantsSpy).toHaveBeenCalledWith(['emp-1']);
      expect(guestsSpy).toHaveBeenCalledWith(['vendor@example.com']);
    });

    it('closing the picker while creating keeps the picked guests for the create payload', () => {
      const guestsSpy = vi.fn();
      fixture.componentInstance.addGuestsToEvent.subscribe(guestsSpy);

      fixture.componentInstance.onGuestEmailsChange(['vendor@example.com']);
      fixture.componentInstance.onParticipantPickerClosed();

      expect(guestsSpy).not.toHaveBeenCalled();
      expect(fixture.componentInstance.guestEmails()).toEqual(['vendor@example.com']);
    });
  });

  describe('add participants dropdown', () => {
    const trigger = () => fixture.nativeElement.querySelector('[data-testid="calendar-form-add-participants"]') as HTMLElement;
    const panel = () => fixture.nativeElement.querySelector('[data-testid="calendar-participant-dropdown"]') as HTMLElement | null;

    it('opens a dropdown under the participants search bar, inside the event form, instead of a second modal', () => {
      expect(panel()).toBeNull();

      trigger().click();
      fixture.detectChanges();

      expect(fixture.componentInstance.participantPickerOpen()).toBe(true);
      expect(panel()).not.toBeNull();
      // the search box is the participants field itself, so the dropdown carries no second one
      expect(panel()!.querySelector('[data-testid="people-picker-search"]')).toBeNull();
      expect(document.querySelectorAll('[role="dialog"]').length).toBe(1);
      expect(panel()!.closest('[role="dialog"]')).not.toBeNull();
    });

    it('also opens when the participants box itself is clicked, not only the + button', () => {
      (fixture.nativeElement.querySelector('[data-testid="calendar-form-participant-box"]') as HTMLElement).click();
      fixture.detectChanges();

      expect(fixture.componentInstance.participantPickerOpen()).toBe(true);
      expect(panel()).not.toBeNull();
    });

    it('shows only the search results from the search bar, and only the added people from the avatar stack', () => {
      fixture.componentInstance.onParticipantPeopleChange([{ id: 'e1', name: 'Person 1' }]);
      fixture.componentInstance.onParticipantIdsChange(['e1']);
      fixture.detectChanges();

      trigger().click();
      fixture.detectChanges();
      expect(panel()!.querySelector('app-calendar-participant-picker')).not.toBeNull();
      expect(panel()!.querySelector('[data-testid="calendar-form-participant-row"]')).toBeNull();

      openParticipants();
      expect(panel()!.querySelector('app-calendar-participant-picker')).toBeNull();
      expect(panel()!.querySelectorAll('[data-testid="calendar-form-participant-row"]').length).toBe(1);
    });

    it('stays open while typing in the search bar and keeps the typed text', () => {
      trigger().click();
      fixture.detectChanges();

      const input = trigger() as HTMLInputElement;
      input.value = 'ada';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      expect(fixture.componentInstance.participantPickerOpen()).toBe(true);
      expect(fixture.componentInstance.participantSearch()).toBe('ada');
    });

    it('closes when the user clicks elsewhere in the form, keeping the event form open', () => {
      trigger().click();
      fixture.detectChanges();
      const cancelSpy = vi.fn();
      fixture.componentInstance.cancel.subscribe(cancelSpy);

      (fixture.nativeElement.querySelector('input[placeholder="Add location"]') as HTMLElement).click();
      fixture.detectChanges();

      expect(fixture.componentInstance.participantPickerOpen()).toBe(false);
      expect(cancelSpy).not.toHaveBeenCalled();
    });

    it('closes on Escape without also closing or discarding the event form', () => {
      trigger().click();
      fixture.detectChanges();
      const cancelSpy = vi.fn();
      fixture.componentInstance.cancel.subscribe(cancelSpy);
      trigger().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      fixture.detectChanges();

      expect(fixture.componentInstance.participantPickerOpen()).toBe(false);
      expect(cancelSpy).not.toHaveBeenCalled();
      expect(fixture.componentInstance.discardConfirmOpen()).toBe(false);
    });

    it('stays open while people are picked inside it', () => {
      trigger().click();
      fixture.detectChanges();

      fixture.componentInstance.onParticipantIdsChange(['emp-1']);
      panel()!.click();
      fixture.detectChanges();

      expect(fixture.componentInstance.participantPickerOpen()).toBe(true);
    });

    it('in edit mode submits the picked people when the dropdown closes', () => {
      fixture.componentRef.setInput('event', { ...editingEvent, isOrganizer: true });
      fixture.detectChanges();
      const spy = vi.fn();
      fixture.componentInstance.addParticipantsToEvent.subscribe(spy);
      (fixture.nativeElement.querySelector('[data-testid="calendar-form-add-participants-edit"]') as HTMLElement).click();
      fixture.detectChanges();

      fixture.componentInstance.onParticipantIdsChange(['emp-1']);
      (fixture.nativeElement.querySelector('input[placeholder="Add location"]') as HTMLElement).click();
      fixture.detectChanges();

      expect(spy).toHaveBeenCalledWith(['emp-1']);
      expect(fixture.componentInstance.participantPickerOpen()).toBe(false);
    });
  });
});
