import { describe, expect, it } from 'vitest';
import { EMPTY_FORECAST_PLAN } from './overtime-forecast-layout.util';
import {
  employeeForecastExplanation,
  employeeForecastTiles,
  peopleAtRisk,
} from './team-employee-forecast-format.util';
import { shownEmployeeForecastCards } from './team-employee-forecast-layout.util';
import { teamEmployeeForecastSummaryCards } from './team-employee-forecast-summary-cards.util';
import {
  EMPLOYEE_FORECAST_ITEMS,
  employeeForecastResponse,
} from './team-employee-forecast.testing';

describe('team-employee-forecast utils', () => {
  it('ranks the people at risk by overtime', () => {
    expect(peopleAtRisk(EMPLOYEE_FORECAST_ITEMS).map((e) => e.name)).toEqual(['Ann', 'Bob', 'Cat']);
  });

  it('builds the four card tiles', () => {
    const tiles = employeeForecastTiles(employeeForecastResponse().totals);
    expect(tiles.map((t) => [t.label, t.value])).toEqual([
      ['Remaining', '250 h'],
      ['Predicted', '140 h'],
      ['Task rate', '40%'],
      ['Overtime h', '57 h'],
    ]);
  });

  it('explains the pie in plain words', () => {
    const t = employeeForecastResponse().totals;
    expect(employeeForecastExplanation(t)).toContain(
      "Of 250 h of open tasks due, each person's own task rate (team 40%, last 4 weeks) completes about 140 h",
    );
    expect(employeeForecastExplanation(t)).toContain('~57 h of overtime across 3 people');
    expect(employeeForecastExplanation({ ...t, teamRate: null })).toContain(
      'Nobody clocked working time',
    );
    expect(employeeForecastExplanation({ ...t, remainingHours: 0 })).toContain(
      'Nobody has open estimated tasks',
    );
    expect(employeeForecastExplanation({ ...t, people: 0 })).toBe('No one in your team yet.');
  });

  it('summarises four popup sections', () => {
    const cards = teamEmployeeForecastSummaryCards(employeeForecastResponse());
    expect(cards.map((c) => [c.id, c.section])).toEqual([
      ['ef-rate', 'summary'],
      ['ef-overtime', 'rates'],
      ['ef-risk', 'employees'],
      ['ef-status', 'employees'],
    ]);
    const rate = cards[0].body;
    expect(rate?.kind === 'spark' && rate.points).toEqual([30, 35, null, 40]);
    expect(rate?.kind === 'spark' && rate.delta?.text).toBe('−15.0 pp');
    const overtime = cards[1].body;
    expect(overtime?.kind === 'bars' && overtime.values).toEqual([40, 13, 4]);
    const risk = cards[2].body;
    expect(risk?.kind === 'rank' && risk.rows.map((r) => r.chips[0].text)).toEqual([
      '~40 h',
      '~13 h',
      '~4 h',
    ]);
  });

  it('knows which cards a view already shows', () => {
    expect([...shownEmployeeForecastCards('xs', { ...EMPTY_FORECAST_PLAN, figure: true })]).toEqual(
      ['ef-rate'],
    );
    expect([
      ...shownEmployeeForecastCards('standard', {
        ...EMPTY_FORECAST_PLAN,
        heroChart: true,
        rankingRows: 4,
      }),
    ]).toEqual(['ef-rate', 'ef-overtime', 'ef-risk']);
  });
});
