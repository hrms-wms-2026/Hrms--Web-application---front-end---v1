/** Every card the home dashboard can show. Any card can be moved into any zone. */
export type DashboardCardKey =
  | 'teamStatus'
  | 'actionCenter'
  | 'teamProgress'
  | 'todayAtAGlance'
  | 'todaysSchedule'
  | 'todayTotalTime'
  | 'activeProjects'
  | 'myTasks'
  | 'notifications'
  | 'quickActions'
  | 'wellbeing'
  | 'workPattern';

/** A grid card's width on the 4-column grid: Small = 1 column, Large = 2 columns (2 Small = 1 Large).
 * Cards in the full-width top / bottom bands ignore it. */
export type DashboardCardSize = 'small' | 'large';

export interface DashboardLayout {
  readonly version: 2;
  /** Full-width band above the grid. */
  readonly top: readonly DashboardCardKey[];
  /** The 4-column grid, row-major: cards fill a row left to right, then wrap. */
  readonly grid: readonly DashboardCardKey[];
  /** Full-width band below the grid. */
  readonly bottom: readonly DashboardCardKey[];
  /** Unticked cards. They keep their place in the layout, so re-ticking puts them back there. */
  readonly hidden: readonly DashboardCardKey[];
  /** Sizes the viewer changed in Customize; every other card uses its default size. */
  readonly sizes: Readonly<Partial<Record<DashboardCardKey, DashboardCardSize>>>;
}

export type DashboardZoneId = 'top' | 'grid' | 'bottom';

export interface DashboardCardMeta {
  readonly label: string;
  readonly group: 'team' | 'day';
  /** Width on the grid until the viewer changes it. */
  readonly defaultSize: DashboardCardSize;
}

export const DASHBOARD_CARD_META: Readonly<Record<DashboardCardKey, DashboardCardMeta>> = {
  teamStatus: { label: 'Team Status', group: 'team', defaultSize: 'large' },
  actionCenter: { label: 'Action Center', group: 'team', defaultSize: 'large' },
  teamProgress: { label: 'Team Progress', group: 'team', defaultSize: 'large' },
  todayAtAGlance: { label: 'Good morning', group: 'day', defaultSize: 'small' },
  todaysSchedule: { label: "Today's Schedule", group: 'day', defaultSize: 'large' },
  todayTotalTime: { label: 'Total time today', group: 'day', defaultSize: 'small' },
  activeProjects: { label: 'Active projects', group: 'day', defaultSize: 'small' },
  myTasks: { label: 'My Tasks', group: 'day', defaultSize: 'large' },
  notifications: { label: 'Notifications', group: 'day', defaultSize: 'small' },
  quickActions: { label: 'Quick Actions', group: 'day', defaultSize: 'small' },
  wellbeing: { label: 'Wellbeing', group: 'day', defaultSize: 'small' },
  workPattern: { label: 'Work Pattern', group: 'day', defaultSize: 'large' }
};

/** Display order of the Customize list. */
export const ALL_DASHBOARD_CARD_KEYS = Object.keys(DASHBOARD_CARD_META) as DashboardCardKey[];

export const DASHBOARD_ZONES: readonly DashboardZoneId[] = ['top', 'grid', 'bottom'];

/**
 * What a viewer sees before they ever customize, on the 4-column grid:
 *   row 1  Good morning (S) · Action Center (L) · Quick Actions (S)
 *   row 2  Today's Schedule (L) · Total time today (S) · Active projects (S)
 *   row 3  My Tasks (L) ...
 * then Work Pattern full-width. A viewer without Action Center gets Good morning + Quick Actions
 * and then Today's Schedule - still a full row. Team Status, Notifications and Wellbeing start
 * unticked - in the Customize list, ready to switch on.
 */
