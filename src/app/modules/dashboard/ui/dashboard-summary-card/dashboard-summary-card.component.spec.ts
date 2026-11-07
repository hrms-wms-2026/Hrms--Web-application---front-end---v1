import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SummaryCardBody, SummaryCardModel } from '../../models/summary-card.model';
import { DashboardSummaryCardComponent } from './dashboard-summary-card.component';

const card = (body: SummaryCardBody | null, extra: Partial<SummaryCardModel> = {}): SummaryCardModel => ({
  id: 'att-rate',
  title: 'Attendance rate',
  icon: 'calendar-check',
  tone: '#10b981',
  section: 'trend',
  state: 'ready',
  body,
  ...extra
});

const spark: SummaryCardBody = {
  kind: 'spark',
  figure: '96%',
  delta: { text: '+2.0 pp', good: true, suffix: 'vs last week' },
  points: [88, null, 96]
};

describe('DashboardSummaryCardComponent', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    TestBed.resetTestingModule();
  });

  function setup(model: SummaryCardModel) {
    const fixture = TestBed.createComponent(DashboardSummaryCardComponent);
    fixture.componentRef.setInput('card', model);
    fixture.componentRef.setInput('index', 0);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const opened: string[] = [];
    const retried: number[] = [];
    fixture.componentInstance.opened.subscribe((s) => opened.push(s));
    fixture.componentInstance.retried.subscribe(() => retried.push(1));
    return { fixture, el, opened, retried };
  }
  const q = (el: HTMLElement, id: string) => el.querySelector(`[data-testid="${id}"]`);

  it('shows the title, icon, figure and delta, with an accessible name', () => {
    const { el } = setup(card(spark));
    expect(q(el, 'summary-title')?.textContent?.trim()).toBe('Attendance rate');
    expect(el.querySelector('app-icon')).not.toBeNull();
    expect(q(el, 'summary-figure')?.textContent?.trim()).toBe('96%');
    expect(q(el, 'summary-delta')?.textContent).toContain('+2.0 pp');
    expect(q(el, 'summary-delta')?.textContent).toContain('vs last week');
    expect(q(el, 'summary-card')?.getAttribute('aria-label')).toBe('Attendance rate: 96%. Open details');
  });

  it('draws a sparkline that skips missing points without NaN', () => {
    const { el } = setup(card(spark));
    const line = q(el, 'summary-spark-line') as SVGPathElement;
    expect(line.getAttribute('d')).not.toContain('NaN');
    expect(line.getAttribute('d')?.match(/M/g)?.length).toBe(2);
  });

  it('leaves out the delta line when there is none', () => {
    const { el } = setup(card({ ...spark, figure: '—', delta: null, points: [] }));
    expect(q(el, 'summary-figure')?.textContent?.trim()).toBe('—');
    expect(q(el, 'summary-delta')).toBeNull();
  });

  it('shows one row per ranked person, or the empty line', () => {
    const rows = [
      { id: 'a', name: 'Ravi K', avatarFileId: null, chips: [{ text: '3 late', tone: '#f59e0b' }] },
      { id: 'b', name: 'Anu S', avatarFileId: null, chips: [] }
    ];
    const { el } = setup(card({ kind: 'rank', count: null, countLabel: '', rows, empty: 'No one needs attention' }));
    expect(el.querySelectorAll('[data-testid="summary-rank-row"]').length).toBe(2);
    expect(el.textContent).toContain('3 late');

    const empty = setup(card({ kind: 'rank', count: null, countLabel: '', rows: [], empty: 'No one needs attention' }));
    expect(empty.el.querySelectorAll('[data-testid="summary-rank-row"]').length).toBe(0);
    expect(empty.el.textContent).toContain('No one needs attention');
  });

  it('renders every other kind', () => {
    const bodies: SummaryCardBody[] = [
      { kind: 'bars', figure: '312 h', delta: null, values: [1, 2, 3] },
      { kind: 'pair', figure: '92%', delta: null, pairs: [[8, 7], [8, 6]], legend: ['Planned', 'Actual'] },
      { kind: 'meter', figure: '78%', delta: null, percent: 78, caption: '156 / 200 h planned' },
      { kind: 'hbars', headline: 'Overall 94%', rows: [{ label: 'Sales', percent: 88, tone: '#f59e0b' }] },
      { kind: 'people', count: '3', countLabel: 'people', rows: [{ id: 'p', name: 'Priya N', avatarFileId: null, chip: 'Design' }], empty: 'No one' },
      { kind: 'chips', count: '25', countLabel: 'people', items: [{ label: 'Working', value: 15, tone: '#10b981' }] }
    ];
    const expected = ['summary-bar', 'summary-pair', 'summary-meter', 'summary-hbar', 'summary-person', 'summary-chip'];
    bodies.forEach((body, i) => {
      const { el } = setup(card(body));
      expect(el.querySelector(`[data-testid="${expected[i]}"]`), expected[i]).not.toBeNull();
      TestBed.resetTestingModule();
    });
  });

  it('puts a ranking or people count in the header so the rows fit a 2-row card', () => {
    const rows = [{ id: 'a', name: 'Ravi K', avatarFileId: null, chips: [] }];
    const { el } = setup(card({ kind: 'rank', count: '64', countLabel: 'overdue', rows, empty: '' }));
    const count = q(el, 'summary-count');
    expect(count?.closest('.sc-head')).not.toBeNull();
    expect(count?.textContent?.replace(/\s+/g, ' ').trim()).toBe('64 overdue');

    const people = setup(card({ kind: 'people', count: '3', countLabel: 'people', rows: [], empty: 'No one' }));
    expect(q(people.el, 'summary-count')?.closest('.sc-head')).not.toBeNull();
  });

  it('shows a skeleton while loading', () => {
    const { el } = setup(card(null, { state: 'loading' }));
    expect(q(el, 'summary-skeleton')).not.toBeNull();
  });

  it('shows an error with Try again, which retries without opening the popup', () => {
    const { el, opened, retried } = setup(card(null, { state: 'error' }));
    expect(el.textContent).toContain("Couldn't load");
    // No button inside a button: the failed card is a plain group and Try again is the real button.
    expect(q(el, 'summary-card')?.tagName).not.toBe('BUTTON');
    expect(q(el, 'summary-retry')?.tagName).toBe('BUTTON');
    expect(el.querySelectorAll('button button').length).toBe(0);
    (q(el, 'summary-retry') as HTMLButtonElement).click();
    expect(retried.length).toBe(1);
    expect(opened.length).toBe(0);
  });

  it('opens its popup section on click', () => {
    const { el, opened } = setup(card(spark));
    (q(el, 'summary-card') as HTMLElement).click();
    expect(opened).toEqual(['trend']);
  });

  it('is a button, so Enter and Space open it from the keyboard', () => {
    const { el } = setup(card(spark));
    expect(q(el, 'summary-card')?.tagName).toBe('BUTTON');
  });

  it('shows the final state at once without a frame clock (reduced motion, tests)', () => {
    const { el } = setup(card({ kind: 'bars', figure: '2,390 h', delta: null, values: [1, 4] }));
    expect(q(el, 'summary-card')?.classList).toContain('sc--on');
    expect(q(el, 'summary-figure')?.textContent?.trim()).toBe('2,390 h');
    const bars = [...el.querySelectorAll('[data-testid="summary-bar"]')] as HTMLElement[];
    expect(bars[1].style.height).toBe('100%');
  });

  it('starts hidden and counts up when motion is allowed', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    const { el } = setup(card({ kind: 'bars', figure: '2,390 h', delta: null, values: [1, 4] }));
    expect(q(el, 'summary-card')?.classList).not.toContain('sc--on');
    expect(q(el, 'summary-figure')?.textContent?.trim()).toBe('0 h');
  });
});
