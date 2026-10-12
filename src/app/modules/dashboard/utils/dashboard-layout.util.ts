/** Cards that sit in a column by default. */
export type ColumnCardKey =
  | 'teamStatus'
  | 'actionCenter'
  | 'teamProgress'
  | 'todayAtAGlance'
  | 'todaysSchedule'
  | 'myTasks'
  | 'notifications'
  | 'quickActions'
  | 'wellbeing';

/** Cards that span the full width by default. Any card can be moved into any zone. */
export type FullCardKey = 'workPattern';

export type DashboardCardKey = ColumnCardKey | FullCardKey;

export interface DashboardLayout {
  readonly version: 1;
  /** Full-width band above the columns. */
  readonly top: readonly DashboardCardKey[];
  readonly columns: readonly [readonly DashboardCardKey[], readonly DashboardCardKey[], readonly DashboardCardKey[]];
  /** Full-width band below the columns. */
  readonly bottom: readonly DashboardCardKey[];
  /** Unticked cards. They keep their place in the layout, so re-ticking puts them back there. */
  readonly hidden: readonly DashboardCardKey[];
}

export type DashboardZoneId = 'top' | 'col0' | 'col1' | 'col2' | 'bottom';

export interface DashboardCardMeta {
  readonly label: string;
  readonly group: 'team' | 'day';
  /** Where the card sits in the default layout - not a restriction. */
  readonly width: 'column' | 'full';
}

export const DASHBOARD_CARD_META: Readonly<Record<DashboardCardKey, DashboardCardMeta>> = {
  teamStatus: { label: 'Team Status', group: 'team', width: 'column' },
  actionCenter: { label: 'Action Center', group: 'team', width: 'column' },
  teamProgress: { label: 'Team Progress', group: 'team', width: 'column' },
  todayAtAGlance: { label: 'Good morning', group: 'day', width: 'column' },
  todaysSchedule: { label: "Today's Schedule", group: 'day', width: 'column' },
  myTasks: { label: 'My Tasks', group: 'day', width: 'column' },
  notifications: { label: 'Notifications', group: 'day', width: 'column' },
  quickActions: { label: 'Quick Actions', group: 'day', width: 'column' },
  wellbeing: { label: 'Wellbeing', group: 'day', width: 'column' },
  workPattern: { label: 'Work Pattern', group: 'day', width: 'full' }
};

/** Display order of the Customize list. */
export const ALL_DASHBOARD_CARD_KEYS = Object.keys(DASHBOARD_CARD_META) as DashboardCardKey[];

/** What a viewer sees before they ever customize: Good morning + Today's Schedule, Action Center +
 * My Tasks, Quick Actions + Team Progress, then Work Pattern full-width. Team Status,
 * Notifications and Wellbeing start unticked - in the Customize list, ready to switch on. */
export const DEFAULT_DASHBOARD_LAYOUT: DashboardLayout = {
  version: 1,
  top: [],
  columns: [
    ['todayAtAGlance', 'todaysSchedule', 'teamStatus'],
    ['actionCenter', 'myTasks', 'notifications'],
    ['wellbeing', 'quickActions', 'teamProgress']
  ],
  bottom: ['workPattern'],
  hidden: ['teamStatus', 'notifications', 'wellbeing']
};

function isCardKey(value: unknown): value is DashboardCardKey {
  return typeof value === 'string' && value in DASHBOARD_CARD_META;
}

/** Where a card sits in the default layout, used to re-home cards a saved layout doesn't have. */
function defaultZoneOf(key: DashboardCardKey): { zone: DashboardZoneId; index: number } {
  if (DEFAULT_DASHBOARD_LAYOUT.top.includes(key)) return { zone: 'top', index: DEFAULT_DASHBOARD_LAYOUT.top.indexOf(key) };
  for (let c = 0; c < 3; c++) {
    const index = DEFAULT_DASHBOARD_LAYOUT.columns[c].indexOf(key);
    if (index !== -1) return { zone: `col${c}` as DashboardZoneId, index };
  }
  return { zone: 'bottom', index: DEFAULT_DASHBOARD_LAYOUT.bottom.indexOf(key) };
}

/**
 * Turns anything read from storage into a valid layout: unknown keys and duplicates are dropped,
 * and every card the saved layout lacks - a card added in a later release - is placed where the
 * default layout has it. Any card may sit in any zone. Bad shapes fall back to the default.
 */
