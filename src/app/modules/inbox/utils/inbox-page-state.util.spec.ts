import { InboxItemDto } from '../models/inbox.dto';
import {
  InboxPageState,
  groupByEmployee,
  pageStateFromParams,
  pageStateToParams,
  pageStateToQuery
} from './inbox-page-state.util';

function item(id: string, extra: Partial<InboxItemDto> = {}): InboxItemDto {
  return {
    source: 'leave', kind: 'request', id, category: 'request', actionType: 'annual', title: `Leave ${id}`, subtitle: null,
    status: 'pending', direction: 'received', severity: null, contextType: 'legal_entity', contextId: null, contextName: null,
    requestedBy: { id: 'e1', name: 'Pat' }, requestedTo: null, createdAt: '2026-10-13T08:00:00Z', updatedAt: '2026-10-13T08:00:00Z',
    availableActions: [], unreadMessages: 0, isPending: true, facets: {}, ...extra
  };
}

describe('inbox page state', () => {
  it('reads and writes the URL: tab, direction, search and every filter, so a reload or a shared link restores it', () => {
    const state = pageStateFromParams({ tab: 'alerts', dir: 'about', q: 'pat', sort: 'oldest', source: 'attendance', kind: 'alert', employee: 'e1,e2', requestedOn: '30' });

    expect(state).toEqual<InboxPageState>({
      tab: 'alert', direction: 'about', search: 'pat', sort: 'oldest', filters: { source: ['attendance'], kind: ['alert'], employee: ['e1', 'e2'], requestedOn: ['30'] }
    });
    expect(pageStateToParams(state)).toEqual({ tab: 'alerts', dir: 'about', q: 'pat', sort: 'oldest', source: 'attendance', kind: 'alert', employee: 'e1,e2', requestedOn: '30' });
    expect(pageStateToParams({ tab: 'all', direction: 'all', search: '', sort: 'latest', filters: { requestedOn: ['any'], source: [] } })).toEqual({});
    expect(pageStateFromParams({ tab: 'nonsense', dir: 'x' })).toEqual({ tab: 'all', direction: 'all', search: '', sort: 'latest', filters: {} });
    expect(pageStateFromParams({ tab: 'requests' }).tab).toBe('request');
    expect(pageStateFromParams({ tab: 'history' }).tab).toBe('history');
  });

  it('turns the state into the list query; About me is info items about the caller', () => {
    const now = new Date('2026-10-15T00:00:00Z');
    const query = pageStateToQuery({ tab: 'alert', direction: 'about', search: ' pat ', sort: 'newest', filters: { source: ['attendance'], kind: ['alert'], department: ['d1'], requestedOn: ['7'] } }, 'me', now);

    expect(query).toEqual({
      category: ['alert'], direction: ['info'], source: ['attendance'], project: [], type: [], status: [], requestedBy: [], search: ' pat ', sort: 'newest',
      facets: { kind: ['alert'], department: ['d1'], employee: ['me'] }, from: '2026-10-08T00:00:00.000Z'
    });
    expect(pageStateToQuery({ tab: 'all', direction: 'received', search: '', sort: 'latest', filters: {} }, null, now))
      .toMatchObject({ category: [], direction: ['received'], facets: {}, from: null });
  });

  it('groups alerts by the employee they are about, biggest group first', () => {
    const rows = [
      item('a1', { requestedBy: { id: 'e1', name: 'Pat' } }), item('a2', { requestedBy: { id: 'e2', name: 'Sam' } }),
      item('a3', { requestedBy: { id: 'e2', name: 'Sam' } }), item('a4', { requestedBy: null })
    ];
    expect(groupByEmployee(rows).map((g) => [g.key, g.name, g.items.length])).toEqual([['e2', 'Sam', 2], ['e1', 'Pat', 1], ['-', 'No employee', 1]]);
  });
});
