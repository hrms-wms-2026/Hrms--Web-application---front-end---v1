import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MeetingApiService } from '../../data-access/meeting-api.service';
import { MeetingAttendanceResponse, MeetingAttendanceSyncStatus, MeetingAttendee } from '../../models/meeting.models';
import { MeetingAttendanceTableComponent } from './meeting-attendance-table.component';

describe('MeetingAttendanceTableComponent', () => {
  let fixture: ComponentFixture<MeetingAttendanceTableComponent>;
  const api = { getAttendance: vi.fn(), recheckAttendance: vi.fn() };
  const endedAt = (daysAgo: number) => new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();

  const attendees: MeetingAttendee[] = [
    { kind: 'employee', employeeId: 'e2', name: 'Arjun M.', email: null, response: 'accepted', responseReason: null, source: 'series' },
    { kind: 'employee', employeeId: 'e3', name: 'Bala K.', email: null, response: 'accepted', responseReason: null, source: 'series' },
  ];
  const response = (status: MeetingAttendanceSyncStatus, over: Partial<MeetingAttendanceResponse> = {}): MeetingAttendanceResponse => ({
    status, display: status === 'synced' ? 'Recorded' : 'Unknown',
    rows: [{ kind: 'employee', employeeId: 'e2', email: null, displayName: 'Arjun M.', attendedSeconds: 3900, outcome: 'joined' }],
    unmatched: [], ...over,
  });

  async function build(r: MeetingAttendanceResponse, isOrganizer = true, endAt = endedAt(1)): Promise<void> {
    api.getAttendance.mockReturnValue(of(r));
    fixture = TestBed.createComponent(MeetingAttendanceTableComponent);
    fixture.componentRef.setInput('seriesId', 's1');
    fixture.componentRef.setInput('originalStart', '2026-11-02T03:30:00Z');
    fixture.componentRef.setInput('endAt', endAt);
    fixture.componentRef.setInput('isOrganizer', isOrganizer);
    fixture.componentRef.setInput('attendees', attendees);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }
  const rowFor = (name: string) => (Array.from(fixture.nativeElement.querySelectorAll('[data-testid="attendance-row"]')) as HTMLElement[])
    .find((r) => r.textContent?.includes(name));
  const outcomeOf = (name: string) => rowFor(name)?.querySelector('[data-testid="attendance-outcome"]')?.textContent?.trim();

  beforeEach(() => {
    Object.values(api).forEach((f) => f.mockReset());
    TestBed.configureTestingModule({ providers: [{ provide: MeetingApiService, useValue: api }] });
  });

  it('uses No join recorded only when synced', async () => {
    // Bala has no attendance row. Once synced that means no join was recorded; before that it is unknown.
    await build(response('synced'));
    expect(outcomeOf('Arjun M.')).toBe('Joined');
    expect(outcomeOf('Bala K.')).toBe('No join recorded');

    await build(response('pending'));
    expect(outcomeOf('Bala K.')).toBe('Unknown');

    await build(response('sync_failed', { rows: [{ kind: 'employee', employeeId: 'e3', email: null, displayName: 'Bala K.', attendedSeconds: null, outcome: 'no_join_recorded' }] }));
    expect(outcomeOf('Bala K.')).toBe('Unknown');
  });

  it('never renders the word Absent', async () => {
    for (const status of ['synced', 'pending', 'provisional', 'attendance_unavailable', 'sync_failed', 'not_applicable'] as const) {
      await build(response(status));
      expect((fixture.nativeElement.textContent as string).toLowerCase()).not.toContain('absent');
    }
  });

  it('shows the time attended as hours and minutes', async () => {
    await build(response('synced'));
    expect(rowFor('Arjun M.')?.querySelector('[data-testid="attendance-time"]')?.textContent?.trim()).toBe('1h 5m');
  });

  it('an attendee sees their own row only, and no organizer extras', async () => {
    await build(response('synced', { unmatched: null }), false);
    expect(fixture.nativeElement.querySelectorAll('[data-testid="attendance-row"]').length).toBe(1);
    expect(fixture.nativeElement.querySelector('[data-testid="attendance-recheck"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="attendance-unmatched"]')).toBeNull();
  });

  it('the organizer sees sessions not matched to a meeting', async () => {
    await build(response('synced', { unmatched: [{ start: '2026-11-02T03:31:00Z', end: null }] }));
    expect(fixture.nativeElement.querySelector('[data-testid="attendance-unmatched"]')?.textContent).toContain('Sessions not matched to a meeting');
  });

  it('recheck is hidden after 7 days', async () => {
    await build(response('synced'), true, endedAt(6));
    expect(fixture.nativeElement.querySelector('[data-testid="attendance-recheck"]')).not.toBeNull();

    await build(response('synced'), true, endedAt(8));
    expect(fixture.nativeElement.querySelector('[data-testid="attendance-recheck"]')).toBeNull();
  });

  it('a recheck that is already running says so', async () => {
    await build(response('synced'));
    api.recheckAttendance.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { code: 'attendance_check_in_progress' } })));
    (fixture.nativeElement.querySelector('[data-testid="attendance-recheck"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Attendance is already being checked.');
  });
});
