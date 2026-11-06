import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { DonutBreakdownComponent, DonutSlice } from './donut-breakdown.component';

const SLICES: DonutSlice[] = [
  { key: 'worked', label: 'Worked', value: 90, valueText: '1h 30m', color: '#3b82f6' },
  { key: 'break', label: 'Break', value: 30, valueText: '30m', color: '#f59e0b' },
  { key: 'leave', label: 'Leave', value: 0, valueText: '0m', color: '#ef4444' },
];

describe('DonutBreakdownComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  function setup(slices: DonutSlice[] = SLICES) {
    const fixture = TestBed.createComponent(DonutBreakdownComponent);
    fixture.componentRef.setInput('slices', slices);
    fixture.componentRef.setInput('centerValue', '2h');
    fixture.componentRef.setInput('centerLabel', 'of 8h');
    fixture.componentRef.setInput('ariaLabel', 'Hours');
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  /** The donut centre's text: the whole, or the lit slice. */
  const center = (el: HTMLElement) =>
    [...el.querySelectorAll('.db-center span, .dd-center span')].map((s) => s.textContent!.trim()).join(' ');
  const arc = (el: HTMLElement, key: string) => el.querySelector(`[data-testid="donut-segment"][data-key="${key}"]`);

  it('draws an arc per non-zero slice and keeps zero slices in the key, each with its share', () => {
    const { el } = setup();

    expect(el.querySelectorAll('[data-testid="donut-segment"]')).toHaveLength(2);
    expect(el.querySelector('[data-testid="db-row-leave"]')!.classList).toContain('dk-row--zero');
    expect(el.querySelector('[data-testid="db-row-worked-percent"]')!.textContent!.trim()).toBe('75%');
    expect(center(el)).toBe('2h of 8h');
  });

  it('hovering a key row puts that slice in the centre and fades the others', () => {
    const { fixture, el } = setup();

    el.querySelector('[data-testid="db-row-break"]')!.dispatchEvent(new Event('mouseenter'));
    fixture.detectChanges();

    expect(center(el)).toBe('30m Break · 25%');
    expect(arc(el, 'break')!.classList).toContain('dd-arc--on');
    expect(arc(el, 'worked')!.classList).not.toContain('dd-arc--on');
    expect(el.querySelector('svg')!.classList).toContain('dd-svg--hover');

    el.querySelector('app-dashboard-donut')!.dispatchEvent(new Event('mouseleave'));
    fixture.detectChanges();
    expect(center(el)).toBe('2h of 8h');
  });

  it('a single slice closes the ring', () => {
    const { el } = setup([SLICES[0]]);

    expect(arc(el, 'worked')!.getAttribute('stroke-dasharray')).toBe('100 0');
  });
});
