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

  const center = (el: HTMLElement) =>
    [...el.querySelectorAll('.db-center span')].map((s) => s.textContent!.trim()).join(' ');

  it('draws an arc per non-zero slice and keeps zero slices in the legend', () => {
    const { el } = setup();

    expect(el.querySelectorAll('.db-arc')).toHaveLength(2);
    expect(el.querySelector('[data-testid="db-row-leave"]')!.classList).toContain('db-row--zero');
    expect(el.querySelector('[data-testid="db-row-worked"]')!.textContent).toContain('75%');
    expect(center(el)).toBe('2h of 8h');
  });

  it('hovering a legend row puts that slice in the centre and dims the others', () => {
    const { fixture, el } = setup();

    el.querySelector('[data-testid="db-row-break"]')!.dispatchEvent(new Event('mouseenter'));
    fixture.detectChanges();

    expect(center(el)).toBe('30m Break · 25%');
    expect(el.querySelector('[data-testid="db-arc-worked"]')!.classList).toContain('db-arc--dim');

    el.querySelector('.db')!.dispatchEvent(new Event('mouseleave'));
    fixture.detectChanges();
    expect(center(el)).toBe('2h of 8h');
  });

  it('a single slice closes the ring without a gap', () => {
    const { el } = setup([SLICES[0]]);

    expect(
      el.querySelector('[data-testid="db-arc-worked"]')!.getAttribute('stroke-dasharray'),
    ).toBe('100 0');
  });
});
