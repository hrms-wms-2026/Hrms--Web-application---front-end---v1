import { InboxItemDto, InboxPersonCaseDto } from '../models/inbox.dto';
import {
  PERSON_CASE_SOURCES,
  isMutedPersonCase,
  localMonthBounds,
  personCaseMonthOf,
  orderPersonCases,
  personCaseSubjectId,
  redDotMonths
} from './person-cases.util';

function item(overrides: Partial<InboxItemDto> = {}): InboxItemDto {
  return {
    source: 'monitoring', kind: 'case', id: 'x', category: 'alert', actionType: 'IdentityAnomaly', title: 't', subtitle: null,
    status: 'open', direction: 'info', severity: 'high', contextType: 'legal_entity', contextId: null, contextName: null,
    requestedBy: { id: 'e1', name: 'Bala' }, requestedTo: null, createdAt: '2026-10-10T09:00:00Z', updatedAt: '2026-10-10T09:00:00Z',
    availableActions: [], unreadMessages: 0, isPending: true, facets: {},
    ...overrides
  };
}

const row = (overrides: Partial<InboxItemDto>, canOpen = true): InboxPersonCaseDto => ({ item: item(overrides), canOpen });

describe('person case helpers', () => {
  it('covers exactly the four person sources', () => {
    expect([...PERSON_CASE_SOURCES].sort()).toEqual(['attendance', 'calendar', 'leave', 'monitoring']);
  });

  it('reads the subject from requestedBy', () => {
    expect(personCaseSubjectId(item())).toBe('e1');
    expect(personCaseSubjectId(item({ requestedBy: null }))).toBeNull();
  });

  it('gives local month bounds, end exclusive', () => {
    const { from, to } = localMonthBounds(2026, 10);
    const start = new Date(from);
    const end = new Date(to);
    expect([start.getFullYear(), start.getMonth(), start.getDate(), start.getHours()]).toEqual([2026, 9, 1, 0]);
    expect([end.getFullYear(), end.getMonth(), end.getDate(), end.getHours()]).toEqual([2026, 10, 1, 0]);
    expect(new Date(localMonthBounds(2026, 12).to).getFullYear()).toBe(2027);
  });

  it('places an attendance alert in its work day’s month, other tickets in their created month', () => {
    const late = item({ source: 'attendance', kind: 'alert', createdAt: '2026-10-17T17:35:00Z', facets: { work_date: ['2026-09-25'] } });

    expect(personCaseMonthOf(late)).toEqual({ year: 2026, month: 9 });
    expect(personCaseMonthOf(item({ createdAt: '2026-10-10T09:00:00' }))).toEqual({ year: 2026, month: 10 });
  });

  it('red dots subtract the current attendance alert from its work-day month', () => {
    const late = item({ source: 'attendance', kind: 'alert', createdAt: '2026-10-17T17:35:00Z', facets: { work_date: ['2026-09-25'] } });

    expect([...redDotMonths([{ month: 9, count: 1 }, { month: 10, count: 1 }], 2026, late)]).toEqual([10]);
  });

  it('drops the current ticket and puts the same type first, newest first in each group', () => {
    const current = item({ id: 'cur' });
    const ordered = orderPersonCases([
      row({ id: 'other-new', actionType: 'SustainedLowActivity', createdAt: '2026-10-20T00:00:00Z' }),
      row({ id: 'cur' }),
      row({ id: 'same-old', createdAt: '2026-10-02T00:00:00Z' }),
      row({ id: 'same-new', createdAt: '2026-10-08T00:00:00Z' }),
      row({ id: 'other-source', source: 'attendance', kind: 'alert', createdAt: '2026-10-21T00:00:00Z' })
    ], current);

    expect(ordered.map((r) => r.item.id)).toEqual(['same-new', 'same-old', 'other-source', 'other-new']);
  });

  it('mutes cancelled requests only', () => {
    expect(isMutedPersonCase(item({ category: 'request', status: 'cancelled' }))).toBe(true);
    expect(isMutedPersonCase(item({ category: 'request', status: 'rejected' }))).toBe(false);
    expect(isMutedPersonCase(item({ status: 'resolved', isPending: false }))).toBe(false);
  });

  it('red dots skip a month whose only case is the current ticket', () => {
    const current = item({ createdAt: '2026-10-15T12:00:00' });
    const dots = redDotMonths([{ month: 3, count: 2 }, { month: 10, count: 1 }], 2026, current);

    expect([...dots].sort((a, b) => a - b)).toEqual([3]);
  });

  it('red dots keep the current month when it holds other cases, and ignore another year', () => {
    const current = item({ createdAt: '2026-10-15T12:00:00' });

    expect([...redDotMonths([{ month: 10, count: 2 }], 2026, current)]).toEqual([10]);
    expect([...redDotMonths([{ month: 10, count: 1 }], 2025, current)]).toEqual([10]);
  });

  it('red dots do not subtract a cancelled current request (the server never counted it)', () => {
    const current = item({ category: 'request', status: 'cancelled', createdAt: '2026-10-15T12:00:00' });

    expect([...redDotMonths([{ month: 10, count: 1 }], 2026, current)]).toEqual([10]);
  });
});
