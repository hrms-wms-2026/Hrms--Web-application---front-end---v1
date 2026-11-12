import { describe, expect, it } from 'vitest';
import { WIDGET, WIDGET_RAMP, isWidgetColor, widgetInkOn, widgetRamp, widgetShadeFor } from './widget-palette';

describe('widget palette', () => {
  it('widgetRamp(4) is the four main shades in lightness order', () => {
    expect(widgetRamp(4)).toEqual([WIDGET.shade1, WIDGET.shade2, WIDGET.shade3, WIDGET.shade4]);
  });

  it('widgetRamp(6) is the full ramp', () => {
    expect(widgetRamp(6)).toEqual([...WIDGET_RAMP]);
  });

  it('widgetRamp(2) is the darkest and the lightest shade', () => {
    expect(widgetRamp(2)).toEqual([WIDGET.shade1, WIDGET.shade4]);
  });

  it('widgetRamp(n) entries are distinct and keep ramp order', () => {
    for (const n of [1, 2, 3, 4, 5, 6]) {
      const ramp = widgetRamp(n);
      expect(ramp).toHaveLength(n);
      expect(new Set(ramp).size).toBe(n);
      const idx = ramp.map((c: string) => WIDGET_RAMP.indexOf(c));
      expect(idx).toEqual([...idx].sort((a, b) => a - b));
    }
  });

  it('the ramp is six distinct shades, darkest first', () => {
    expect(WIDGET_RAMP).toEqual([WIDGET.shade1, WIDGET.shade2, WIDGET.shade2b, WIDGET.shade3, WIDGET.shade3b, WIDGET.shade4]);
  });

  it('widgetShadeFor is stable and picks a ramp shade', () => {
    const a = widgetShadeFor('p-42');
    expect(widgetShadeFor('p-42')).toBe(a);
    expect(WIDGET_RAMP).toContain(a);
  });

  it('widgetShadeFor spreads different keys over the ramp', () => {
    const shades = new Set(Array.from({ length: 40 }, (_, i) => widgetShadeFor(`project-${i}`)));
    expect(shades.size).toBeGreaterThan(3);
  });

  it('widgetInkOn: solid text on the two darkest shades, dark text on the lighter ones', () => {
    expect(widgetInkOn(WIDGET.shade1)).toBe(WIDGET.onSolid);
    expect(widgetInkOn(WIDGET.shade2)).toBe(WIDGET.onSolid);
    for (const s of [WIDGET.shade2b, WIDGET.shade3, WIDGET.shade3b, WIDGET.shade4]) expect(widgetInkOn(s)).toBe(WIDGET.onLight);
  });

  it('isWidgetColor accepts widget tokens and transparent only', () => {
    expect(isWidgetColor('#10b981')).toBe(false);
    expect(isWidgetColor('var(--color-cat-green)')).toBe(false);
    expect(isWidgetColor(WIDGET.maroon)).toBe(true);
    expect(isWidgetColor(WIDGET.mildLine)).toBe(true);
    expect(isWidgetColor('transparent')).toBe(true);
  });
});
