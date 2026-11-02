import { DASHBOARD_DONUT_PX } from './dashboard-donut.util';

/** How the Working / Break / Leave card lays itself out at its rendered size. The detail dialog is the popup. */
export type PresenceView = 'mini' | 'xs' | 'standard';

/**
 * Size thresholds in CSS pixels, measured on the card host. The grid uses 96px rows with a 12px gap
 * (2 rows = 204px, 3 = 312, 4 = 420, 5 = 528, 6 = 636), and a column is about 97px wide at 1440px and 140px at 1920px.
 */
export const PRESENCE_BREAKPOINTS = {
  /** Below this height (between 2 and 3 rows) only the mini view fits. */
  miniHeight: 260,
  /** Below this width the card shows the xs view: the donut over its legend, then rows. */
  xsWidth: 370,
  /** A narrow card needs this height for the donut, its legend and the pill; shorter, it stays mini. */
  xsMinHeight: 340,
  /** From this body width a mini card swaps the donut for a stacked bar and legend. */
  miniInlineWidth: 320,
  /** From this card width the person rows become a table. */
  tableWidth: 640,
} as const;

/** How far past a threshold the size must move before the view changes back. */
export const PRESENCE_HYSTERESIS = 20;

/** Card padding plus its title header: the host size minus this is the body. */
export const PRESENCE_CARD_CHROME = { width: 32, height: 68 } as const;

/** Fixed heights the plan budgets with (they match the card's CSS). */
export const PRESENCE_SECTION_PX = {
  /** "N employees are currently working ›". */
  pill: 36,
  /** The xs legend under the donut: three count rows. */
  legend: 72,
  /** The three KPI tiles. */
  tiles: 72,
  /** One person row (list). */
  row: 56,
  tableHead: 32,
  tableRow: 40,
  /** The week's working-hours trend panel. */
  trend: 150,
  /** "View all N ›". */
  viewAll: 28,
  gap: 12,
} as const;

export type PresenceColumn = 'status' | 'start' | 'elapsed' | 'remaining' | 'todayHours' | 'progress';

/** Table column widths; the employee column and # always take theirs first. Columns drop right to left. */
export const PRESENCE_COLUMN_PX: Record<PresenceColumn, number> = {
  status: 100,
  start: 80,
  elapsed: 72,
  remaining: 80,
  todayHours: 80,
  progress: 140,
};
const PRESENCE_FIXED_COLUMNS_PX = 32 + 180;
const PRESENCE_COLUMN_ORDER: PresenceColumn[] = ['status', 'start', 'elapsed', 'remaining', 'todayHours', 'progress'];

/** Rows that must fit before the trend panel is worth its height. */
const ROWS_BEFORE_TREND = 5;

export interface PresencePlan {
  /** mini: stacked bar + legend instead of the donut. */
  miniInline: boolean;
  /** "N employees are currently working ›". */
  pill: boolean;
  /** standard: the three KPI tiles. */
  tiles: boolean;
  /** Rows as a table (width ≥ tableWidth). */
  table: boolean;
  /** Table columns that fit, in that priority order. */
  columns: PresenceColumn[];
  /** Person rows that fit. */
  rows: number;
  /** "View all N ›", reserved only while rows hide someone. */
  viewAll: boolean;
  /** The week's working-hours trend panel. */
  trend: boolean;
}

export function classifyPresenceSize(width: number, height: number): PresenceView {
  const b = PRESENCE_BREAKPOINTS;
  if (height < b.miniHeight) return 'mini';
  if (width >= b.xsWidth) return 'standard';
  return height < b.xsMinHeight ? 'mini' : 'xs';
}

/** The view for a rendered size, keeping the previous one while the size is within the hysteresis band of it.
 * A zero size (not laid out yet, or hidden) keeps the previous view, or 'standard'. */
export function resolvePresenceView(
  width: number,
  height: number,
  previous: PresenceView | null = null,
): PresenceView {
  if (!(width > 0) || !(height > 0)) return previous ?? 'standard';
  const next = classifyPresenceSize(width, height);
  if (!previous || next === previous) return next;
  const h = PRESENCE_HYSTERESIS;
  for (const dw of [-h, 0, h]) {
    for (const dh of [-h, 0, h]) {
      if (classifyPresenceSize(width + dw, height + dh) === previous) return previous;
    }
  }
  return next;
}

