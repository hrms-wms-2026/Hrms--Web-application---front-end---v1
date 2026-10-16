import { InboxCapability, InboxItemDto, InboxKindDescriptorDto } from '../models/inbox.dto';
import {
  INBOX_BULK_ACTIONS,
  InboxPageState,
  bulkActionsFor,
  groupByEmployee,
  pageStateFromParams,
  pageStateToParams,
  pageStateToQuery,
  tabCounts
} from './inbox-page-state.util';

function item(id: string, extra: Partial<InboxItemDto> = {}): InboxItemDto {
  return {
    source: 'leave', kind: 'request', id, category: 'request', actionType: 'annual', title: `Leave ${id}`, subtitle: null,
    status: 'pending', direction: 'received', severity: null, contextType: 'legal_entity', contextId: null, contextName: null,
    requestedBy: { id: 'e1', name: 'Pat' }, requestedTo: null, createdAt: '2026-10-13T08:00:00Z', updatedAt: '2026-10-13T08:00:00Z',
    availableActions: [], unreadMessages: 0, isPending: true, facets: {}, ...extra
  };
}

const KINDS: InboxKindDescriptorDto[] = [
  { source: 'leave', kind: 'request', label: 'Leave request', category: 'request', capabilities: InboxCapability.Bulk, detailRenderer: null },
  { source: 'attendance', kind: 'alert', label: 'Attendance alert', category: 'alert', capabilities: InboxCapability.Bulk | InboxCapability.Resolve, detailRenderer: null },
  { source: 'work', kind: 'approval', label: 'Work request', category: 'request', capabilities: 0, detailRenderer: null }
];
const descriptor = (source: string, kind: string) => KINDS.find((k) => k.source === source && k.kind === kind) ?? null;

const action = (key: string, meta?: Record<string, string>) =>
  ({ key, label: key, tone: 'primary' as const, needsComment: key === 'reject', needsPayload: false, meta });

describe('inbox page state', () => {
  it('counts the tabs from byKind using the kind registry, falling back to the totals', () => {
    const counts = { pendingReceived: 5, unreadMessages: 0, openAlerts: 21, byKind: { 'leave:request': 3, 'work:approval': 2, 'attendance:alert': 21 } };
    expect(tabCounts(counts, KINDS)).toEqual({ all: 26, request: 5, alert: 21 });
    expect(tabCounts({ pendingReceived: 4, unreadMessages: 0, openAlerts: 2 }, [])).toEqual({ all: 6, request: 4, alert: 2 });
  });

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

  it('offers only the bulk actions every selected item has, with the outcomes they share', () => {
    const leave = item('l1', { availableActions: [action('approve'), action('reject')] });
    const leave2 = item('l2', { availableActions: [action('approve')] });
    const alert = item('a1', { source: 'attendance', kind: 'alert', category: 'alert', availableActions: [action('resolve', { outcomes: 'excused,confirmed,convert_to_leave' })] });
    const alert2 = item('a2', { source: 'attendance', kind: 'alert', category: 'alert', availableActions: [action('resolve', { outcomes: 'excused,confirmed' })] });

    expect(INBOX_BULK_ACTIONS).toEqual(['approve', 'reject', 'resolve']);
    expect(bulkActionsFor([leave, leave2], descriptor).map((a) => a.key)).toEqual(['approve']);
    expect(bulkActionsFor([alert, alert2], descriptor)).toEqual([{ key: 'resolve', label: 'Resolve', needsComment: false, outcomes: ['excused', 'confirmed'] }]);
    expect(bulkActionsFor([leave, item('w1', { source: 'work', kind: 'approval', availableActions: [action('approve')] })], descriptor)).toEqual([]);
    expect(bulkActionsFor([], descriptor)).toEqual([]);
  });

  it('groups alerts by the employee they are about, biggest group first', () => {
    const rows = [
      item('a1', { requestedBy: { id: 'e1', name: 'Pat' } }), item('a2', { requestedBy: { id: 'e2', name: 'Sam' } }),
      item('a3', { requestedBy: { id: 'e2', name: 'Sam' } }), item('a4', { requestedBy: null })
    ];
    expect(groupByEmployee(rows).map((g) => [g.key, g.name, g.items.length])).toEqual([['e2', 'Sam', 2], ['e1', 'Pat', 1], ['-', 'No employee', 1]]);
  });
});
