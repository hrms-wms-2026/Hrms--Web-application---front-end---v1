import { describe, expect, it } from 'vitest';
import { planForecastLayout, resolveForecastView } from './overtime-forecast-layout.util';

describe('overtime-forecast-layout', () => {
  it('picks mini, xs or standard from the rendered size, with hysteresis', () => {
    expect(resolveForecastView(206, 204)).toBe('mini');
    expect(resolveForecastView(315, 420)).toBe('xs');
    expect(resolveForecastView(760, 420)).toBe('standard');
    expect(resolveForecastView(0, 0)).toBe('standard');
    expect(resolveForecastView(0, 0, 'xs')).toBe('xs');
    expect(resolveForecastView(335, 420, 'xs')).toBe('xs');
    expect(resolveForecastView(400, 420, 'xs')).toBe('standard');
  });

  it('adds tiles, then the chart, then ranking rows as the card grows taller', () => {
    expect(planForecastLayout('mini', 760, 204).tiles).toBe(false);
    expect(planForecastLayout('standard', 760, 312).tiles).toBe(true);
    expect(planForecastLayout('standard', 760, 290).tiles).toBe(false);
    const four = planForecastLayout('standard', 760, 420);
    expect([four.tiles, four.chart, four.rankingRows]).toEqual([true, false, 0]);
    const five = planForecastLayout('standard', 760, 528);
    expect([five.tiles, five.chart, five.rankingRows]).toEqual([true, true, 0]);
    expect(planForecastLayout('standard', 760, 744).rankingRows).toBeGreaterThanOrEqual(3);
    expect(planForecastLayout('standard', 760, 2000).rankingRows).toBe(10);
  });

  it('a very wide card puts the chart in the hero row', () => {
    const plan = planForecastLayout('standard', 1200, 420);
    expect([plan.heroChart, plan.chart]).toEqual([true, false]);
  });

  it('xs shows the legend, then the figure, under the donut', () => {
    expect(planForecastLayout('xs', 300, 312).legend).toBe(false);
    const tall = planForecastLayout('xs', 300, 420);
    expect([tall.legend, tall.figure]).toEqual([true, true]);
  });

  it('budgets a taller summary-cards row in the tiles place when asked', () => {
    expect(planForecastLayout('standard', 760, 420, 140).tiles).toBe(true);
    const withCards = planForecastLayout('standard', 760, 528, 140);
    expect([withCards.tiles, withCards.chart]).toEqual([true, false]);
  });

  it('gives the chart the height the ranking cannot use, so the card never ends in blank space', () => {
    // 6 x 6 at 1440px: the cards row and the chart leave 86px, too little for three ranking rows.
    const six = planForecastLayout('standard', 642, 636, 140);
    expect([six.chart, six.rankingRows, six.chartPx]).toEqual([true, 0, 236]);
    // Tall, with only one module at risk: three rows are kept (room for the list), the rest goes to the chart.
    const tall = planForecastLayout('standard', 760, 1000, undefined, 1);
    expect(tall.rankingRows).toBe(3);
    expect(tall.chartPx).toBe(150 + (1000 - 68 - 168 - 64 - 162 - 36 - 3 * 40));
    // Enough rows of data: the ranking takes the height and the chart keeps its 150px plus the remainder.
    const full = planForecastLayout('standard', 760, 1000);
    expect(full.rankingRows).toBe(10);
    expect(full.chartPx).toBe(150 + (1000 - 68 - 168 - 64 - 162 - 36 - 10 * 40));
  });
});
