import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DashboardBar,
  DashboardBarChartComponent,
  DashboardBarHeadline,
} from './dashboard-bar-chart.component';

const bar = (key: string, a: number, b = 0, state?: DashboardBar['state']): DashboardBar => ({
  key,
  label: key,
  title: `Day ${key}`,
  valueText: `${a + b} h`,
  chip: `${a} done`,
  segments: [
    { key: 'a', value: a, color: '#10b981' },
    { key: 'b', value: b, color: '#f59e0b' },
  ],
  tooltip: `${key}: ${a + b}`,
  state,
});

function setup(
  bars: DashboardBar[],
  headline: DashboardBarHeadline | null = null,
): ComponentFixture<DashboardBarChartComponent> {
  const fixture = TestBed.createComponent(DashboardBarChartComponent);
  fixture.componentRef.setInput('bars', bars);
  fixture.componentRef.setInput('ariaLabel', 'Hours by day');
  fixture.componentRef.setInput('headline', headline);
  fixture.detectChanges();
  return fixture;
}

const q = (f: ComponentFixture<unknown>, sel: string) =>
  (f.nativeElement as HTMLElement).querySelector<HTMLElement>(sel);
const all = (f: ComponentFixture<unknown>, sel: string) => [
  ...(f.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(sel),
];
const headline = (f: ComponentFixture<unknown>) =>
  all(
    f,
    '[data-testid=bar-chart-headline] .bc-head-label, [data-testid=bar-chart-headline] .bc-head-row > span',
  ).map((n) => n.textContent?.trim());

describe('DashboardBarChartComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('draws a track per bar, stacking its segments from the bottom against a round axis', () => {
    const f = setup([bar('1', 30, 10), bar('2', 10), bar('3', 0)]);
    const cols = all(f, '[data-testid=bar-chart-col]');

    expect(cols.length).toBe(3);
    expect(all(f, '[data-testid=bar-chart-axis] > span').map((s) => s.textContent?.trim())).toEqual(
      ['40', '20', '0'],
    );
    expect(cols[0].querySelector<HTMLElement>('[data-testid=bar-chart-stack]')?.style.height).toBe(
      '100%',
    );
    expect(cols[1].querySelector<HTMLElement>('[data-testid=bar-chart-stack]')?.style.height).toBe(
      '25%',
    );
    expect(cols[0].querySelector<HTMLElement>('[data-segment=a]')?.style.height).toBe('75%');
    expect(cols[0].querySelector<HTMLElement>('[data-segment=b]')?.style.height).toBe('25%');
    // Zero segments and empty bars draw nothing.
    expect(cols[1].querySelector('[data-segment=b]')).toBeNull();
    expect(cols[2].querySelector('[data-testid=bar-chart-stack]')).toBeNull();
    expect(q(f, '[role=img]')?.getAttribute('aria-label')).toBe('Hours by day');
  });

  it('draws a current bar lighter and a future one as an empty track', () => {
    const f = setup([bar('1', 10), bar('2', 5, 0, 'current'), bar('3', 8, 0, 'future')]);
    const cols = all(f, '[data-testid=bar-chart-col]');

    expect(cols[1].querySelector('[data-testid=bar-chart-stack]')?.classList).toContain(
      'bc-stack--current',
    );
    expect(cols[2].querySelector('[data-testid=bar-chart-stack]')).toBeNull();
  });

  it('the headline reads the hovered bar, then the whole again on leaving', () => {
    const f = setup([bar('1', 30, 10), bar('2', 10)], {
      label: 'This week',
      value: '50 h',
      chip: { text: '+10%', tone: 'up' },
    });
    expect(headline(f)).toEqual(['This week', '50 h', '+10%']);
    expect(q(f, '[data-testid=bar-chart-chip]')?.classList).toContain('bc-chip--up');

    all(f, '[data-testid=bar-chart-col]')[0].dispatchEvent(new Event('mouseenter'));
    f.detectChanges();
    expect(all(f, '[data-testid=bar-chart-col]')[0].classList).toContain('bc-col--active');
    expect(headline(f)).toEqual(['Day 1', '40 h', '30 done']);

    q(f, '[data-testid=bar-chart]')!.dispatchEvent(new Event('mouseleave'));
    f.detectChanges();
    expect(headline(f)).toEqual(['This week', '50 h', '+10%']);
  });

  it('a hovered future bar reads a dash', () => {
    const f = setup([bar('1', 10), bar('2', 0, 0, 'future')], {
      label: 'This week',
      value: '10 h',
    });
    all(f, '[data-testid=bar-chart-col]')[1].dispatchEvent(new Event('mouseenter'));
    f.detectChanges();
    expect(headline(f)).toEqual(['Day 2', '—']);
  });

  it('no headline without one, and a note when every bar is empty', () => {
    const f = setup([bar('1', 0), bar('2', 0)]);
    expect(q(f, '[data-testid=bar-chart-headline]')).toBeNull();
    expect(q(f, '[data-testid=bar-chart-empty]')?.textContent?.trim()).toBe(
      'Nothing in this range',
    );
  });

  it('orders variant: legend beside the headline, a sub line that follows the hovered bar', () => {
    const f = TestBed.createComponent(DashboardBarChartComponent);
    f.componentRef.setInput('bars', [{ ...bar('1', 10), sub: '2h task' }, bar('2', 4)]);
    f.componentRef.setInput('ariaLabel', 'Hours by day');
    f.componentRef.setInput('headline', { label: 'This week', value: '14 h', sub: '5h task' });
    f.componentRef.setInput('legend', [{ label: 'Worked', color: '#3b82f6' }]);
    f.componentRef.setInput('variant', 'orders');
    f.detectChanges();

    expect((f.nativeElement as HTMLElement).classList).toContain('bc--orders');
    expect(q(f, '.bc-top [data-testid=bar-chart-legend]')).not.toBeNull();
    expect(all(f, '[data-testid=bar-chart-legend]')).toHaveLength(1);
    expect(q(f, '[data-testid=bar-chart-sub]')?.textContent?.trim()).toBe('5h task');

    all(f, '[data-testid=bar-chart-col]')[0].dispatchEvent(new Event('mouseenter'));
    f.detectChanges();
    expect(q(f, '[data-testid=bar-chart-sub]')?.textContent?.trim()).toBe('2h task');
  });

  it('default variant keeps the legend under the chart and no sub line', () => {
    const f = setup([bar('1', 10)], { label: 'This week', value: '10 h' });
    f.componentRef.setInput('legend', [{ label: 'Worked', color: '#3b82f6' }]);
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).classList).not.toContain('bc--orders');
    expect(q(f, '.bc-top [data-testid=bar-chart-legend]')).toBeNull();
    expect(q(f, '[data-testid=bar-chart-legend]')).not.toBeNull();
    expect(q(f, '[data-testid=bar-chart-sub]')).toBeNull();
  });

  it('orders variant draws boxy bars for a week, slim ones for a month', () => {
    const f = setup(Array.from({ length: 7 }, (_, i) => bar(`${i}`, i + 1)));
    f.componentRef.setInput('variant', 'orders');
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).classList).toContain('bc--boxy');

    f.componentRef.setInput(
      'bars',
      Array.from({ length: 30 }, (_, i) => bar(`${i}`, i + 1)),
    );
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).classList).not.toContain('bc--boxy');
  });
});
