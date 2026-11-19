import { TaskStatusColumn } from '../../models/task.model';
import { MeetingListItem } from '../models/meeting.models';
import { liveMeetingStatus, meetingsByStatusColumn, visibleMeetings } from './meeting-board';

const meeting = (overrides: Partial<MeetingListItem> = {}): MeetingListItem => ({
  taskId: 'm1', shortId: 'P-M1', seriesId: 's1', originalStart: '2026-11-02T09:00:00Z', startAt: '2026-11-02T09:00:00Z',
  endAt: '2026-11-02T10:00:00Z', isAllDay: false, title: 'Standup', status: 'scheduled', isPrivate: false,
  projectId: 'p1', objectiveId: 'o1', myRole: 'attendee', myResponse: 'accepted', ...overrides,
});

const column = (id: string, category: TaskStatusColumn['category'], displayOrder: number): TaskStatusColumn => ({
  id, name: id, displayOrder, requiresApproval: false, marksTaskComplete: category === 'done', visibility: 'public', category, color: '',
});

describe('liveMeetingStatus', () => {
  it('follows the clock: scheduled before the start, in progress until the end, completed after', () => {
    const m = meeting();
    expect(liveMeetingStatus(m, new Date('2026-11-02T08:59:00Z'))).toBe('scheduled');
    expect(liveMeetingStatus(m, new Date('2026-11-02T09:00:00Z'))).toBe('in_progress');
    expect(liveMeetingStatus(m, new Date('2026-11-02T09:59:00Z'))).toBe('in_progress');
    expect(liveMeetingStatus(m, new Date('2026-11-02T10:00:00Z'))).toBe('completed');
  });

  it('keeps a cancelled meeting cancelled whatever the time', () => {
    expect(liveMeetingStatus(meeting({ status: 'cancelled' }), new Date('2026-11-02T09:30:00Z'))).toBe('cancelled');
  });
});

describe('visibleMeetings', () => {
  it('drops cancelled meetings and sets each status from the clock', () => {
    const now = new Date('2026-11-02T09:30:00Z');
    const result = visibleMeetings([meeting(), meeting({ taskId: 'm2', status: 'cancelled' })], now);
    expect(result.map((m) => [m.taskId, m.status])).toEqual([['m1', 'in_progress']]);
  });

  it('orders meetings by start', () => {
    const later = meeting({ taskId: 'late', startAt: '2026-11-02T12:00:00Z', endAt: '2026-11-02T13:00:00Z' });
    const result = visibleMeetings([later, meeting()], new Date('2026-11-01T00:00:00Z'));
    expect(result.map((m) => m.taskId)).toEqual(['m1', 'late']);
  });
});

describe('meetingsByStatusColumn', () => {
  const columns = [column('review', 'active', 3), column('todo', 'not_started', 1), column('done', 'done', 4), column('doing', 'active', 2)];

  it('puts each meeting in the first column (by display order) of its status category', () => {
    const scheduled = meeting({ taskId: 'a', status: 'scheduled' });
    const running = meeting({ taskId: 'b', status: 'in_progress' });
    const finished = meeting({ taskId: 'c', status: 'completed' });
    const byColumn = meetingsByStatusColumn([scheduled, running, finished], columns);
    expect(byColumn.get('todo')?.map((m) => m.taskId)).toEqual(['a']);
    expect(byColumn.get('doing')?.map((m) => m.taskId)).toEqual(['b']);
    expect(byColumn.get('done')?.map((m) => m.taskId)).toEqual(['c']);
    expect(byColumn.get('review')).toBeUndefined();
  });

  it('never places a cancelled meeting', () => {
    expect(meetingsByStatusColumn([meeting({ status: 'cancelled' })], columns).size).toBe(0);
  });

  it('leaves a meeting out when the board has no column of its category', () => {
    expect(meetingsByStatusColumn([meeting({ status: 'in_progress' })], [column('todo', 'not_started', 1)]).size).toBe(0);
  });
});
