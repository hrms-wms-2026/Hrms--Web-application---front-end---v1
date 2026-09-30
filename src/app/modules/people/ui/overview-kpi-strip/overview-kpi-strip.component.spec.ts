import { TestBed } from '@angular/core/testing';
import { KpiCard } from '../../utils/overview-kpi-cards';
import { OverviewKpiStripComponent } from './overview-kpi-strip.component';

describe('OverviewKpiStripComponent', () => {
  const card = (key: string, tone: KpiCard['tone']): KpiCard => ({
    key,
    tone,
    label: key,
    value: 2,
    denominator: null,
    suffix: '',
    detail: 'Detail',
    polarity: 'lower-better'
  });

  it('renders four KPI cards and applies the first card tone', () => {
    TestBed.configureTestingModule({ imports: [OverviewKpiStripComponent] });
    const fixture = TestBed.createComponent(OverviewKpiStripComponent);
    fixture.componentRef.setInput('cards', [
      card('absent_days', 'critical'),
      card('late_clock_ins', 'warning'),
      card('pending_approvals', 'info'),
      card('days_attended', 'baseline')
    ]);
    fixture.detectChanges();

    const cards = fixture.nativeElement.querySelectorAll('[data-testid="kpi-card"]');
    expect(cards).toHaveLength(4);
    expect(cards[0].classList.contains('bg-red-50')).toBe(true);
  });
});
