import { DASHBOARD_DONUT_LEGEND_ROW_PX, DASHBOARD_DONUT_PX } from '../../../shared/ui/charts/utils/dashboard-donut.util';

/** How the Today's team schedule card lays itself out at its rendered size. The detail dialog is the popup. */
export type ScheduleView = 'mini' | 'xs' | 'rows' | 'timeline';

/**
 * Size thresholds in CSS pixels, measured on the card host. The grid uses 96px rows with a 12px gap
 * (2 rows = 204px, 3 = 312, 4 = 420, 6 = 636, 8 = 852), and a column is about 97px wide at 1440px and 140px at 1920px.
 */
export const SCHEDULE_BREAKPOINTS = {
  /** Below this height only the mini view fits: the item count, a stacked bar and the status chips. */
  miniHeight: 260,
  /** Below this width a card shows the xs view: the donut over its legend, the chips, then rows. */
  xsWidth: 370,
  /** A narrow card needs this height for the xs head (donut, legend, chips: 4 grid rows have it); shorter, it stays mini. */
  xsMinHeight: 380,
  /** From this card width the rows become a labelled timeline. */
  timelineWidth: 640,
  /** From this card width (and enough height) a side column holds the summary, unscheduled work and conflicts. */
  sideWidth: 1150,
  /** The week chart needs the maximum size: this width and height. */
  weekWidth: 1150,
  weekHeight: 800,
} as const;

/** How far past a threshold the size must move before the view changes back. */
export const SCHEDULE_HYSTERESIS = 20;

/** Card padding plus its title header: the host size minus this is the body. */
export const SCHEDULE_CARD_CHROME = { width: 32, height: 68 } as const;

/** Fixed heights the plan budgets with (they match the card's CSS). */
export const SCHEDULE_SECTION_PX = {
  /** The row of status chips (over capacity, not planned, on leave). */
  chips: 28,
  /** The xs legend under the donut: four rows. */
  xsLegend: 4 * DASHBOARD_DONUT_LEGEND_ROW_PX,
  /** The planner-off figure (team clocked total) that stands in for the donut. */
  total: 72,
  /** The timeline head: the donut panel (donut plus padding) beside the status tiles. */
  head: DASHBOARD_DONUT_PX + 20,
  /** One person row (rows and xs views, and every planner-off row). */
  row: 48,
  /** The timeline's column header (Team member, Status, hours, Done). */
  axis: 32,
  /** One timeline line. */
  line: 52,
  /** The legend (and "View all") under the timeline. */
  legend: 28,
  /** The day chart's title and summary tiles. */
  dayChartHead: 64,
  dayChartRow: 28,
  weekChart: 220,
  viewAll: 28,
  gap: 12,
} as const;

/** The side column's width (the timeline gives it up). */
export const SCHEDULE_SIDE_PX = 300;
/** The side column needs this body height: the summary list, then unscheduled work and conflicts. */
const SIDE_MIN_BODY_PX = 420;
/** Rows that must fit before the day chart is worth its height. */
const ROWS_BEFORE_DAY_CHART = 5;
/** Timeline lines that must fit under the head before the head is worth its height. */
const LINES_UNDER_HEAD = 2;

export interface SchedulePlan {
  /** The status chips (mini, xs, rows). */
  chips: boolean;
  /** Timeline: the donut panel and status tiles above the lines. */
  head: boolean;
  /** Rows (rows view) or timeline lines (timeline view). */
  rows: number;
  /** "View all N ›", reserved only while rows hide someone. */
  viewAll: boolean;
  /** Timeline: label blocks at least 48px wide. */
  blockLabels: boolean;
  /** Daily planned-vs-actual chart rows; 0 hides it. */
  dayChartRows: number;
  /** The right-hand summary / unscheduled / conflicts column. */
  side: boolean;
  /** Maximum size only. */
  weekChart: boolean;
}

export const EMPTY_SCHEDULE_PLAN: SchedulePlan = {
  chips: false,
  head: false,
  rows: 0,
  viewAll: false,
  blockLabels: false,
  dayChartRows: 0,
  side: false,
  weekChart: false,
};

export function classifyScheduleSize(width: number, height: number): ScheduleView {
  const b = SCHEDULE_BREAKPOINTS;
  if (height < b.miniHeight) return 'mini';
  if (width < b.xsWidth) return height < b.xsMinHeight ? 'mini' : 'xs';
  return width < b.timelineWidth ? 'rows' : 'timeline';
}

/** The view for a rendered size, keeping the previous one inside the hysteresis band; a zero size keeps it too. */
export function resolveScheduleView(
  width: number,
  height: number,
  previous: ScheduleView | null = null,
): ScheduleView {
  if (!(width > 0) || !(height > 0)) return previous ?? 'rows';
  const next = classifyScheduleSize(width, height);
  if (!previous || next === previous) return next;
  const h = SCHEDULE_HYSTERESIS;
  for (const dw of [-h, 0, h]) {
    for (const dh of [-h, 0, h]) {
      if (classifyScheduleSize(width + dw, height + dh) === previous) return previous;
    }
  }
  return next;
}

/** The view the template draws: with the Planner off there is no timeline, only clocked-vs-expected rows. */
export function drawnScheduleView(view: ScheduleView, plannerEnabled: boolean): ScheduleView {
  return view === 'timeline' && !plannerEnabled ? 'rows' : view;
}

