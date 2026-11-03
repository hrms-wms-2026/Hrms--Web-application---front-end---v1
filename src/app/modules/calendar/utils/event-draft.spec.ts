import { EventDraft, eventCreateRequest, eventInstants } from './event-draft';

describe('event-draft', () => {
  const draft: EventDraft = {
    title: '  Doctor  ', description: 'Bring the report', start: '2026-11-10T09:00', end: '2026-11-10T11:00',
    isAllDay: false, timezone: 'Asia/Colombo', repeat: 'none', location: 'Clinic',
  };

  it('turns wall-clock times in the draft zone into UTC instants', () => {
    expect(eventInstants('2026-11-10T09:00', '2026-11-10T11:00', false, 'Asia/Colombo'))
      .toEqual({ startDate: '2026-11-10T03:30:00.000Z', endDate: '2026-11-10T05:30:00.000Z' });
  });

  it('an all-day draft runs from local midnight to the midnight after its last day', () => {
    expect(eventInstants('2026-11-10T09:00', '2026-11-11T17:00', true, 'Asia/Colombo'))
      .toEqual({ startDate: '2026-11-09T18:30:00.000Z', endDate: '2026-11-11T18:30:00.000Z' });
  });

  it('maps every field of a personal event, with no people, link or colour', () => {
    expect(eventCreateRequest(draft)).toEqual({
      title: 'Doctor', description: 'Bring the report',
      startDate: '2026-11-10T03:30:00.000Z', endDate: '2026-11-10T05:30:00.000Z',
      isAllDay: false, location: 'Clinic', meetingLink: null, color: null, recurrence: 'none',
      participantEmployeeIds: [], recurrenceRule: null, guestEmails: [], pendingMeetingProvider: null,
    });
  });

  it.each(['daily', 'weekly', 'monthly'] as const)('repeat %s sends the same frequency and rule as the event form', (repeat) => {
    const request = eventCreateRequest({ ...draft, repeat });
    expect(request.recurrence).toBe(repeat);
    expect(request.recurrenceRule).toBe(`FREQ=${repeat.toUpperCase()}`);
  });

  it('an empty description or location is sent as null', () => {
    const request = eventCreateRequest({ ...draft, description: '', location: '' });
    expect([request.description, request.location]).toEqual([null, null]);
  });
});
