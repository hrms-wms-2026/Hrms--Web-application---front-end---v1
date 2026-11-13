import { HttpErrorResponse } from '@angular/common/http';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthStore } from '../../../../../core/auth/state/auth.store';
import { NotificationService } from '../../../../../core/services/notification.service';
import { MeetingApiService } from '../../data-access/meeting-api.service';
import { MeetingOccurrenceResponse } from '../../models/meeting.models';
import { EmployeeDirectoryStore } from '../../../state/employee-directory.store';
import { MeetingOccurrenceDrawerComponent, meetingDurationLabel, meetingPlatformOf } from './meeting-occurrence-drawer.component';

describe('MeetingOccurrenceDrawerComponent', () => {
  let fixture: ComponentFixture<MeetingOccurrenceDrawerComponent>;
  const api = { getOccurrenceAt: vi.fn(), getOccurrence: vi.fn(), getSeries: vi.fn(), respond: vi.fn(), cancel: vi.fn(), move: vi.fn(),
    getLink: vi.fn(), getAttendance: vi.fn() };
  const auth = { employeeId: () => 'e2' as string | null };
  const notify = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
  const directory = { ensureLoaded: vi.fn(async () => undefined), get: vi.fn(() => undefined) };

  const occurrence = (over: Partial<MeetingOccurrenceResponse> = {}): MeetingOccurrenceResponse => ({
    taskId: 't1', shortId: 'ACME-M12', seriesId: 's1', originalStart: '2026-11-02T03:30:00Z',
    startAt: '2026-11-02T03:30:00Z', endAt: '2026-11-02T04:00:00Z', isAllDay: false, timezone: 'Asia/Colombo',
    title: 'Weekly delivery sync', description: '<p>Agenda</p>', location: null, isPrivate: false, status: 'scheduled',
    isDetached: false, revision: 0, seriesRevision: 0, recurrenceRule: 'FREQ=WEEKLY;BYDAY=MO',
    placement: { projectId: 'p1', projectName: 'Acme Portal', objectiveId: 'o1', moduleTitle: 'Delivery', isOffice: false },
    organizer: { employeeId: 'e1', name: 'Priya K.' }, myRole: 'organizer', myResponse: 'accepted',
    attendees: [{ kind: 'employee', employeeId: 'e2', name: 'Arjun M.', email: null, response: 'accepted', responseReason: null, source: 'series' }],
    canEdit: true, ...over,
  });

  async function open(key: { seriesId: string; originalStart: string } | { taskId: string }): Promise<void> {
    fixture = TestBed.createComponent(MeetingOccurrenceDrawerComponent);
    fixture.componentRef.setInput('key', key);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }
  const testId = (id: string) => fixture.nativeElement.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

  beforeEach(() => {
    Object.values(api).forEach((f) => f.mockReset());
    api.getLink.mockReturnValue(of({ joinUrl: null }));
    api.getAttendance.mockReturnValue(of({ status: 'pending', display: 'Unknown', rows: [], unmatched: null }));
    TestBed.configureTestingModule({
      providers: [{ provide: MeetingApiService, useValue: api }, { provide: NotificationService, useValue: notify },
        { provide: AuthStore, useValue: auth }, { provide: EmployeeDirectoryStore, useValue: directory }],
    });
    TestBed.overrideComponent(MeetingOccurrenceDrawerComponent, { set: { imports: [], schemas: [NO_ERRORS_SCHEMA] } });
  });

  it('opens a virtual occurrence by series and original start', async () => {
    api.getOccurrenceAt.mockReturnValue(of(occurrence()));
    await open({ seriesId: 's1', originalStart: '2026-11-02T03:30:00Z' });

    expect(api.getOccurrenceAt).toHaveBeenCalledWith('s1', '2026-11-02T03:30:00Z');
    expect(api.getOccurrence).not.toHaveBeenCalled();
    expect(testId('meeting-drawer-title')?.textContent?.trim()).toBe('Weekly delivery sync');
    expect(testId('meeting-drawer-shortid')?.textContent?.trim()).toBe('ACME-M12');
    expect(testId('meeting-status-pill')?.textContent?.trim()).toBe('Scheduled');
  });

  it('opens a board link by task id', async () => {
    api.getOccurrence.mockReturnValue(of(occurrence()));
    await open({ taskId: 't1' });
    expect(api.getOccurrence).toHaveBeenCalledWith('t1');
  });

  it('shows the not-available state on 404, never a permission message', async () => {
    api.getOccurrenceAt.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404, error: { code: 'meeting_not_found' } })));
    await open({ seriesId: 's1', originalStart: '2026-11-02T03:30:00Z' });
    expect(testId('meeting-drawer-unavailable')?.textContent?.trim()).toBe("This meeting isn't available");
  });

  it('hides organizer actions for attendees', async () => {
    api.getOccurrenceAt.mockReturnValue(of(occurrence({ myRole: 'attendee', canEdit: false, myResponse: 'pending' })));
    await open({ seriesId: 's1', originalStart: '2026-11-02T03:30:00Z' });

    for (const id of ['meeting-edit', 'meeting-cancel', 'meeting-move', 'meeting-attendee-add', 'meeting-attendee-remove', 'meeting-notes-edit']) {
      expect(testId(id), id).toBeNull();
    }
    expect(testId('meeting-rsvp-accept')).not.toBeNull();
    expect(fixture.componentInstance.isOrganizer()).toBe(false);
  });

  it('shows the organizer controls before the end', async () => {
    api.getOccurrenceAt.mockReturnValue(of(occurrence()));
    await open({ seriesId: 's1', originalStart: '2026-11-02T03:30:00Z' });
    for (const id of ['meeting-edit', 'meeting-cancel', 'meeting-move', 'meeting-attendee-add']) {
      expect(testId(id), id).not.toBeNull();
    }
  });

  it('while the meeting is in progress there is no Edit, Cancel or Move', async () => {
    // The server refuses them once the meeting has started (409); notes wait for the end.
    api.getOccurrenceAt.mockReturnValue(of(occurrence({ status: 'in_progress' })));
    await open({ seriesId: 's1', originalStart: '2026-11-02T03:30:00Z' });

    for (const id of ['meeting-edit', 'meeting-cancel', 'meeting-move', 'meeting-notes-edit']) {
      expect(testId(id), id).toBeNull();
    }
  });

  it('a virtual occurrence (beyond the 7-day window) offers no action items', async () => {
    // It has no task yet, so an action item could not be linked to it.
    api.getOccurrenceAt.mockReturnValue(of(occurrence({ shortId: '' })));
    await open({ seriesId: 's1', originalStart: '2026-11-02T03:30:00Z' });

    expect(fixture.nativeElement.querySelector('app-meeting-action-items')).toBeNull();
  });

  it('after the end only notes are editable', async () => {
    api.getOccurrenceAt.mockReturnValue(of(occurrence({ status: 'completed', canEdit: false })));
    await open({ seriesId: 's1', originalStart: '2026-11-02T03:30:00Z' });

    expect(testId('meeting-notes-edit')).not.toBeNull();
    for (const id of ['meeting-edit', 'meeting-cancel', 'meeting-move', 'meeting-attendee-add', 'meeting-attendee-remove']) {
      expect(testId(id), id).toBeNull();
    }
  });

  it('decline keeps the drawer open with read access', async () => {
    api.getOccurrenceAt
      .mockReturnValueOnce(of(occurrence({ myRole: 'attendee', canEdit: false, myResponse: 'pending' })))
      .mockReturnValueOnce(of(occurrence({ myRole: 'attendee', canEdit: false, myResponse: 'rejected' })));
    api.respond.mockReturnValue(of(undefined));
    await open({ seriesId: 's1', originalStart: '2026-11-02T03:30:00Z' });

    await fixture.componentInstance.respond('rejected', 'On leave');
    fixture.detectChanges();

    expect(api.respond).toHaveBeenCalledWith('s1', { status: 'rejected', reason: 'On leave', originalStart: null });
    expect(testId('meeting-drawer-title')?.textContent?.trim()).toBe('Weekly delivery sync');
    expect(testId('meeting-my-response')?.textContent?.trim()).toBe('Declined');
    expect(testId('meeting-drawer-unavailable')).toBeNull();
  });

  it('shows action items for a project meeting, and no attendance section before or after it', async () => {
    api.getOccurrenceAt.mockReturnValue(of(occurrence({ status: 'scheduled' })));
    await open({ seriesId: 's1', originalStart: '2026-11-02T03:30:00Z' });
    expect(fixture.nativeElement.querySelector('app-meeting-attendance-table')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-meeting-action-items')).not.toBeNull();

    api.getOccurrenceAt.mockReturnValue(of(occurrence({ status: 'completed', canEdit: false })));
    await open({ seriesId: 's1', originalStart: '2026-11-02T03:30:00Z' });
    expect(fixture.nativeElement.querySelector('app-meeting-attendance-table')).toBeNull();
  });

  it('follows the new series after a splitting edit', async () => {
    // 09:00 -> 10:00 for "all": the new series' occurrences start at the new time, so the old original start is gone.
    api.getOccurrenceAt
      .mockReturnValueOnce(of(occurrence()))
      .mockReturnValueOnce(of(occurrence({ seriesId: 's2', originalStart: '2026-11-02T04:30:00Z', title: 'New time' })));
    await open({ seriesId: 's1', originalStart: '2026-11-02T03:30:00Z' });

    await fixture.componentInstance.onEdited({ seriesId: 's2', occurrenceTaskId: 't7', split: true, sentStart: '2026-11-02T10:00:00+05:30' });
    fixture.detectChanges();

    expect(api.getOccurrenceAt).toHaveBeenLastCalledWith('s2', '2026-11-02T10:00:00+05:30');
    expect(testId('meeting-drawer-title')?.textContent?.trim()).toBe('New time');
  });

  it("falls back to the new series' next occurrence when the split moved it elsewhere", async () => {
    api.getOccurrenceAt
      .mockReturnValueOnce(of(occurrence()))
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 404, error: { code: 'meeting_not_found' } })))
      .mockReturnValueOnce(of(occurrence({ seriesId: 's2', originalStart: '2026-11-03T04:30:00Z', title: 'New day' })));
    api.getSeries.mockReturnValue(of({ upcomingOccurrences: [{ seriesId: 's2', originalStart: '2026-11-03T04:30:00Z' }] }));
    await open({ seriesId: 's1', originalStart: '2026-11-02T03:30:00Z' });

    await fixture.componentInstance.onEdited({ seriesId: 's2', occurrenceTaskId: 't7', split: true, sentStart: '2026-11-02T10:00:00+05:30' });
    fixture.detectChanges();

    expect(api.getSeries).toHaveBeenCalledWith('s2');
    expect(api.getOccurrenceAt).toHaveBeenLastCalledWith('s2', '2026-11-03T04:30:00Z');
    expect(testId('meeting-drawer-title')?.textContent?.trim()).toBe('New day');
  });

  it('a person added to one occurrence answers for that occurrence', async () => {
    api.getOccurrenceAt.mockReturnValue(of(occurrence({ myRole: 'attendee', canEdit: false, myResponse: 'pending', attendees: [
      { kind: 'employee', employeeId: 'e2', name: 'Arjun M.', email: null, response: null, responseReason: null, source: 'occurrence' },
    ] })));
    api.respond.mockReturnValue(of(undefined));
    await open({ seriesId: 's1', originalStart: '2026-11-02T03:30:00Z' });

    await fixture.componentInstance.respond('accepted', null);

    expect(api.respond).toHaveBeenCalledWith('s1', { status: 'accepted', reason: null, originalStart: '2026-11-02T03:30:00Z' });
  });

  describe('layout', () => {
    const person = (id: string, response: 'accepted' | 'pending' | null = 'accepted') =>
      ({ kind: 'employee' as const, employeeId: id, name: `Person ${id}`, email: null, response, responseReason: null, source: 'series' as const });

    it('shows the time with its length and the Teams location from the meeting', async () => {
      api.getOccurrenceAt.mockReturnValue(of(occurrence({ location: 'Teams' })));
      await open({ seriesId: 's1', originalStart: '2026-11-02T03:30:00Z' });

      expect(testId('meeting-drawer-time')?.textContent).toContain('(30m)');
      expect(testId('meeting-drawer-location')?.textContent?.trim()).toBe('Teams');
      expect(testId('meeting-drawer-placement')).toBeNull();
    });

    it('leaves the location out when the meeting has none', async () => {
      api.getOccurrenceAt.mockReturnValue(of(occurrence({ location: null })));
      await open({ seriesId: 's1', originalStart: '2026-11-02T03:30:00Z' });
      expect(testId('meeting-drawer-location')).toBeNull();
    });

    it('stacks up to 8 avatars with +N, and the full list with Remove opens from the stack', async () => {
      const attendees = Array.from({ length: 10 }, (_, i) => person(`e${i + 2}`));
      api.getOccurrenceAt.mockReturnValue(of(occurrence({ attendees })));
      await open({ seriesId: 's1', originalStart: '2026-11-02T03:30:00Z' });

      const stack = testId('meeting-attendee-toggle')!;
      expect(stack.querySelectorAll('app-avatar').length).toBe(8);
      expect(stack.textContent).toContain('+2');
      expect(testId('meeting-participants-status')?.textContent?.trim()).toBe('Scheduled');
      expect(directory.ensureLoaded).toHaveBeenCalledWith(attendees.map((a) => a.employeeId));
      expect(testId('meeting-attendee-row')).toBeNull();

      stack.click();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('[data-testid="meeting-attendee-row"]').length).toBe(10);
      expect(testId('meeting-attendee-remove')).not.toBeNull();
    });

    it('rings each photo by how they took part: no join recorded, then left early, then attended', async () => {
      // 10:00-11:00; synced attendance: e2 stayed 58m, e3 left after 20m, e4 never joined.
      api.getOccurrenceAt.mockReturnValue(of(occurrence({
        status: 'completed', canEdit: false, startAt: '2026-11-02T10:00:00Z', endAt: '2026-11-02T11:00:00Z',
        attendees: [person('e2'), person('e3'), person('e4')],
      })));
      api.getAttendance.mockReturnValue(of({ status: 'synced', display: 'Recorded', unmatched: null, rows: [
        { kind: 'employee', employeeId: 'e2', email: null, displayName: 'Person e2', attendedSeconds: 58 * 60, outcome: 'joined' },
        { kind: 'employee', employeeId: 'e3', email: null, displayName: 'Person e3', attendedSeconds: 20 * 60, outcome: 'joined' },
        { kind: 'employee', employeeId: 'e4', email: null, displayName: 'Person e4', attendedSeconds: null, outcome: 'no_join_recorded' },
      ] }));
      await open({ seriesId: 's1', originalStart: '2026-11-02T03:30:00Z' });
      fixture.detectChanges();

      const rings = Array.from(fixture.nativeElement.querySelectorAll('[data-testid="meeting-participant"]')) as HTMLElement[];
      expect(rings.map((r) => r.dataset['participation'])).toEqual(['absent', 'left_early', 'attended']);
      expect(rings.map((r) => r.getAttribute('title'))).toEqual(['Person e4 · No join recorded', 'Person e3 · Left early', 'Person e2 · Attended']);
      expect(testId('meeting-participants-status')?.textContent?.trim()).toBe('Completed');
      expect(api.getAttendance).toHaveBeenCalledWith('s1', '2026-11-02T03:30:00Z');
    });

    it('asks for no attendance before the meeting, and rings everyone grey', async () => {
      api.getOccurrenceAt.mockReturnValue(of(occurrence({ attendees: [person('e2'), person('e3')] })));
      await open({ seriesId: 's1', originalStart: '2026-11-02T03:30:00Z' });
      expect(api.getAttendance).not.toHaveBeenCalled();
      const rings = Array.from(fixture.nativeElement.querySelectorAll('[data-testid="meeting-participant"]')) as HTMLElement[];
      expect(rings.map((r) => r.dataset['participation'])).toEqual(['unknown', 'unknown']);
    });

    it('offers Join only before the end, and only with a link', async () => {
      api.getLink.mockReturnValue(of({ joinUrl: 'https://teams.microsoft.com/l/meetup-join/abc' }));
      api.getOccurrenceAt.mockReturnValue(of(occurrence({ status: 'scheduled', myRole: 'attendee', canEdit: false, myResponse: 'accepted' })));
      await open({ seriesId: 's1', originalStart: '2026-11-02T03:30:00Z' });
      fixture.detectChanges();
      expect((testId('meeting-join') as HTMLAnchorElement).href).toBe('https://teams.microsoft.com/l/meetup-join/abc');
      expect(testId('meeting-notes-edit')).toBeNull();

      api.getOccurrenceAt.mockReturnValue(of(occurrence({ status: 'completed', canEdit: false })));
      await open({ seriesId: 's1', originalStart: '2026-11-02T03:30:00Z' });
      fixture.detectChanges();
      expect(testId('meeting-join')).toBeNull();

      api.getLink.mockReturnValue(of({ joinUrl: null }));
      api.getOccurrenceAt.mockReturnValue(of(occurrence({ status: 'scheduled' })));
      await open({ seriesId: 's1', originalStart: '2026-11-02T03:30:00Z' });
      fixture.detectChanges();
      expect(testId('meeting-join')).toBeNull();
    });

    it('has no Online meeting section any more', async () => {
      api.getOccurrenceAt.mockReturnValue(of(occurrence()));
      await open({ seriesId: 's1', originalStart: '2026-11-02T03:30:00Z' });
      expect(fixture.nativeElement.querySelector('app-meeting-link-panel')).toBeNull();
      expect(fixture.nativeElement.textContent).not.toContain('Online meeting');
    });

    it('names the meeting app from the location, and the length of the meeting', () => {
      expect(meetingPlatformOf('Microsoft Teams')).toBe('teams');
      expect(meetingPlatformOf('zoom room')).toBe('zoom');
      expect(meetingPlatformOf('Board room 2')).toBeNull();
      expect(meetingPlatformOf(null)).toBeNull();
      expect(meetingDurationLabel('2026-11-02T10:00:00Z', '2026-11-02T11:00:00Z')).toBe('1h');
      expect(meetingDurationLabel('2026-11-02T10:00:00Z', '2026-11-02T11:30:00Z')).toBe('1h 30m');
      expect(meetingDurationLabel('2026-11-02T10:00:00Z', '2026-11-02T10:45:00Z')).toBe('45m');
    });
  });
});
