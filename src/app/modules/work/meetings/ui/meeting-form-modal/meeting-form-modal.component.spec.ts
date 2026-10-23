import { vi } from 'vitest';
import { HttpErrorResponse } from '@angular/common/http';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { NotificationService } from '../../../../../core/services/notification.service';
import { ProjectApiService } from '../../../data-access/project-api.service';
import { MeetingApiService } from '../../data-access/meeting-api.service';
import { MeetingCreatedResponse, MeetingEditResponse, MeetingOccurrenceResponse } from '../../models/meeting.models';
import { MeetingFormModalComponent } from './meeting-form-modal.component';

describe('MeetingFormModalComponent', () => {
  let fixture: ComponentFixture<MeetingFormModalComponent>;
  let form: MeetingFormModalComponent;
  const api = { create: vi.fn(), edit: vi.fn(), getOccurrenceAt: vi.fn() };
  const notify = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };

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
    Object.values(api).forEach((f) => f.mockReset());
    Object.values(notify).forEach((f) => f.mockReset());
    TestBed.configureTestingModule({
      providers: [
        { provide: MeetingApiService, useValue: api },
        { provide: NotificationService, useValue: notify },
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

  it('created outcome toasts and emits so the caller can open the drawer', async () => {
    build({ mode: 'create' });
    fillOffice();
    const created: MeetingCreatedResponse = { outcome: 'created', seriesId: 's9', firstOccurrenceTaskId: 't9', approvalRequestId: null, skipped: [] };
    api.create.mockReturnValue(of(created));
    let saved: unknown;
    form.saved.subscribe((s) => (saved = s));

    await form.save();

    expect(notify.success).toHaveBeenCalledWith('Meeting created');
    expect(saved).toEqual(created);
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
    expect(notify.warning).toHaveBeenCalledWith('2 people were not invited: inactive');
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

  it('an edit sends only the changed fields', async () => {
    build({ mode: 'edit', occurrence: occurrence() });
    expect(form.form.controls.date.value).toBe('2026-11-02');
    expect(form.form.controls.time.value).toBe('09:00');
    form.form.patchValue({ durationMinutes: 60 });
    api.edit.mockReturnValue(of({ seriesId: 's1', occurrenceTaskId: 't1', split: false }));

    await form.save();

    expect(api.edit).toHaveBeenCalledWith('s1', '2026-11-02T03:30:00Z', { scope: 'this', revision: 3, durationMinutes: 60 });
  });
});
