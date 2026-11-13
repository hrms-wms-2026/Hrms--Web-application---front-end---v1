import { describe, expect, it } from 'vitest';
import { EMPTY_FORECAST_PLAN } from './overtime-forecast-layout.util';
import {
  moduleForecastExplanation,
  moduleForecastTiles,
  moduleRowRateText,
  modulesAtRisk,
} from './team-module-forecast-format.util';
import { planForecastLayout } from './overtime-forecast-layout.util';
import {
  MODULE_FORECAST_NARROW_CHART_EXTRA_PX,
  planModuleForecastLayout,
  shownModuleForecastCards,
} from './team-module-forecast-layout.util';
import { teamModuleForecastSummaryCards } from './team-module-forecast-summary-cards.util';
import { MODULE_FORECAST_ITEMS, moduleForecastResponse } from './team-module-forecast.testing';

describe('team-module-forecast utils', () => {
  it('ranks the modules at risk by overtime', () => {
    expect(modulesAtRisk(MODULE_FORECAST_ITEMS).map((m) => m.title)).toEqual([
      'Billing',
      'Search',
      'Reports',
    ]);
  });

  it('builds the four card tiles', () => {
    const tiles = moduleForecastTiles(moduleForecastResponse().totals);
    expect(tiles.map((t) => [t.label, t.value])).toEqual([
      ['Allocated', '2,400 h'],
      ['Predicted', '1,100 h'],
      ['Task rate', '42%'],
      ["Won't fit", '950 h'],
    ]);
  });

  it('explains the pie in plain words', () => {
    const t = moduleForecastResponse().totals;
    const text = moduleForecastExplanation(t);
    expect(text).toContain(
      "Of 1,500 h still to do, the team's 42% task rate (last 4 weeks) completes about 1,100 h",
    );
    expect(text).toContain('58% is needed');
    expect(text).toContain("~950 h won't fit at today's rate.");
    expect(moduleForecastExplanation({ ...t, teamRate: null })).toContain(
      'Nobody on these milestones clocked',
    );
    expect(moduleForecastExplanation({ ...t, remainingHours: 0 })).toBe(
      'All 5 milestones have their allocated hours completed.',
    );
    expect(moduleForecastExplanation({ ...t, modules: 0 })).toBe(
      'No open milestones with a deadline ahead.',
    );
  });

  it('summarises four popup sections', () => {
    const cards = teamModuleForecastSummaryCards(moduleForecastResponse());
    expect(cards.map((c) => [c.id, c.section])).toEqual([
      ['mf-rate', 'summary'],
      ['mf-overtime', 'projects'],
      ['mf-risk', 'modules'],
      ['mf-status', 'modules'],
    ]);
    const rate = cards[0].body;
    expect(rate?.kind === 'spark' && rate.figure).toBe('42%');
    expect(rate?.kind === 'spark' && rate.points).toEqual([31, 38, 45, 42]);
    expect(rate?.kind === 'spark' && rate.delta?.text).toBe('−16.0 pp');
    const risk = cards[2].body;
    expect(risk?.kind === 'rank' && risk.rows.map((r) => r.chips[0].text)).toEqual([
      '⚠ 42% → 120%',
      '42% → 83%',
      '42% → 83%',
    ]);
    const status = cards[3].body;
    expect(status?.kind === 'chips' && status.items.map((i) => i.value)).toEqual([1, 2, 1, 1]);
  });

  it('a card shows no overtime figure when nothing is short', () => {
    const data = moduleForecastResponse();
    const cards = teamModuleForecastSummaryCards({
      ...data,
      totals: { ...data.totals, overtimeHours: 0, teamRate: null },
    });
    expect(cards[1].body?.kind === 'bars' && cards[1].body.figure).toBe('None');
    expect(cards[0].body?.kind === 'spark' && cards[0].body.delta).toBeNull();
  });

  it('a narrow card gives the chart extra height and the xs caption its second line', () => {
    // ~230px body, 8 rows tall: the chart panel is taller than the shared 150px and every section still fits.
    const narrow = planModuleForecastLayout('xs', 262, 852);
    expect(narrow.chart).toBe(true);
    expect(narrow.chartPx).toBeGreaterThanOrEqual(150 + MODULE_FORECAST_NARROW_CHART_EXTRA_PX);
    const shared = planForecastLayout('xs', 262, 852);
    expect(narrow.rankingRows).toBeLessThanOrEqual(shared.rankingRows);
    // A wide card keeps the shared plan.
    expect(planModuleForecastLayout('standard', 760, 860)).toEqual(
      planForecastLayout('standard', 760, 860),
    );
  });

  it('knows which cards a view already shows', () => {
    expect([...shownModuleForecastCards('xs', EMPTY_FORECAST_PLAN)]).toEqual([]);
    expect([
      ...shownModuleForecastCards('standard', {
        ...EMPTY_FORECAST_PLAN,
        chart: true,
        rankingRows: 3,
      }),
    ]).toEqual(['mf-rate', 'mf-overtime', 'mf-risk']);
  });

  it('an overload row names its own legal entity limit, else the response limit', () => {
    const t = moduleForecastResponse().totals;
    const billing = MODULE_FORECAST_ITEMS[0];
    expect(moduleRowRateText(billing, t)).toBe('42% → needs 120%, limit 90%');
    expect(moduleRowRateText({ ...billing, requiredRate: 0.96, maxTaskRate: 0.85 }, t, true)).toBe(
      '42% → 96% · limit 85%',
    );
    expect(moduleRowRateText(MODULE_FORECAST_ITEMS[1], t)).toBe('42% → needs 83%');
  });
});
