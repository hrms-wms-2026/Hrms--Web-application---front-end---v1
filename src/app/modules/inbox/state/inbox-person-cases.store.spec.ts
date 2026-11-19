import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { InboxApiService } from '../data-access/inbox-api.service';
import { InboxCategory, InboxItemDto, InboxPersonCaseDto } from '../models/inbox.dto';
import { localMonthBounds } from '../utils/person-cases.util';
import { InboxPersonCasesStore, monthsWithHistory } from './inbox-person-cases.store';

function item(overrides: Partial<InboxItemDto> = {}): InboxItemDto {
  return {
    source: 'monitoring', kind: 'case', id: 'x', category: 'alert', actionType: 'IdentityAnomaly', title: 't', subtitle: null,
    status: 'open', direction: 'received', severity: 'high', contextType: 'legal_entity', contextId: null, contextName: null,
    requestedBy: { id: 'e1', name: 'Bala' }, requestedTo: null, createdAt: '2026-10-15T12:00:00', updatedAt: '2026-10-15T12:00:00',
    availableActions: [], unreadMessages: 0, isPending: true, facets: {},
    ...overrides
  };
}

const row = (id: string, day: number, category: InboxCategory): InboxPersonCaseDto =>
  ({ item: item({ id, category, createdAt: `2026-10-${String(day).padStart(2, '0')}T09:00:00` }), canOpen: true });

const TODAY = new Date(2026, 9, 20, 10);

describe('InboxPersonCasesStore', () => {
  let api: { personCases: ReturnType<typeof vi.fn>; personCaseMonths: ReturnType<typeof vi.fn> };
  let store: InstanceType<typeof InboxPersonCasesStore>;

  beforeEach(() => {
    api = {
      personCases: vi.fn((_: string, category: InboxCategory) =>
        of(category === 'request' ? [row('leave', 3, 'request')] : [row('face', 12, 'alert'), row('late', 1, 'alert')])),
      personCaseMonths: vi.fn((_: string, category: InboxCategory) =>
        of({ hireDate: '2025-06-15', months: category === 'request' ? [{ month: 3, count: 1 }] : [{ month: 10, count: 2 }] }))
    };
    TestBed.configureTestingModule({ providers: [InboxPersonCasesStore, { provide: InboxApiService, useValue: api }] });
    store = TestBed.inject(InboxPersonCasesStore);
  });

  it('loads this month of the person, requests and alerts together, newest first', async () => {
    await store.load('e1', 'Bala', 'me', TODAY);

    const { from, to } = localMonthBounds(2026, 10);
    expect(api.personCases).toHaveBeenCalledWith('e1', 'request', from, to);
    expect(api.personCases).toHaveBeenCalledWith('e1', 'alert', from, to);
    expect(store.monthCases().map((r) => r.item.id)).toEqual(['face', 'leave', 'late']);
    expect(store.personName()).toBe('Bala');
    expect(store.hidden()).toBe(false);
    expect([...store.dots()].sort()).toEqual([10, 3]);
    expect(store.hireDate()).toBe('2025-06-15');
  });

  it('is hidden for the user themself and for nobody, and loads nothing', async () => {
    await store.load('me', 'Me', 'me', TODAY);
    expect(store.hidden()).toBe(true);
    await store.load(null, '', 'me', TODAY);
    expect(store.hidden()).toBe(true);
    expect(api.personCases).not.toHaveBeenCalled();
  });

  it('hides itself when the person cannot be seen (403)', async () => {
    api.personCases.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 })));
    await store.load('e1', 'Bala', 'me', TODAY);
    expect(store.hidden()).toBe(true);
  });

  it('moves to another month, loading that year\'s dots when the year changes', async () => {
    await store.load('e1', 'Bala', 'me', TODAY);
    api.personCaseMonths.mockClear();

    await store.goToMonth(2025, 12);

    expect(store.year()).toBe(2025);
    expect(store.month()).toBe(12);
    expect(api.personCaseMonths).toHaveBeenCalledWith('e1', 'request', 2025, expect.any(Number));
    expect(store.dotsYear()).toBe(2025);
  });

  it('adds up months across requests and alerts', () => {
    expect([...monthsWithHistory([[{ month: 1, count: 1 }], [{ month: 1, count: 0 }, { month: 2, count: 0 }]])]).toEqual([1]);
  });
});
