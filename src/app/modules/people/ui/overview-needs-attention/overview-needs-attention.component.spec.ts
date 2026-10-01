import { TestBed } from '@angular/core/testing';
import { EmployeeSignal } from '../../models/employee-overview.model';
import { OverviewNeedsAttentionComponent } from './overview-needs-attention.component';

describe('OverviewNeedsAttentionComponent', () => {
  const signal = (
    key: string,
    rank: number,
    severity: EmployeeSignal['severity']
  ): EmployeeSignal => ({
    key,
    rank,
    severity,
    category: key === 'pending_approvals' ? 'approvals' : 'attendance',
    value: 2,
    unit: 'count',
    denominator: null,
    label: `2 ${key}`,
    detail: `${key} detail`
  });

  function setup(signals: readonly EmployeeSignal[]) {
    TestBed.configureTestingModule({ imports: [OverviewNeedsAttentionComponent] });
    const fixture = TestBed.createComponent(OverviewNeedsAttentionComponent);
    fixture.componentRef.setInput('signals', signals);
    fixture.detectChanges();
    return fixture;
  }

  it('renders nothing when there are no signals', () => {
    const fixture = setup([]);

    expect(fixture.nativeElement.querySelector('[data-testid="needs-attention"]')).toBeNull();
  });

  it('renders one row per signal in the given order with the item count', () => {
    const fixture = setup([
      signal('absent_days', 1, 'critical'),
      signal('pending_approvals', 9, 'info')
    ]);
    const rows = [...fixture.nativeElement.querySelectorAll('[data-testid="attention-row"]')];

    expect(rows.map((row: HTMLElement) => row.dataset['key'])).toEqual(['absent_days', 'pending_approvals']);
    expect(fixture.nativeElement.textContent).toContain('2 items');
  });

  it('shows four alerts initially and expands or collapses the full list on request', () => {
    const signals = [
      signal('absent_days', 1, 'critical'),
      signal('missing_clock_outs', 2, 'critical'),
      signal('late_clock_ins', 3, 'warning'),
      signal('early_clock_outs', 4, 'warning'),
      signal('over_break', 5, 'warning'),
      signal('pending_approvals', 6, 'info')
    ];
    const fixture = setup(signals);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelectorAll('[data-testid="attention-row"]')).toHaveLength(4);
    expect(el.textContent).toContain('6 items');

    const toggle = el.querySelector('[data-testid="attention-toggle"]') as HTMLButtonElement;
    expect(toggle.textContent?.trim()).toBe('View all');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    toggle.click();
    fixture.detectChanges();

    expect(el.querySelectorAll('[data-testid="attention-row"]')).toHaveLength(6);
    expect(toggle.textContent?.trim()).toBe('Show less');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    toggle.click();
    fixture.detectChanges();

    expect(el.querySelectorAll('[data-testid="attention-row"]')).toHaveLength(4);
    expect(toggle.textContent?.trim()).toBe('View all');
  });
});
