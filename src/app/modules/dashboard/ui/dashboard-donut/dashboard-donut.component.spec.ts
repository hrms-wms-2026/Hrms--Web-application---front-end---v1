import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { DASHBOARD_DONUT_PX } from '../../utils/dashboard-donut.util';
import {
  DashboardDonutComponent,
  DashboardDonutSlice,
  donutSliceShare,
} from './dashboard-donut.component';
import { DonutKeyComponent } from './donut-key.component';

const SLICES: DashboardDonutSlice[] = [
  { key: 'done', label: 'Completed', value: 30, valueText: '30 h', color: '#10b981' },
  { key: 'doing', label: 'In progress', value: 10, valueText: '10 h', color: '#3b82f6' },
  { key: 'todo', label: 'Not started', value: 0, color: '#cbd5e1' },
];

/** A widget using the donut and its key the way the dashboard cards do: one shared hovered slice. */
@Component({
  standalone: true,
  imports: [DashboardDonutComponent, DonutKeyComponent],
  template: `
    <app-dashboard-donut
      data-testid="donut"
      [slices]="slices()"
      ariaLabel="Hours"
      [(active)]="hovered"
    >
      <p class="own-centre" data-testid="own-centre">40 h</p>
    </app-dashboard-donut>
    <app-donut-key [slices]="slices()" [showValue]="true" [(active)]="hovered" />
  `,
})
class HostComponent {
  readonly slices = signal<DashboardDonutSlice[]>(SLICES);
  readonly hovered = signal<string | null>(null);
}

describe('DashboardDonutComponent + DonutKeyComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  function setup() {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, el, host: fixture.componentInstance };
  }
  const arcs = (el: HTMLElement) =>
    [...el.querySelectorAll('[data-testid="donut-segment"]')] as SVGPathElement[];
  const rows = (el: HTMLElement) =>
    [...el.querySelectorAll('[data-testid="donut-key-row"]')] as HTMLElement[];

  it("is the dashboard donut size and draws one arc per non-zero slice from 12 o'clock", () => {
    const { el } = setup();
    const donut = el.querySelector('[data-testid="donut"]') as HTMLElement;
    expect(donut.style.width).toBe(`${DASHBOARD_DONUT_PX}px`);
    expect(arcs(el).map((a) => a.getAttribute('data-key'))).toEqual(['done', 'doing']);
    // Rounded, spaced slices: each is a filled ring sector in its colour, fully drawn when there is no motion.
    expect(arcs(el)[0].tagName.toLowerCase()).toBe('path');
    expect(arcs(el)[0].getAttribute('fill')).toBe('#10b981');
    expect(arcs(el)[0].getAttribute('d')).toMatch(/^M .* A .* L .* A .* Z$/);
    expect(arcs(el)[0].getAttribute('fill-opacity')).toBe('1');
    expect(el.querySelector('svg')!.getAttribute('aria-label')).toBe('Hours');
  });

  it('draws a transparent slice (the rest of a progress ring) as a grey track slice, not an invisible one', () => {
    const { fixture, el, host } = setup();
    host.slices.set([SLICES[0], { key: 'left', label: 'Left', value: 10, color: 'transparent' }]);
    fixture.detectChanges();
    const rest = el.querySelector('[data-testid="donut-segment"][data-key="left"]')!;
    expect(rest.classList).toContain('dd-arc--rest');
    expect(
      el.querySelector('[data-testid="donut-segment"][data-key="done"]')!.classList,
    ).not.toContain('dd-arc--rest');
  });

  it('shows the projected centre until a slice is lit', () => {
    const { el } = setup();
    expect(el.querySelector('[data-testid="own-centre"]')?.textContent).toBe('40 h');
    expect(el.querySelector('[data-testid="donut-hover"]')).toBeNull();
  });

  it('hovering a slice lights it and puts its value, name and share in the centre', () => {
    const { fixture, el, host } = setup();
    arcs(el)[1].dispatchEvent(new Event('mouseenter'));
    fixture.detectChanges();

    expect(host.hovered()).toBe('doing');
    expect(el.querySelector('[data-testid="own-centre"]')).toBeNull();
    expect(
      [...el.querySelectorAll('[data-testid="donut-hover"] span')].map((s) =>
        s.textContent!.trim(),
      ),
    ).toEqual(['10 h', 'In progress · 25%']);
    expect(arcs(el)[1].classList).toContain('dd-arc--on');
    expect(el.querySelector('svg')!.classList).toContain('dd-svg--hover');
    // The key row of the same slice lights too.
    expect(rows(el)[1].classList).toContain('dk-row--on');

    el.querySelector('[data-testid="donut"]')!.dispatchEvent(new Event('mouseleave'));
    fixture.detectChanges();
    expect(host.hovered()).toBeNull();
    expect(el.querySelector('[data-testid="own-centre"]')).not.toBeNull();
  });

  it('the key lists every slice with its share beside the name, and hovering a row lights the slice', () => {
    const { fixture, el } = setup();
    expect(
      rows(el).map((r) =>
        [...r.children].map((c) => c.textContent!.trim()).filter((t) => t !== ''),
      ),
    ).toEqual([
      ['Completed', '75%', '30 h'],
      ['In progress', '25%', '10 h'],
      ['Not started', '0%', '0'],
    ]);
    expect(rows(el)[2].classList).toContain('dk-row--zero');

    rows(el)[0].dispatchEvent(new Event('mouseenter'));
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="donut-hover"]')!.textContent).toContain(
      'Completed · 75%',
    );
    rows(el)[0].dispatchEvent(new Event('mouseleave'));
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="donut-hover"]')).toBeNull();
  });

  it('a zero slice never lights the centre', () => {
    const { fixture, el } = setup();
    rows(el)[2].dispatchEvent(new Event('mouseenter'));
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="donut-hover"]')).toBeNull();
  });

  it('a slice may bring its own share (for a share of something other than the slices)', () => {
    expect(donutSliceShare({ ...SLICES[0], percentText: '12%' }, SLICES)).toBe('12%');
    expect(donutSliceShare(SLICES[0], SLICES)).toBe('75%');
  });
});
