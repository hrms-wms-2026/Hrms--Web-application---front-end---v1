import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of, throwError } from 'rxjs';
import { InboxApiService } from '../data-access/inbox-api.service';
import { InboxItemDto, InboxPersonCaseDto } from '../models/inbox.dto';
import { localMonthBounds } from '../utils/person-cases.util';
import { InboxPersonCasesStore } from './inbox-person-cases.store';

function item(overrides: Partial<InboxItemDto> = {}): InboxItemDto {
  return {
    source: 'monitoring', kind: 'case', id: 'cur', category: 'alert', actionType: 'IdentityAnomaly', title: 't', subtitle: null,
    status: 'open', direction: 'received', severity: 'high', contextType: 'legal_entity', contextId: null, contextName: null,
    requestedBy: { id: 'e1', name: 'Bala' }, requestedTo: null, createdAt: '2026-10-15T12:00:00', updatedAt: '2026-10-15T12:00:00',
    availableActions: [], unreadMessages: 0, isPending: true, facets: {},
    ...overrides
  };
}

const row = (id: string, day = 5): InboxPersonCaseDto =>
  ({ item: item({ id, createdAt: `2026-10-${String(day).padStart(2, '0')}T09:00:00` }), canOpen: true });

describe('InboxPersonCasesStore', () => {
  let api: { personCases: ReturnType<typeof vi.fn>; personCaseMonths: ReturnType<typeof vi.fn> };
  let store: InstanceType<typeof InboxPersonCasesStore>;

  beforeEach(() => {
    api = {
      personCases: vi.fn(() => of([] as InboxPersonCaseDto[])),
      personCaseMonths: vi.fn(() => of({ hireDate: '2025-06-15', months: [{ month: 3, count: 1 }] }))
    };
    TestBed.configureTestingModule({ providers: [InboxPersonCasesStore, { provide: InboxApiService, useValue: api }] });
    store = TestBed.inject(InboxPersonCasesStore);
  });

  it('loads the ticket\'s month for its subject and category, without the current ticket', async () => {
    api.personCases.mockReturnValue(of([row('cur', 15), row('a'), row('b')]));

    await store.load(item(), 'me');

    const { from, to } = localMonthBounds(2026, 10);
    expect(api.personCases).toHaveBeenCalledWith('e1', 'alert', from, to);
    expect(store.compact().map((r) => r.item.id)).toEqual(['a', 'b']);
    expect(store.hidden()).toBe(false);
  });

  it('caps the compact rows at 5 and counts the rest for View all', async () => {
    api.personCases.mockReturnValue(of(['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) => row(id))));
    await store.load(item(), 'me');
    expect(store.compactRows()).toHaveLength(5);
    expect(store.moreCount()).toBe(7);

    api.personCases.mockReturnValue(of(['a', 'b', 'c', 'd', 'e'].map((id) => row(id))));
    await store.load(item({ id: 'other' }), 'me');
    expect(store.moreCount()).toBe(0);
  });

  it('hides without a request for a source with no person history', async () => {
    await store.load(item({ source: 'work' }), 'me');

    expect(store.hidden()).toBe(true);
    expect(api.personCases).not.toHaveBeenCalled();
  });

  it('hides when the caller is the subject', async () => {
    await store.load(item(), 'e1');

    expect(store.hidden()).toBe(true);
    expect(api.personCases).not.toHaveBeenCalled();
  });

  it('hides silently on 403', async () => {
    api.personCases.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 })));

    await store.load(item(), 'me');

    expect(store.hidden()).toBe(true);
    expect(store.compact()).toEqual([]);
  });

  it('opens the full view on the ticket\'s month and fetches that year\'s dots', async () => {
    api.personCases.mockReturnValue(of([row('a')]));
    await store.load(item(), 'me');

    await store.openView();

    expect(store.viewOpen()).toBe(true);
    expect([store.year(), store.month()]).toEqual([2026, 10]);
    expect(store.monthCases().map((r) => r.item.id)).toEqual(['a']);
    expect(api.personCaseMonths).toHaveBeenCalledWith('e1', 'alert', 2026, expect.any(Number));
    expect([...store.dots()]).toEqual([3]);
    expect(store.hireDate()).toBe('2025-06-15');
  });

  it('refetches dots only when the year changes', async () => {
    await store.load(item(), 'me');
    await store.openView();
    api.personCaseMonths.mockClear();

    await store.goToMonth(2026, 9);
    expect(api.personCases).toHaveBeenLastCalledWith('e1', 'alert', localMonthBounds(2026, 9).from, localMonthBounds(2026, 9).to);
    expect(api.personCaseMonths).not.toHaveBeenCalled();

    await store.goToMonth(2025, 12);
    expect(api.personCaseMonths).toHaveBeenCalledWith('e1', 'alert', 2025, expect.any(Number));
    expect([store.year(), store.month()]).toEqual([2025, 12]);
  });

  it('closes the view back to the details', async () => {
    await store.load(item(), 'me');
    await store.openView();

    store.closeView();

    expect(store.viewOpen()).toBe(false);
  });

  it('ignores a late response for a ticket that is no longer current', async () => {
    const late = new Subject<InboxPersonCaseDto[]>();
    api.personCases.mockReturnValueOnce(late);
    const first = store.load(item({ id: 'first' }), 'me');
    api.personCases.mockReturnValueOnce(of([row('fresh')]));
    await store.load(item({ id: 'second' }), 'me');

    late.next([row('stale')]);
    late.complete();
    await first;

    expect(store.compact().map((r) => r.item.id)).toEqual(['fresh']);
  });
});
