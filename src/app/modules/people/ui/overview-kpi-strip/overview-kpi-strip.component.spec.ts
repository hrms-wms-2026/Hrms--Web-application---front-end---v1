import { TestBed } from '@angular/core/testing';
import { KpiCard } from '../../utils/overview-kpi-cards';
import { OverviewKpiStripComponent } from './overview-kpi-strip.component';

const card = (key: string, tone: KpiCard['tone']): KpiCard =>
  ({ key, tone, label: key, value: 2, denominator: null, suffix: '', detail: 'd', polarity: 'lower-better' });

describe('OverviewKpiStripComponent card selection', () => {
  function setup(cards: KpiCard[]) {
    TestBed.configureTestingModule({ imports: [OverviewKpiStripComponent] });
    const fixture = TestBed.createComponent(OverviewKpiStripComponent);
    fixture.componentRef.setInput('cards', cards);
    fixture.detectChanges();
    return fixture;
  }

  it('emits the key for a coloured (signal) card and nothing for a baseline card', () => {
    const fixture = setup([card('over_break', 'warning'), card('days_attended', 'baseline')]);
    const selected = vi.fn();
    fixture.componentInstance.cardSelected.subscribe(selected);
    const cards = fixture.nativeElement.querySelectorAll('[data-testid="kpi-card"]') as NodeListOf<HTMLElement>;

    cards[0].click();
    cards[1].click();

    expect(selected).toHaveBeenCalledTimes(1);
    expect(selected).toHaveBeenCalledWith('over_break');
    expect(cards[0].getAttribute('role')).toBe('button');
    expect(cards[1].getAttribute('role')).toBeNull();
  });

  it('tints the icon tile with the signal severity', () => {
    const fixture = setup([card('absent_days', 'critical')]);
    expect((fixture.nativeElement.querySelector('[data-testid="kpi-icon"]') as HTMLElement).className).toContain('bg-red-50');
  });

  it('gives baseline cards their own colour and falls back to the tone for unknown keys', () => {
    const fixture = setup([card('on_time_delivery', 'baseline'), card('some_new_signal', 'warning')]);
    const icons = fixture.nativeElement.querySelectorAll('[data-testid="kpi-icon"]') as NodeListOf<HTMLElement>;
    expect(icons[0].className).toContain('bg-violet-50');
    expect(icons[1].className).toContain('bg-amber-50');
    expect(icons[1].querySelector('svg')!.children.length).toBeGreaterThan(0);
  });
});