/** The list head: the donut over its legend (xs) or beside it (rows), or the clocked total; then the chips. */
function listHeadPx(view: ScheduleView, plannerEnabled: boolean): number {
  const s = SCHEDULE_SECTION_PX;
  const figure = !plannerEnabled ? s.total : view === 'xs' ? DASHBOARD_DONUT_PX + s.gap + s.xsLegend : DASHBOARD_DONUT_PX;
  return figure + s.gap + s.chips;
}

/** The rows section: the timeline's header and legend, the rows, and "View all" when someone is left out (the
 * timeline puts it in its legend row). */
function rowsSectionPx(timeline: boolean, rows: number, viewAll: boolean): number {
  const s = SCHEDULE_SECTION_PX;
  if (timeline) return s.axis + s.legend + rows * s.line;
  return rows * s.row + (viewAll ? s.viewAll : 0);
}

/** The most rows that fit in `space`, reserving "View all" when someone is left out. */
function fitRows(space: number, members: number, timeline: boolean): { rows: number; viewAll: boolean } {
  const rowPx = timeline ? SCHEDULE_SECTION_PX.line : SCHEDULE_SECTION_PX.row;
  const lead = rowsSectionPx(timeline, 0, false);
  const all = Math.floor((space - lead) / rowPx);
  if (all >= members) return { rows: Math.max(0, members), viewAll: false };
  const some = Math.floor((space - rowsSectionPx(timeline, 0, true)) / rowPx);
  return some > 0 ? { rows: some, viewAll: true } : { rows: Math.max(0, all), viewAll: false };
}

/**
 * The sections a view shows at a size. Mini: the count, bar and chips. Xs / rows: the donut head and chips, then rows.
 * Timeline: the donut head once two lines fit under it, the lines, the daily planned-vs-actual chart once five lines
 * fit with it (one chart row per shown person), the side column on a wide, tall card and the week chart at the
 * maximum size; then every line of height left. With the Planner off: rows only.
 */
export function planScheduleLayout(
  view: ScheduleView,
  width: number,
  height: number,
  members: number,
  plannerEnabled: boolean,
): SchedulePlan {
  if (!(width > 0) || !(height > 0)) return EMPTY_SCHEDULE_PLAN;
  const s = SCHEDULE_SECTION_PX;
  const b = SCHEDULE_BREAKPOINTS;
  const body = height - SCHEDULE_CARD_CHROME.height;

  if (view === 'mini') return { ...EMPTY_SCHEDULE_PLAN, chips: true };

  const timeline = view === 'timeline' && plannerEnabled;
  if (!timeline) {
    const rest = body - listHeadPx(view, plannerEnabled) - s.gap;
    return { ...EMPTY_SCHEDULE_PLAN, chips: true, ...fitRows(rest, members, false) };
  }

  const minLines = Math.min(LINES_UNDER_HEAD, members);
  const head = s.head + s.gap + rowsSectionPx(true, minLines, false) <= body;
  const afterHead = body - (head ? s.head + s.gap : 0);
  const minRows = Math.min(3, members);
  const weekChart =
    width >= b.weekWidth &&
    height >= b.weekHeight &&
    rowsSectionPx(true, minRows, false) + s.gap + s.weekChart <= afterHead;
  const side = width >= b.sideWidth && body >= SIDE_MIN_BODY_PX;
  const total = afterHead - (weekChart ? s.gap + s.weekChart : 0);

  const five = Math.min(ROWS_BEFORE_DAY_CHART, members);
  const dayChart = five > 0 && rowsSectionPx(true, five, false) + s.gap + s.dayChartHead + five * s.dayChartRow <= total;

  const plan: SchedulePlan = { ...EMPTY_SCHEDULE_PLAN, head, blockLabels: true, side, weekChart };
  if (!dayChart) return { ...plan, ...fitRows(total, members, true) };

  // One chart row per shown person, then any height left goes to more lines.
  const avail = total - s.gap - s.dayChartHead;
  const lead = rowsSectionPx(true, 0, false);
  const pairs = Math.min(members, Math.floor((avail - lead) / (s.line + s.dayChartRow)));
  const rest = avail - rowsSectionPx(true, pairs, false) - pairs * s.dayChartRow;
  const shown = pairs + Math.min(members - pairs, Math.floor(rest / s.line));
  return { ...plan, rows: shown, viewAll: shown < members, dayChartRows: pairs };
}

/** The body height a plan's sections take; the card never takes more than its body. */
export function scheduleBodyUsed(view: ScheduleView, plan: SchedulePlan, plannerEnabled: boolean): number {
  const s = SCHEDULE_SECTION_PX;
  if (view === 'mini') return 0;
  const timeline = view === 'timeline' && plannerEnabled;
  if (!timeline) {
    const rows = plan.rows > 0 ? s.gap + rowsSectionPx(false, plan.rows, plan.viewAll) : 0;
    return listHeadPx(view, plannerEnabled) + rows;
  }
  return (
    (plan.head ? s.head + s.gap : 0) +
    rowsSectionPx(true, plan.rows, plan.viewAll) +
    (plan.dayChartRows > 0 ? s.gap + s.dayChartHead + plan.dayChartRows * s.dayChartRow : 0) +
    (plan.weekChart ? s.gap + s.weekChart : 0)
  );
}
