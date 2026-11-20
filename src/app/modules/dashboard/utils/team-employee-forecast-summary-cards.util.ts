import { FORECAST_STATUSES } from '../models/overtime-forecast.model';
import { SummaryCardModel, SummaryRankRow } from '../models/summary-card.model';
import { EmployeeForecastResponse } from '../models/team-employee-forecast.model';
import {
  FORECAST_STATUS_META,
  FORECAST_STATUS_TONE,
  shortHoursText,
  forecastRankChip,
  rateText,
} from './overtime-forecast-format.util';
import { summaryDelta } from './summary-card-format.util';
import { SUMMARY_CARD_ROWS } from './team-attendance-summary-cards.util';
import { peopleAtRisk } from './team-employee-forecast-format.util';

const STATUS_COUNT = {
  on_track: 'onTrack',
  raise_rate: 'raiseRate',
  overload: 'overload',
  no_history: 'noHistory',
} as const;
/** The overtime card's bars: the people who need the most. */
const OVERTIME_BARS = 8;

/**
 * Employee overtime forecast's summary cards (design 2026-11-08), from the response the card already loads: the team
 * task rate trend (KPI row), overtime per person (the rate chart), the people at risk and the status split (the table).
 */
export function teamEmployeeForecastSummaryCards(
  data: EmployeeForecastResponse,
): SummaryCardModel[] {
  const t = data.totals;
  const risk = peopleAtRisk(data.items);
  const rows: SummaryRankRow[] = risk.slice(0, SUMMARY_CARD_ROWS).map((e) => ({
    id: e.employeeId,
    name: e.name,
    avatarFileId: e.avatarFileId,
    chips: [forecastRankChip(e.conversionRate, e.requiredRate, e.status)],
  }));
  const gap =
    t.teamRate == null || t.requiredRate == null ? null : (t.teamRate - t.requiredRate) * 100;

  return [
    {
      id: 'ef-rate',
      title: 'Team task rate',
      icon: 'pie-chart',
      tone: 'var(--color-widget-shade-2)',
      section: 'summary',
      state: 'ready',
      body: {
        kind: 'spark',
        figure: rateText(t.teamRate),
        delta:
          gap == null
            ? null
            : summaryDelta(gap, 'pp', true, `vs ${rateText(t.requiredRate)} needed`),
        points: data.rateTrend.map((p) =>
          p.rate == null ? null : Math.round(p.rate * 1000) / 10,
        ),
      },
    },
    {
      id: 'ef-overtime',
      title: "Won't fit",
      icon: 'clock',
      tone: 'var(--color-widget-maroon)',
      section: 'rates',
      state: 'ready',
      body: {
        kind: 'bars',
        figure: t.overtimeHours > 0 ? shortHoursText(t.overtimeHours) : 'None',
        delta: null,
        values: risk.slice(0, OVERTIME_BARS).map((e) => Math.round(e.overtimeHours)),
      },
    },
    {
      id: 'ef-risk',
      title: 'People at risk',
      icon: 'users',
      tone: 'var(--color-widget-shade-3)',
      section: 'employees',
      state: 'ready',
      body: {
        kind: 'rank',
        count: String(t.raiseRate + t.overload),
        countLabel: 'at risk',
        rows,
        empty: 'Everyone is on track',
      },
    },
    {
      id: 'ef-status',
      title: 'By status',
      icon: 'layers',
      tone: 'var(--color-widget-shade-3b)',
      section: 'employees',
      state: 'ready',
      body: {
        kind: 'chips',
        count: String(t.people),
        countLabel: 'people',
        items: FORECAST_STATUSES.map((s) => ({
          label: FORECAST_STATUS_META[s].label,
          value: t[STATUS_COUNT[s]],
          tone: FORECAST_STATUS_TONE[s],
        })),
      },
    },
  ];
}
