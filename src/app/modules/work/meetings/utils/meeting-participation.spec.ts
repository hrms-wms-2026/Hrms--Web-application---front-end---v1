import { describe, expect, it } from 'vitest';
import { MeetingAttendanceResponse, MeetingAttendee } from '../models/meeting.models';
import { orderedParticipants, participationOf } from './meeting-participation';

const start = '2026-11-02T10:00:00Z';
const end = '2026-11-02T11:00:00Z';
const person = (id: string, email: string | null = null): MeetingAttendee =>
  ({ kind: email ? 'guest' : 'employee', employeeId: email ? null : id, name: id, email, response: 'accepted', responseReason: null, source: 'series' });
const attendance = (status: MeetingAttendanceResponse['status'], rows: MeetingAttendanceResponse['rows']): MeetingAttendanceResponse =>
  ({ status, display: 'Recorded', rows, unmatched: null });
const joined = (id: string, minutes: number | null) =>
  ({ kind: 'employee' as const, employeeId: id, email: null, displayName: id, attendedSeconds: minutes === null ? null : minutes * 60, outcome: 'joined' as const });

describe('meeting participation', () => {
  it('is unknown with no attendance', () => {
    expect(participationOf(person('e1'), null, start, end)).toBe('unknown');
  });

  it('attended when they stayed for most of it, left early under 90%', () => {
    const a = attendance('synced', [joined('e1', 55), joined('e2', 53)]);
    expect(participationOf(person('e1'), a, start, end)).toBe('attended');
    expect(participationOf(person('e2'), a, start, end)).toBe('left_early');
  });

  it('a join with no time recorded counts as attended', () => {
    expect(participationOf(person('e1'), attendance('provisional', [joined('e1', null)]), start, end)).toBe('attended');
  });

  it('absent only once attendance has synced with no join for them', () => {
    expect(participationOf(person('e9'), attendance('synced', []), start, end)).toBe('absent');
    expect(participationOf(person('e9'), attendance('provisional', []), start, end)).toBe('unknown');
    expect(participationOf(person('e9'), attendance('not_applicable', []), start, end)).toBe('unknown');
  });

  it('matches a guest by email, ignoring case', () => {
    const a = attendance('synced', [{ kind: 'guest', employeeId: null, email: 'Guest@Acme.com', displayName: 'g', attendedSeconds: 3600, outcome: 'joined' }]);
    expect(participationOf(person('g', 'guest@acme.com'), a, start, end)).toBe('attended');
  });

  it('orders absent, then left early, then attended, then unknown, keeping invite order within each', () => {
    const a = attendance('synced', [joined('a1', 60), joined('l1', 10), joined('a2', 60)]);
    const order = orderedParticipants([person('a1'), person('x1'), person('l1'), person('a2'), person('x2')], a, start, end)
      .map((p) => `${p.attendee.employeeId}:${p.participation}`);
    expect(order).toEqual(['x1:absent', 'x2:absent', 'l1:left_early', 'a1:attended', 'a2:attended']);
  });
});
