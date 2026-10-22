import { InboxCategory, InboxItemDto, InboxQuery, InboxSort } from '../models/inbox.dto';
import { requestedOnFrom } from './inbox-item.util';

export type InboxTab = 'all' | InboxCategory | 'history';
/** "about" = items about the caller (Direction=info with the caller as the subject employee). */
export type InboxDirectionChoice = 'all' | 'received' | 'sent' | 'about';

/** Everything the page shows, mirrored in the URL query string so a reload or a shared link restores it. */
export interface InboxPageState {
  tab: InboxTab;
  direction: InboxDirectionChoice;
  search: string;
  sort: InboxSort;
  /** Filter-bar values by key (source, kind, status, project, employee, department, requestedOn, provider fields…). */
  filters: Record<string, string[]>;
}

const TAB_PARAM: Record<InboxTab, string> = { all: 'all', request: 'requests', alert: 'alerts', history: 'history' };
const PARAM_TAB: Record<string, InboxTab> = { all: 'all', requests: 'request', alerts: 'alert', history: 'history', request: 'request', alert: 'alert' };
const DIRECTIONS = new Set<InboxDirectionChoice>(['all', 'received', 'sent', 'about']);
const SORTS = new Set<InboxSort>(['latest', 'newest', 'oldest']);
const RESERVED = new Set(['tab', 'dir', 'q', 'sort']);
/** Filter keys that are InboxQuery fields; every other key is a source facet (kind, employee, department, module…). */
const QUERY_KEYS = new Set(['project', 'source', 'type', 'status', 'requestedBy']);

export function pageStateFromParams(params: Record<string, string | undefined>): InboxPageState {
  const filters: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(params)) {
    if (RESERVED.has(key) || !value) continue;
    filters[key] = value.split(',').map((v) => v.trim()).filter(Boolean);
  }
  const direction = params['dir'] as InboxDirectionChoice;
  return {
    tab: PARAM_TAB[params['tab'] ?? ''] ?? 'all',
    direction: DIRECTIONS.has(direction) ? direction : 'all',
    search: params['q'] ?? '',
    sort: SORTS.has(params['sort'] as InboxSort) ? params['sort'] as InboxSort : 'latest',
    filters
  };
}

/** Defaults are left out, so a plain /inbox stays plain. */
export function pageStateToParams(state: InboxPageState): Record<string, string> {
  const params: Record<string, string> = {};
  if (state.tab !== 'all') params['tab'] = TAB_PARAM[state.tab];
  if (state.direction !== 'all') params['dir'] = state.direction;
  if (state.search.trim()) params['q'] = state.search;
  if (state.sort !== 'latest') params['sort'] = state.sort;
  for (const [key, values] of Object.entries(state.filters)) {
    if (values.length === 0 || (key === 'requestedOn' && values[0] === 'any')) continue;
    params[key] = values.join(',');
  }
  return params;
}

/** The list query for the state. `myEmployeeId` scopes "About me" to the caller. */
export function pageStateToQuery(state: InboxPageState, myEmployeeId: string | null, now = new Date()): Partial<InboxQuery> {
  const query: Partial<InboxQuery> = {
    category: state.tab === 'request' || state.tab === 'alert' ? [state.tab] : [],
    direction: state.direction === 'all' ? [] : state.direction === 'about' ? ['info'] : [state.direction],
    project: [], source: [], type: [], status: [], requestedBy: [],
    search: state.search,
    sort: state.sort
  };
  const facets: Record<string, string[]> = {};
  for (const [key, selected] of Object.entries(state.filters)) {
    if (key === 'requestedOn') continue;
    if (QUERY_KEYS.has(key)) (query as Record<string, string[]>)[key] = selected;
    else if (selected.length > 0) facets[key] = selected;
  }
  if (state.direction === 'about' && myEmployeeId) facets['employee'] = [myEmployeeId];
  return { ...query, facets, from: requestedOnFrom(state.filters['requestedOn']?.[0], now) };
}


export interface InboxEmployeeGroup {
  key: string;
  name: string;
  items: InboxItemDto[];
}

/** Alerts grouped by the employee they are about (requestedBy), biggest group first ("Pat · 21 absent"). */
export function groupByEmployee(items: readonly InboxItemDto[]): InboxEmployeeGroup[] {
  const groups = new Map<string, InboxEmployeeGroup>();
  for (const item of items) {
    const key = item.requestedBy?.id ?? '-';
    const group = groups.get(key) ?? { key, name: item.requestedBy?.name ?? 'No employee', items: [] };
    group.items.push(item);
    groups.set(key, group);
  }
  // Items about no one go last; otherwise the biggest group first, then by name.
  return [...groups.values()].sort((a, b) =>
    Number(a.key === '-') - Number(b.key === '-') || b.items.length - a.items.length || a.name.localeCompare(b.name));
}
