import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { SummaryCardModel } from '../../models/summary-card.model';
import { DashboardSummaryRowComponent } from './dashboard-summary-row.component';

const card = (id: string, state: SummaryCardModel['state'] = 'ready'): SummaryCardModel => ({
  id,
  title: id,
  icon: 'users',
  tone: 'var(--color-cat-blue)',
  section: `sec-${id}`,
  state,
  body: state === 'ready' ? { kind: 'bars', figure: '3', delta: null, values: [1, 2] } : null
});

describe('DashboardSummaryRowComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  function setup(cards: SummaryCardModel[]) {
    const fixture = TestBed.createComponent(DashboardSummaryRowComponent);
    fixture.componentRef.setInput('cards', cards);
    fixture.detectChanges();
    const opened: string[] = [];
    const retried: string[] = [];
    fixture.componentInstance.cardOpened.subscribe((s) => opened.push(s));
    fixture.componentInstance.cardRetried.subscribe((id) => retried.push(id));
    return { el: fixture.nativeElement as HTMLElement, opened, retried };
  }

  it('lays the cards out in one row, one column per card', () => {
    const { el } = setup([card('a'), card('b')]);
    expect(el.querySelectorAll('app-dashboard-summary-card').length).toBe(2);
    expect((el.querySelector('[data-testid="summary-row"]') as HTMLElement).style.gridTemplateColumns).toBe('repeat(2, minmax(0, 1fr))');
  });

  it('passes a card click on as its section, and Try again as its id', () => {
    const { el, opened, retried } = setup([card('a'), card('b', 'error')]);
    (el.querySelector('[data-testid="summary-card"]') as HTMLElement).click();
    (el.querySelector('[data-testid="summary-retry"]') as HTMLElement).click();
    expect(opened).toEqual(['sec-a']);
    expect(retried).toEqual(['b']);
  });
});
