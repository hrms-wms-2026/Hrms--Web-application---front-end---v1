import { FORECAST_STATUSES } from '../models/overtime-forecast.model';
import { SummaryCardModel, SummaryRankRow } from '../models/summary-card.model';
import { ModuleForecastResponse } from '../models/team-module-forecast.model';
import {
  FORECAST_STATUS_META,
  FORECAST_STATUS_TONE,
  forecastHoursText,
  overtimeChipText,
  rateText,
} from './overtime-forecast-format.util';
import { summaryDelta } from './summary-card-format.util';
import { SUMMARY_CARD_ROWS } from './team-attendance-summary-cards.util';
import { modulesAtRisk } from './team-module-forecast-format.util';

const STATUS_COUNT = {
  on_track: 'onTrack',
  raise_rate: 'raiseRate',
  overtime: 'overtime',
  no_history: 'noHistory',
} as const;

/**
 * Module overtime forecast's summary cards (design 2026-11-08), from the response the card already loads: the task
 * rate trend (the popup's KPI row), overtime by project (the project chart), the modules at risk and the status split
 * (the module table).
 */
export function teamModuleForecastSummaryCards(data: ModuleForecastResponse): SummaryCardModel[] {
  const t = data.totals;
  const risk: SummaryRankRow[] = modulesAtRisk(data.items)
    .slice(0, SUMMARY_CARD_ROWS)
    .map((m) => ({
      id: m.moduleId,
      name: m.title,
      avatarFileId: null,
      chips: [
        { text: overtimeChipText(m.overtimeHours, m.status), tone: FORECAST_STATUS_TONE[m.status] },
      ],
    }));
  const gap =
    t.teamRate === null || t.requiredRate === null ? null : (t.teamRate - t.requiredRate) * 100;

  return [
    {
      id: 'mf-rate',
      title: 'Task rate',
      icon: 'pie-chart',
      tone: 'var(--color-cat-blue)',
      section: 'summary',
      state: 'ready',
      body: {
        kind: 'spark',
        figure: rateText(t.teamRate),
        delta:
          gap === null
            ? null
            : summaryDelta(gap, 'pp', true, `vs ${rateText(t.requiredRate)} needed`),
        points: data.rateTrend.map((p) =>
          p.rate === null ? null : Math.round(p.rate * 1000) / 10,
        ),
      },
    },
    {
      id: 'mf-overtime',
      title: 'Overtime needed',
      icon: 'clock',
      tone: 'var(--color-cat-red)',
      section: 'projects',
      state: 'ready',
      body: {
        kind: 'bars',
        figure: t.overtimeHours > 0 ? `~${forecastHoursText(t.overtimeHours)}` : 'None',
        delta: null,
        values: data.projects.map((p) => Math.round(p.overtimeHours)),
      },
    },
    {
      id: 'mf-risk',
      title: 'Modules at risk',
      icon: 'alert-triangle',
      tone: 'var(--color-cat-amber)',
      section: 'modules',
      state: 'ready',
      body: {
        kind: 'rank',
        count: String(t.raiseRate + t.overtime),
        countLabel: 'at risk',
        rows: risk,
        empty: 'Every module is on track',
      },
    },
    {
      id: 'mf-status',
      title: 'By status',
      icon: 'layers',
      tone: 'var(--color-cat-teal)',
      section: 'modules',
      state: 'ready',
      body: {
        kind: 'chips',
        count: String(t.modules),
        countLabel: 'modules',
        items: FORECAST_STATUSES.map((s) => ({
          label: FORECAST_STATUS_META[s].label,
          value: t[STATUS_COUNT[s]],
          tone: FORECAST_STATUS_TONE[s],
        })),
      },
    },
  ];
}
