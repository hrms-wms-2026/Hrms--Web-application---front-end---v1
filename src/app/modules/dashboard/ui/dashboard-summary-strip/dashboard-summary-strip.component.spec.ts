import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SummaryCardModel } from '../../models/summary-card.model';
import { FakeResizeObserver, stubResizeObserver } from '../../utils/host-size.testing';
import { DashboardDonutSlice } from '../../../../shared/ui/charts/dashboard-donut/dashboard-donut.component';
import { DashboardSummaryStripComponent } from './dashboard-summary-strip.component';

const SLICES: DashboardDonutSlice[] = [
  { key: 'present', label: 'Present', value: 18, color: '#34d399' },
  { key: 'late', label: 'Late', value: 3, color: '#fbbf24' }
];

const card = (id: string): SummaryCardModel => ({
  id,
  title: id,
  icon: 'users',
  tone: '#3b82f6',
  section: `sec-${id}`,
  state: 'ready',
  body: { kind: 'bars', figure: '3', delta: null, values: [1, 2] }
});

@Component({
  standalone: true,
  imports: [DashboardSummaryStripComponent],
  template: `
    <app-dashboard-summary-strip
      [slices]="slices"
      [keySlices]="slices"
      [cards]="cards()"
      donutLabel="Today"
      [(active)]="hovered"
      (cardOpened)="opened.push($event)"
      (shownCards)="shown.push($event)"
    >
      <p data-testid="centre">96%</p>
    </app-dashboard-summary-strip>
  `
})
class HostComponent {
  readonly slices = SLICES;
  readonly cards = signal([card('a'), card('b'), card('c'), card('d')]);
  readonly hovered = signal<string | null>(null);
  readonly opened: string[] = [];
  readonly shown: number[] = [];
}

describe('DashboardSummaryStripComponent', () => {
  beforeEach(() => stubResizeObserver());
  afterEach(() => {
    vi.unstubAllGlobals();
    TestBed.resetTestingModule();
  });

  /** The strip fills the card body: the widget host width minus 32px of card padding. */
  function setup(width: number) {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    FakeResizeObserver.instances.at(-1)!.trigger(width - 32, 150);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const resize = (w: number) => {
      FakeResizeObserver.instances.at(-1)!.trigger(w - 32, 150);
      fixture.detectChanges();
    };
    return { fixture, el, host: fixture.componentInstance, resize };
  }
  const cards = (el: HTMLElement) => el.querySelectorAll('app-dashboard-summary-card').length;

  it('shows only the donut, with the projected centre, on a 2x2 card', () => {
    const { el } = setup(292); // widget host widths below
    expect(el.querySelector('app-dashboard-donut')).not.toBeNull();
    expect(el.querySelector('[data-testid="centre"]')?.textContent).toBe('96%');
    expect(el.querySelector('app-donut-key')).toBeNull();
    expect(cards(el)).toBe(0);
  });

  it('adds the colour key at 2x4', () => {
    const { el } = setup(424);
    expect(el.querySelector('app-donut-key')).not.toBeNull();
    expect(cards(el)).toBe(0);
  });

  it('fills a 2x12 card with all four cards and reports how many it shows', () => {
    const { el, host, resize } = setup(1812);
    expect(cards(el)).toBe(4);
    expect(host.shown.at(-1)).toBe(4);
    resize(660);
    expect(cards(el)).toBe(1);
    expect(host.shown.at(-1)).toBe(1);
  });

  it('passes a card click on as the section to open', () => {
    const { el, host } = setup(1812);
    (el.querySelector('[data-testid="summary-card"]') as HTMLElement).click();
    expect(host.opened).toEqual(['sec-a']);
  });
});
