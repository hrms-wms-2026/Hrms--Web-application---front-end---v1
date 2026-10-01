import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeSignal } from '../../models/employee-overview.model';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { SignalDrilldownStore } from '../../state/signal-drilldown.store';
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

  const getItems = vi.fn((_: string, key: string) => of({ key, total: 1, timezone: null, items: [
    { kind: 'attendance_day' as const, id: '2026-09-02', date: '2026-09-02', title: 'Wed 2 Sep', subtitle: 'late', occurredAt: null,
      projectId: null, projectName: null, dueDate: null, approvalKind: null, requestedAt: null, approverName: null }
  ] }));

  function setup(signals: readonly EmployeeSignal[]) {
    TestBed.configureTestingModule({
      imports: [OverviewNeedsAttentionComponent],
      providers: [EmployeePeriodStore, SignalDrilldownStore, { provide: PeopleApiService, useValue: { getOverviewSignalItems: getItems } }]
    });
    TestBed.inject(EmployeePeriodStore).setMonth('2026-09');
    TestBed.inject(SignalDrilldownStore).setEmployee('emp-1');
    const fixture = TestBed.createComponent(OverviewNeedsAttentionComponent);
    fixture.componentRef.setInput('signals', signals);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => getItems.mockClear());

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

  it('shows three alerts initially and expands or collapses the full list on request', () => {
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

    expect(el.querySelectorAll('[data-testid="attention-row"]')).toHaveLength(3);
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

    expect(el.querySelectorAll('[data-testid="attention-row"]')).toHaveLength(3);
    expect(toggle.textContent?.trim()).toBe('View all');
  });

  it('expands the full list when the card is clicked anywhere', () => {
    const fixture = setup([
      signal('absent_days', 1, 'critical'),
      signal('missing_clock_outs', 2, 'critical'),
      signal('late_clock_ins', 3, 'warning'),
      signal('early_clock_outs', 4, 'warning'),
      signal('over_break', 5, 'warning')
    ]);
    const el = fixture.nativeElement as HTMLElement;

    (el.querySelector('[data-testid="needs-attention"]') as HTMLElement).click();
    fixture.detectChanges();

    expect(el.querySelectorAll('[data-testid="attention-row"]')).toHaveLength(5);
    expect(el.querySelector('[data-testid="attention-toggle"]')!.textContent?.trim()).toBe('Show less');
  });

  it('expands a row into its items and collapses it on a second click', async () => {
    const fixture = setup([signal('late_clock_ins', 4, 'warning')]);
    const row = fixture.nativeElement.querySelector('[data-testid="attention-row"]') as HTMLButtonElement;

    row.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(row.getAttribute('aria-expanded')).toBe('true');
    expect(getItems).toHaveBeenCalledWith('emp-1', 'late_clock_ins', '2026-09-01', '2026-09-30');
    expect(fixture.nativeElement.querySelector('app-signal-items-list')).toBeTruthy();

    row.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-signal-items-list')).toBeNull();
  });

  it('keeps only one row open', () => {
    const fixture = setup([signal('absent_days', 1, 'critical'), signal('late_clock_ins', 4, 'warning')]);
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="attention-row"]') as NodeListOf<HTMLButtonElement>;
    rows[0].click();
    rows[1].click();
    fixture.detectChanges();

    expect(rows[0].getAttribute('aria-expanded')).toBe('false');
    expect(rows[1].getAttribute('aria-expanded')).toBe('true');
    expect(fixture.nativeElement.querySelectorAll('app-signal-items-list')).toHaveLength(1);
  });

  it('switches to View all when a row beyond the first three is opened from outside', () => {
    const fixture = setup([
      signal('absent_days', 1, 'critical'), signal('missing_clock_outs', 2, 'critical'),
      signal('over_break', 3, 'warning'), signal('late_clock_ins', 4, 'warning')
    ]);
    TestBed.inject(SignalDrilldownStore).open('late_clock_ins');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-key="late_clock_ins"]')).toBeTruthy();
  });

  it('selecting an item stores it on the drill-down store', async () => {
    const fixture = setup([signal('late_clock_ins', 4, 'warning')]);
    (fixture.nativeElement.querySelector('[data-testid="attention-row"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('[data-testid="signal-item"]') as HTMLButtonElement).click();

    expect(TestBed.inject(SignalDrilldownStore).selected()?.item.id).toBe('2026-09-02');
  });
});
