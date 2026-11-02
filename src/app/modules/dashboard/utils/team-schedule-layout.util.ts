import { DASHBOARD_DONUT_PX } from './dashboard-donut.util';

/** How the Today's team schedule card lays itself out at its rendered size. The detail dialog is the popup. */
export type ScheduleView = 'mini' | 'xs' | 'rows' | 'timeline';

/**
 * Size thresholds in CSS pixels, measured on the card host. The grid uses 96px rows with a 12px gap
 * (2 rows = 204px, 3 = 312, 4 = 420, 6 = 636, 8 = 852), and a column is about 97px wide at 1440px and 140px at 1920px.
 */
export const SCHEDULE_BREAKPOINTS = {
  /** Below this height only the mini view fits. */
  miniHeight: 260,
  /** Below this width a card shows the xs view: the donut over its legend, avatars, the pill, then rows. */
  xsWidth: 370,
  /** A narrow card needs this height for the xs head; shorter, it stays mini. */
  xsMinHeight: 412,
  /** From this body width a mini card swaps the donut for a stacked bar and legend. */
  miniInlineWidth: 320,
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
  pill: 36,
  avatars: 36,
  /** The xs legend under the donut: four items. */
  xsLegend: 96,
  /** The planner-off figure (team clocked total) that stands in for the donut. */
  total: 72,
  /** One person row (rows view, and every planner-off row). */
  row: 52,
  /** The timeline's hour header. */
  axis: 24,
  /** One timeline line. */
  line: 44,
  /** The legend under the timeline. */
  legend: 24,
  /** The day chart's title and summary tiles. */
  dayChartHead: 64,
  dayChartRow: 28,
  weekChart: 220,
  viewAll: 28,
  gap: 12,
} as const;

/** The side column's width (the timeline gives it up). */
export const SCHEDULE_SIDE_PX = 300;
/** The side column needs this body height: the summary donut, then unscheduled work and conflicts. */
const SIDE_MIN_BODY_PX = 420;
/** Rows that must fit before the day chart is worth its height. */
const ROWS_BEFORE_DAY_CHART = 5;

export interface SchedulePlan {
  miniInline: boolean;
  avatars: boolean;
  pill: boolean;
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
  miniInline: false,
  avatars: false,
  pill: false,
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

function xsHeadPx(plannerEnabled: boolean): number {
  const s = SCHEDULE_SECTION_PX;
  const figure = plannerEnabled ? DASHBOARD_DONUT_PX + s.gap + s.xsLegend : s.total;
  return figure + s.gap + s.avatars + s.gap + s.pill;
}

/** The rows section: the timeline's axis and legend, the rows, and "View all" when someone is left out. */
function rowsSectionPx(timeline: boolean, rows: number, viewAll: boolean): number {
  const s = SCHEDULE_SECTION_PX;
  return (timeline ? s.axis + s.legend : 0) + rows * (timeline ? s.line : s.row) + (viewAll ? s.viewAll : 0);
}

/** The most rows that fit in `space`, reserving "View all" when someone is left out. */
function fitRows(space: number, members: number, timeline: boolean): { rows: number; viewAll: boolean } {
  const rowPx = timeline ? SCHEDULE_SECTION_PX.line : SCHEDULE_SECTION_PX.row;
  const lead = rowsSectionPx(timeline, 0, false);
  const all = Math.floor((space - lead) / rowPx);
  if (all >= members) return { rows: Math.max(0, members), viewAll: false };
  const some = Math.floor((space - lead - SCHEDULE_SECTION_PX.viewAll) / rowPx);
  return some > 0 ? { rows: some, viewAll: true } : { rows: Math.max(0, all), viewAll: false };
}

/**
 * The sections a view shows at a size. Rows (or timeline lines) first, at least three; the daily planned-vs-actual
 * chart once five rows fit with it, one chart row per shown person; the side column on a wide, tall timeline; the week
 * chart at the maximum size; then every row of height left. With the Planner off: rows only.
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

  if (view === 'mini') {
    const miniInline = width - SCHEDULE_CARD_CHROME.width >= b.miniInlineWidth;
    return { ...EMPTY_SCHEDULE_PLAN, miniInline, pill: miniInline || body >= DASHBOARD_DONUT_PX + s.gap + s.pill };
  }
  if (view === 'xs') {
    const fit = fitRows(body - xsHeadPx(plannerEnabled) - s.gap, members, false);
    return { ...EMPTY_SCHEDULE_PLAN, avatars: true, pill: true, ...fit };
  }

  const timeline = view === 'timeline' && plannerEnabled;
  const rowPx = timeline ? s.line : s.row;
  const minRows = Math.min(3, members);
  const weekChart =
    timeline &&
    width >= b.weekWidth &&
    height >= b.weekHeight &&
    rowsSectionPx(timeline, minRows, members > minRows) + s.gap + s.weekChart <= body;
  const side = timeline && width >= b.sideWidth && body >= SIDE_MIN_BODY_PX;
  const total = body - (weekChart ? s.gap + s.weekChart : 0);

  const five = Math.min(ROWS_BEFORE_DAY_CHART, members);
  const dayChart =
    plannerEnabled &&
    five > 0 &&
    rowsSectionPx(timeline, five, members > five) + s.gap + s.dayChartHead + five * s.dayChartRow <= total;

  const plan: SchedulePlan = { ...EMPTY_SCHEDULE_PLAN, blockLabels: timeline, side, weekChart };
  if (!dayChart) return { ...plan, ...fitRows(total, members, timeline) };

  // One chart row per shown person, then any height left goes to more rows.
  const avail = total - s.gap - s.dayChartHead;
  const lead = rowsSectionPx(timeline, 0, false);
  let pairs = Math.min(members, Math.floor((avail - lead) / (rowPx + s.dayChartRow)));
  if (pairs < members) pairs = Math.floor((avail - lead - s.viewAll) / (rowPx + s.dayChartRow));
  const hidden = pairs < members;
  const rest = avail - rowsSectionPx(timeline, pairs, hidden) - pairs * s.dayChartRow;
  const shown = pairs + Math.min(members - pairs, Math.floor(rest / rowPx));
  return { ...plan, rows: shown, viewAll: shown < members, dayChartRows: pairs };
}

/** The body height a plan's sections take; the card never takes more than its body. */
export function scheduleBodyUsed(view: ScheduleView, plan: SchedulePlan, plannerEnabled: boolean): number {
  const s = SCHEDULE_SECTION_PX;
  if (view === 'mini') return 0;
  if (view === 'xs') {
    const rows = plan.rows > 0 ? s.gap + rowsSectionPx(false, plan.rows, plan.viewAll) : 0;
    return xsHeadPx(plannerEnabled) + rows;
  }
  const timeline = view === 'timeline' && plannerEnabled;
  return (
    rowsSectionPx(timeline, plan.rows, plan.viewAll) +
    (plan.dayChartRows > 0 ? s.gap + s.dayChartHead + plan.dayChartRows * s.dayChartRow : 0) +
    (plan.weekChart ? s.gap + s.weekChart : 0)
  );
}