function presenceColumns(bodyWidth: number): PresenceColumn[] {
  const columns: PresenceColumn[] = [];
  let used = PRESENCE_FIXED_COLUMNS_PX;
  for (const column of PRESENCE_COLUMN_ORDER) {
    if (column !== 'status' && used + PRESENCE_COLUMN_PX[column] > bodyWidth) break;
    columns.push(column);
    used += PRESENCE_COLUMN_PX[column];
  }
  return columns;
}

/** Rows that fit in `space` (gap, table head, rows, then "View all" when someone is left out). */
function fitRows(space: number, members: number, table: boolean): { rows: number; viewAll: boolean } {
  const s = PRESENCE_SECTION_PX;
  const rowPx = table ? s.tableRow : s.row;
  const lead = s.gap + (table ? s.tableHead : 0);
  const all = Math.floor((space - lead) / rowPx);
  if (all >= members) return { rows: Math.max(0, members), viewAll: false };
  const some = Math.floor((space - lead - s.viewAll) / rowPx);
  // Too short for a row and the link: the rows that fit, and the pill or a click opens everyone.
  return some > 0 ? { rows: some, viewAll: true } : { rows: Math.max(0, all), viewAll: false };
}

/** The xs head: the donut, its legend and the pill. */
const XS_HEAD_PX =
  DASHBOARD_DONUT_PX + PRESENCE_SECTION_PX.gap + PRESENCE_SECTION_PX.legend + PRESENCE_SECTION_PX.gap + PRESENCE_SECTION_PX.pill;

export const EMPTY_PRESENCE_PLAN: PresencePlan = {
  miniInline: false,
  pill: false,
  tiles: false,
  table: false,
  columns: [],
  rows: 0,
  viewAll: false,
  trend: false,
};

/**
 * The sections a view shows at a size. Standard: the KPI tiles, then at least three person rows, then the trend once
 * five rows fit with it, then every row of height left. Nothing is squeezed: a section that does not fit is left out.
 */
export function planPresenceLayout(view: PresenceView, width: number, height: number, members: number): PresencePlan {
  if (!(width > 0) || !(height > 0)) return EMPTY_PRESENCE_PLAN;
  const s = PRESENCE_SECTION_PX;
  const bodyWidth = width - PRESENCE_CARD_CHROME.width;
  const body = height - PRESENCE_CARD_CHROME.height;

  if (view === 'mini') {
    const miniInline = bodyWidth >= PRESENCE_BREAKPOINTS.miniInlineWidth;
    // The donut leaves room for the pill only on a card taller than a mini one usually is.
    const pill = miniInline || body >= DASHBOARD_DONUT_PX + s.gap + s.pill;
    return { ...EMPTY_PRESENCE_PLAN, miniInline, pill };
  }

  if (view === 'xs') {
    return { ...EMPTY_PRESENCE_PLAN, pill: true, ...fitRows(body - XS_HEAD_PX, members, false) };
  }

  const table = width >= PRESENCE_BREAKPOINTS.tableWidth;
  const rowPx = table ? s.tableRow : s.row;
  let rest = body - s.tiles;
  const fiveRows = Math.min(ROWS_BEFORE_TREND, members);
  const fiveRowsPx =
    s.gap + (table ? s.tableHead : 0) + fiveRows * rowPx + (members > ROWS_BEFORE_TREND ? s.viewAll : 0);
  const trend = fiveRows > 0 && fiveRowsPx + s.gap + s.trend <= rest;
  if (trend) rest -= s.gap + s.trend;
  return {
    ...EMPTY_PRESENCE_PLAN,
    tiles: true,
    table,
    columns: table ? presenceColumns(bodyWidth) : [],
    trend,
    ...fitRows(rest, members, table),
  };
}

/** The body height a plan's sections take; the card never takes more than its body. */
export function presenceBodyUsed(view: PresenceView, plan: PresencePlan): number {
  const s = PRESENCE_SECTION_PX;
  const rowPx = plan.table ? s.tableRow : s.row;
  const rows =
    plan.rows > 0 ? s.gap + (plan.table ? s.tableHead : 0) + plan.rows * rowPx + (plan.viewAll ? s.viewAll : 0) : 0;
  if (view === 'xs') return XS_HEAD_PX + rows;
  if (view === 'standard') return s.tiles + rows + (plan.trend ? s.gap + s.trend : 0);
  return 0;
}