export const DEFAULT_DASHBOARD_LAYOUT: DashboardLayout = {
  version: 2,
  top: [],
  grid: [
    'todayAtAGlance',
    'actionCenter',
    'quickActions',
    'todaysSchedule',
    'todayTotalTime',
    'activeProjects',
    'myTasks',
    'teamStatus',
    'notifications',
    'wellbeing',
    'teamProgress'
  ],
  bottom: ['workPattern'],
  hidden: ['teamStatus', 'notifications', 'wellbeing'],
  sizes: {}
};

function isCardKey(value: unknown): value is DashboardCardKey {
  return typeof value === 'string' && value in DASHBOARD_CARD_META;
}

function isCardSize(value: unknown): value is DashboardCardSize {
  return value === 'small' || value === 'large';
}

export function dashboardCardSize(layout: DashboardLayout, key: DashboardCardKey): DashboardCardSize {
  return layout.sizes[key] ?? DASHBOARD_CARD_META[key].defaultSize;
}

function zoneList(layout: DashboardLayout, zone: DashboardZoneId): readonly DashboardCardKey[] {
  return layout[zone];
}

function withZone(layout: DashboardLayout, zone: DashboardZoneId, list: DashboardCardKey[]): DashboardLayout {
  return { ...layout, [zone]: list };
}

/** Where a card sits in the default layout, used to re-home cards a saved layout doesn't have. */
function defaultZoneOf(key: DashboardCardKey): { zone: DashboardZoneId; index: number } {
  for (const zone of DASHBOARD_ZONES) {
    const index = zoneList(DEFAULT_DASHBOARD_LAYOUT, zone).indexOf(key);
    if (index !== -1) return { zone, index };
  }
  return { zone: 'grid', index: DEFAULT_DASHBOARD_LAYOUT.grid.length };
}

/**
 * Turns anything read from storage into a valid layout: unknown keys, duplicates and bad sizes are
 * dropped, and every card the saved layout lacks - a card added in a later release - is placed where
 * the default layout has it. Any card may sit in any zone. Bad shapes fall back to the default, and
 * so do v1 layouts: their three stacked columns have no meaningful order on a row-major grid.
 */
