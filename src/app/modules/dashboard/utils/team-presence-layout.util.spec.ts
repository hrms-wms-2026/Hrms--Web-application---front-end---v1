import { describe, expect, it } from 'vitest';
import {
  PRESENCE_BREAKPOINTS,
  PRESENCE_CARD_CHROME,
  PRESENCE_HYSTERESIS,
  PRESENCE_SECTION_PX,
  PresencePlan,
  PresenceView,
  classifyPresenceSize,
  planPresenceLayout,
  presenceBodyUsed,
  resolvePresenceView,
} from './team-presence-layout.util';

describe('presence layout ladder', () => {
  const b = PRESENCE_BREAKPOINTS;

  it('classifies mini by height, xs by width, standard otherwise', () => {
    expect(classifyPresenceSize(1200, b.miniHeight - 1)).toBe('mini');
    expect(classifyPresenceSize(204, 204)).toBe('mini');
    expect(classifyPresenceSize(b.xsWidth - 1, b.xsMinHeight)).toBe('xs');
    // Narrow and too short for the donut, its legend and the pill: drops a step to mini.
    expect(classifyPresenceSize(b.xsWidth - 1, b.xsMinHeight - 1)).toBe('mini');
    expect(classifyPresenceSize(300, 636)).toBe('xs');
    expect(classifyPresenceSize(b.xsWidth, b.miniHeight)).toBe('standard');
    expect(classifyPresenceSize(600, 420)).toBe('standard');
  });

  it('keeps the previous view within the hysteresis band and changes past it', () => {
    const h = PRESENCE_HYSTERESIS;
    expect(resolvePresenceView(600, b.miniHeight - h, 'standard')).toBe('standard');
    expect(resolvePresenceView(600, b.miniHeight - h - 1, 'standard')).toBe('mini');
    expect(resolvePresenceView(b.xsWidth + h - 1, 420, 'xs')).toBe('xs');
    expect(resolvePresenceView(b.xsWidth + h + 1, 420, 'xs')).toBe('standard');
  });

  it('0x0 keeps the previous view, or standard', () => {
    expect(resolvePresenceView(0, 0, null)).toBe('standard');
    expect(resolvePresenceView(0, 0, 'mini')).toBe('mini');
  });

  it('mini: the inline bar and its pill from the wide body width', () => {
    // 2x2: the 140px donut fills the body, so the pill waits for a wider (inline) card.
    expect(planPresenceLayout('mini', 204, 204, 12)).toMatchObject({ miniInline: false, pill: false, rows: 0, tiles: false });
    expect(planPresenceLayout('mini', b.miniInlineWidth + PRESENCE_CARD_CHROME.width, 204, 12)).toMatchObject({
      miniInline: true,
      pill: true,
    });
  });

  it('plan rows never exceed members', () => {
    for (const members of [0, 1, 2, 4]) {
      for (const [w, h] of [[300, 852], [600, 852], [1300, 852]]) {
        const view = resolvePresenceView(w, h);
        expect(planPresenceLayout(view, w, h, members).rows).toBeLessThanOrEqual(members);
      }
    }
  });

  it('body height minus used sections is under one row (no empty space)', () => {
    for (let height = 204; height <= 852; height += 108) {
      for (let width = 300; width <= 1400; width += 100) {
        const view: PresenceView = resolvePresenceView(width, height);
        if (view === 'mini') continue;
        const plan: PresencePlan = planPresenceLayout(view, width, height, 60);
        const body = height - PRESENCE_CARD_CHROME.height;
        const used = presenceBodyUsed(view, plan);
        const rowPx = plan.table ? PRESENCE_SECTION_PX.tableRow : PRESENCE_SECTION_PX.row;
        expect(used, `${width}x${height} used`).toBeLessThanOrEqual(body);
        // Under one row with its lead gap: a row that does not fit whole is never drawn.
        expect(body - used, `${width}x${height} leftover`).toBeLessThan(rowPx + PRESENCE_SECTION_PX.gap);
      }
    }
  });

  it('trend only after five rows fit', () => {
    for (let height = 260; height <= 852; height += 12) {
      const plan = planPresenceLayout('standard', 900, height, 60);
      if (plan.trend) expect(plan.rows).toBeGreaterThanOrEqual(5);
    }
    expect(planPresenceLayout('standard', 1300, 852, 60).trend).toBe(true);
    expect(planPresenceLayout('standard', 600, 420, 60).trend).toBe(false);
  });

  it('no viewAll when everyone fits; viewAll when rows are hidden', () => {
    expect(planPresenceLayout('standard', 900, 852, 4)).toMatchObject({ rows: 4, viewAll: false });
    const crowded = planPresenceLayout('standard', 600, 420, 60);
    expect(crowded.viewAll).toBe(true);
    expect(crowded.rows).toBeGreaterThanOrEqual(1);
  });

  it('standard: tiles then rows; table from the table width', () => {
    expect(planPresenceLayout('standard', 600, 420, 60)).toMatchObject({ tiles: true, table: false });
    expect(planPresenceLayout('standard', 900, 636, 60)).toMatchObject({ tiles: true, table: true });
  });

  it('columns drop right to left and keep status', () => {
    const all = planPresenceLayout('standard', 900, 636, 60).columns;
    expect(all).toEqual(['status', 'start', 'elapsed', 'remaining', 'todayHours', 'progress']);
    const narrow = planPresenceLayout('standard', b.tableWidth, 636, 60).columns;
    expect(narrow[0]).toBe('status');
    expect(narrow.length).toBeLessThan(all.length);
    expect(all.slice(0, narrow.length)).toEqual(narrow);
  });

  it('xs: donut, pill, then rows; never tiles or a table', () => {
    const plan = planPresenceLayout('xs', 300, 636, 60);
    expect(plan).toMatchObject({ pill: true, tiles: false, table: false, trend: false });
    expect(plan.rows).toBeGreaterThan(0);
  });
});
