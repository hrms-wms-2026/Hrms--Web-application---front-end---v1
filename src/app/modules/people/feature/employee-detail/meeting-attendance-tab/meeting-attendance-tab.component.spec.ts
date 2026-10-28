import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MeetingApiService } from '../../../../work/meetings/data-access/meeting-api.service';
import { EmployeeMeetingAttendanceItem } from '../../../../work/meetings/models/meeting.models';
import { MeetingAttendanceTabComponent } from './meeting-attendance-tab.component';

describe('MeetingAttendanceTabComponent', () => {
  let fixture: ComponentFixture<MeetingAttendanceTabComponent>;
  const employeeMeetingAttendance = vi.fn();
  const row = (over: Partial<EmployeeMeetingAttendanceItem> = {}): EmployeeMeetingAttendanceItem => ({
    occurrenceTaskId: 't1', startAt: '2026-11-02T03:30:00Z', endAt: '2026-11-02T04:00:00Z', title: 'Weekly delivery sync',
    organizerName: 'Priya K.', status: 'synced', display: 'Recorded', outcome: 'joined', attendedSeconds: 1500, ...over,
  });

  async function build(): Promise<boolean | undefined> {
    fixture = TestBed.createComponent(MeetingAttendanceTabComponent);
    let available: boolean | undefined;
    fixture.componentInstance.availability.subscribe((a) => (available = a));
    fixture.componentRef.setInput('employeeId', 'e7');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return available;
  }
  const rows = () => Array.from(fixture.nativeElement.querySelectorAll('[data-testid="employee-meeting-row"]')) as HTMLElement[];

  beforeEach(() => {
    employeeMeetingAttendance.mockReset();
    TestBed.configureTestingModule({ providers: [{ provide: MeetingApiService, useValue: { employeeMeetingAttendance } }] });
  });

  it('asks for the last 30 days by default', async () => {
    employeeMeetingAttendance.mockReturnValue(of({ items: [] }));
    await build();
    const [, from, to] = employeeMeetingAttendance.mock.calls[0];
    expect(Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000)).toBe(30);
  });

  it('employee tab hides itself on 404', async () => {
    employeeMeetingAttendance.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404, error: { code: 'meeting_not_found' } })));
    expect(await build()).toBe(false);
    expect((fixture.nativeElement.textContent as string).trim()).toBe('');
  });

  it('reports itself available when the API answers', async () => {
    employeeMeetingAttendance.mockReturnValue(of({ items: [row()] }));
    expect(await build()).toBe(true);
    expect(rows().length).toBe(1);
    expect(rows()[0].textContent).toContain('Weekly delivery sync');
    expect(rows()[0].textContent).toContain('Priya K.');
    expect(rows()[0].textContent).toContain('Joined');
    expect(rows()[0].textContent).toContain('25m');
  });

  it('private rows show Private meeting and no organizer', async () => {
    employeeMeetingAttendance.mockReturnValue(of({ items: [row({ title: 'Private meeting', organizerName: null, outcome: 'unknown', status: 'pending', display: 'Unknown', attendedSeconds: null })] }));
    await build();
    const text = rows()[0].textContent ?? '';
    expect(text).toContain('Private meeting');
    expect(rows()[0].querySelector('[data-testid="employee-meeting-organizer"]')).toBeNull();
    expect(text).toContain('Unknown');
    expect(text.toLowerCase()).not.toContain('absent');
  });

  it('a wider window is capped at 92 days', async () => {
    employeeMeetingAttendance.mockReturnValue(of({ items: [] }));
    await build();
    await fixture.componentInstance.setWindow(92);
    const [, from, to] = employeeMeetingAttendance.mock.calls.at(-1)!;
    expect(Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000)).toBe(92);
    expect(fixture.componentInstance.windows).toEqual([30, 60, 92]);
  });
});