export function sanitizeDashboardLayout(raw: unknown): DashboardLayout {
  if (!raw || typeof raw !== 'object' || (raw as { version?: unknown }).version !== 2) return DEFAULT_DASHBOARD_LAYOUT;
  const input = raw as Record<string, unknown>;
  const seen = new Set<DashboardCardKey>();
  const take = (value: unknown): DashboardCardKey[] =>
    (Array.isArray(value) ? value : []).filter((key): key is DashboardCardKey => {
      if (!isCardKey(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  const lists: Record<DashboardZoneId, DashboardCardKey[]> = {
    top: take(input['top']),
    grid: take(input['grid']),
    bottom: take(input['bottom'])
  };

  for (const key of ALL_DASHBOARD_CARD_KEYS) {
    if (seen.has(key)) continue;
    const { zone, index } = defaultZoneOf(key);
    lists[zone].splice(Math.min(index, lists[zone].length), 0, key);
  }

  const hidden = (Array.isArray(input['hidden']) ? input['hidden'] : []).filter(
    (key, i, all): key is DashboardCardKey => isCardKey(key) && all.indexOf(key) === i
  );

  const rawSizes = input['sizes'] && typeof input['sizes'] === 'object' ? (input['sizes'] as Record<string, unknown>) : {};
  const sizes: Partial<Record<DashboardCardKey, DashboardCardSize>> = {};
  for (const [key, size] of Object.entries(rawSizes)) {
    if (isCardKey(key) && isCardSize(size)) sizes[key] = size;
  }

  return { version: 2, top: lists.top, grid: lists.grid, bottom: lists.bottom, hidden, sizes };
}

export interface ResolvedDashboardLayout {
  readonly top: DashboardCardKey[];
  readonly grid: DashboardCardKey[];
  readonly bottom: DashboardCardKey[];
}

/** What this viewer actually sees: ticked cards they are allowed, in layout order. Never written
 * back to storage - a card filtered out here keeps its saved place. */
export function resolveDashboardLayout(
  layout: DashboardLayout,
  allowed: ReadonlySet<DashboardCardKey>,
  includeHidden = false
): ResolvedDashboardLayout {
  const hidden = new Set(layout.hidden);
  const keep = (keys: readonly DashboardCardKey[]): DashboardCardKey[] =>
    keys.filter((key) => allowed.has(key) && (includeHidden || !hidden.has(key)));
  return { top: keep(layout.top), grid: keep(layout.grid), bottom: keep(layout.bottom) };
}

export function toggleDashboardCard(layout: DashboardLayout, key: DashboardCardKey): DashboardLayout {
  const hidden = layout.hidden.includes(key) ? layout.hidden.filter((k) => k !== key) : [...layout.hidden, key];
  return { ...layout, hidden };
}

/** Sets a card's grid size. Choosing the default drops the override, so Reset and a later change of
 * default both behave. */
export function setDashboardCardSize(layout: DashboardLayout, key: DashboardCardKey, size: DashboardCardSize): DashboardLayout {
  const sizes = { ...layout.sizes };
  if (size === DASHBOARD_CARD_META[key].defaultSize) delete sizes[key];
  else sizes[key] = size;
  return { ...layout, sizes };
}

export function findDashboardCard(layout: DashboardLayout, key: DashboardCardKey): { zone: DashboardZoneId; index: number } | null {
  for (const zone of DASHBOARD_ZONES) {
    const index = zoneList(layout, zone).indexOf(key);
    if (index !== -1) return { zone, index };
  }
  return null;
}

/**
 * Moves a card to any zone and position. `toIndex` counts only the cards `visible` for the viewer
 * (what they dragged among); the card lands right before the visible card at that position, so
 * cards the viewer can't see keep their places.
 */
export function moveDashboardCard(
  layout: DashboardLayout,
  key: DashboardCardKey,
  toZone: DashboardZoneId,
  toIndex: number,
  visible: (key: DashboardCardKey) => boolean = () => true
): DashboardLayout {
  const from = findDashboardCard(layout, key);
  if (!from) return layout;

  const next = withZone(layout, from.zone, zoneList(layout, from.zone).filter((k) => k !== key));
  const target = [...zoneList(next, toZone)];
  const anchor = target.filter(visible)[toIndex];
  const insertAt = anchor === undefined ? target.length : target.indexOf(anchor);
  target.splice(insertAt, 0, key);
  return withZone(next, toZone, target);
}

/**
 * ↑ / ↓ for keyboard and phones, over what the viewer sees. The zones are one sequence - top band,
 * grid, bottom band - so ↑ on the first card of a zone sends it to the end of the previous zone.
 * Inside the grid this is reading order (left to right, then down), which is also how it stacks on phones.
 */
export function stepDashboardCard(
  layout: DashboardLayout,
  key: DashboardCardKey,
  direction: -1 | 1,
  visible: (key: DashboardCardKey) => boolean = () => true
): DashboardLayout {
  const from = findDashboardCard(layout, key);
  if (!from) return layout;
  const shown = zoneList(layout, from.zone).filter((k) => k === key || visible(k));
  const position = shown.indexOf(key);

  if (direction === -1 && position > 0) return moveDashboardCard(layout, key, from.zone, position - 1, visible);
  if (direction === 1 && position < shown.length - 1) return moveDashboardCard(layout, key, from.zone, position + 1, visible);

  const nextZone = DASHBOARD_ZONES[DASHBOARD_ZONES.indexOf(from.zone) + direction];
  if (!nextZone) return layout;
  const nextShown = zoneList(layout, nextZone).filter(visible);
  return moveDashboardCard(layout, key, nextZone, direction === -1 ? nextShown.length : 0, visible);
}
