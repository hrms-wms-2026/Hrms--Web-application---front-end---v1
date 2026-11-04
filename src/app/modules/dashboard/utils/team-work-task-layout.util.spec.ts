import { describe, expect, it } from 'vitest';
import { planTeamWorkTaskLayout, resolveTeamWorkTaskView } from './team-work-task-layout.util';

describe('team-work-task-layout', () => {
  it('picks mini, xs or standard from the rendered size', () => {
    expect(resolveTeamWorkTaskView(206, 204)).toBe('mini');
    expect(resolveTeamWorkTaskView(315, 420)).toBe('xs');
    expect(resolveTeamWorkTaskView(760, 420)).toBe('standard');
    expect(resolveTeamWorkTaskView(0, 0, 'xs')).toBe('xs');
  });

  it('keeps the previous view inside the hysteresis band', () => {
    expect(resolveTeamWorkTaskView(335, 420, 'xs')).toBe('xs');
    expect(resolveTeamWorkTaskView(400, 420, 'xs')).toBe('standard');
  });

  it('adds tiles, then the chart, then ranking rows as the card grows taller', () => {
    expect(planTeamWorkTaskLayout('mini', 760, 204).tiles).toBe(false);
    const three = planTeamWorkTaskLayout('standard', 760, 312);
    expect([three.tiles, three.trend, three.rankingRows]).toEqual([true, false, 0]);
    const five = planTeamWorkTaskLayout('standard', 760, 528);
    expect([five.tiles, five.trend, five.rankingRows]).toEqual([true, true, 0]);
    const six = planTeamWorkTaskLayout('standard', 760, 636);
    expect(six.rankingRows).toBeGreaterThanOrEqual(3);
    expect(planTeamWorkTaskLayout('standard', 760, 2000).rankingRows).toBe(10);
  });

  it('a very wide card puts the chart in the hero row', () => {
    const plan = planTeamWorkTaskLayout('standard', 1200, 420);
    expect([plan.heroTrend, plan.trend]).toEqual([true, false]);
  });

  it('xs shows the legend, then the figure, under the donut', () => {
    expect(planTeamWorkTaskLayout('xs', 300, 312).legend).toBe(true);
    const tall = planTeamWorkTaskLayout('xs', 300, 420);
    expect([tall.legend, tall.figure]).toEqual([true, true]);
  });
});