export function sanitizeDashboardLayout(raw: unknown): DashboardLayout {
  if (!raw || typeof raw !== 'object' || (raw as { version?: unknown }).version !== 1) return DEFAULT_DASHBOARD_LAYOUT;
  const input = raw as Record<string, unknown>;
  const seen = new Set<DashboardCardKey>();
  const take = (value: unknown): DashboardCardKey[] =>
    (Array.isArray(value) ? value : []).filter((key): key is DashboardCardKey => {
      if (!isCardKey(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  const top = take(input['top']);
  const rawColumns = Array.isArray(input['columns']) ? input['columns'] : [];
  const columns: DashboardCardKey[][] = [take(rawColumns[0]), take(rawColumns[1]), take(rawColumns[2])];
  const bottom = take(input['bottom']);

  for (const key of ALL_DASHBOARD_CARD_KEYS) {
    if (seen.has(key)) continue;
    const { zone, index } = defaultZoneOf(key);
    const list = zone === 'top' ? top : zone === 'bottom' ? bottom : columns[Number(zone.slice(3))];
    list.splice(Math.min(index, list.length), 0, key);
  }

  const hidden = (Array.isArray(input['hidden']) ? input['hidden'] : []).filter(
    (key, i, all): key is DashboardCardKey => isCardKey(key) && all.indexOf(key) === i
  );
  return { version: 1, top, columns: [columns[0], columns[1], columns[2]], bottom, hidden };
}

export interface ResolvedDashboardLayout {
  readonly top: DashboardCardKey[];
  readonly columns: [DashboardCardKey[], DashboardCardKey[], DashboardCardKey[]];
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
  return {
    top: keep(layout.top),
    columns: [keep(layout.columns[0]), keep(layout.columns[1]), keep(layout.columns[2])],
    bottom: keep(layout.bottom)
  };
}

export function toggleDashboardCard(layout: DashboardLayout, key: DashboardCardKey): DashboardLayout {
  const hidden = layout.hidden.includes(key) ? layout.hidden.filter((k) => k !== key) : [...layout.hidden, key];
  return { ...layout, hidden };
}

function zoneList(layout: DashboardLayout, zone: DashboardZoneId): readonly DashboardCardKey[] {
  if (zone === 'top') return layout.top;
  if (zone === 'bottom') return layout.bottom;
  return layout.columns[Number(zone.slice(3))];
}

function withZone(layout: DashboardLayout, zone: DashboardZoneId, list: DashboardCardKey[]): DashboardLayout {
  if (zone === 'top') return { ...layout, top: list };
  if (zone === 'bottom') return { ...layout, bottom: list };
  const columns = [...layout.columns];
  columns[Number(zone.slice(3))] = list;
  return { ...layout, columns: [columns[0], columns[1], columns[2]] };
}

export function findDashboardCard(layout: DashboardLayout, key: DashboardCardKey): { zone: DashboardZoneId; index: number } | null {
  for (const zone of ['top', 'col0', 'col1', 'col2', 'bottom'] as DashboardZoneId[]) {
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

  let next = withZone(layout, from.zone, zoneList(layout, from.zone).filter((k) => k !== key));
  const target = [...zoneList(next, toZone)];
  const visibleInTarget = target.filter(visible);
  const anchor = visibleInTarget[toIndex];
  const insertAt = anchor === undefined ? target.length : target.indexOf(anchor);
  target.splice(insertAt, 0, key);
  next = withZone(next, toZone, target);
  return next;
}

/**
 * ↑ / ↓ for keyboard and phones, over what the viewer sees. Every zone is one sequence - top band,
 * column 1, column 2, column 3, bottom band - so ↑ on the first card of a zone sends it to the end
 * of the previous zone (on phones the columns stack, so this matches the screen).
 */
export function stepDashboardCard(
  layout: DashboardLayout,
  key: DashboardCardKey,
  direction: -1 | 1,
  visible: (key: DashboardCardKey) => boolean = () => true
): DashboardLayout {
  const from = findDashboardCard(layout, key);
  if (!from) return layout;
  const zones: DashboardZoneId[] = ['top', 'col0', 'col1', 'col2', 'bottom'];
  const zoneIndex = zones.indexOf(from.zone);
  const shown = zoneList(layout, from.zone).filter((k) => k === key || visible(k));
  const position = shown.indexOf(key);

  if (direction === -1 && position > 0) return moveDashboardCard(layout, key, from.zone, position - 1, visible);
  if (direction === 1 && position < shown.length - 1) return moveDashboardCard(layout, key, from.zone, position + 1, visible);

  const nextZone = zones[zoneIndex + direction];
  if (!nextZone) return layout;
  const nextShown = zoneList(layout, nextZone).filter(visible);
  return moveDashboardCard(layout, key, nextZone, direction === -1 ? nextShown.length : 0, visible);
}
