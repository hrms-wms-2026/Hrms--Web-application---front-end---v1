import { TestBed } from '@angular/core/testing';
import { LeavePolicyDetail, LeavePolicyVersion } from '../../models/leave-policy.model';
import { LeavePolicyDetailPanelComponent } from './leave-policy-detail-panel.component';

function version(overrides: Partial<LeavePolicyVersion>): LeavePolicyVersion {
  return {
    id: 'v1', versionNumber: 1, effectiveFrom: '2026-01-01', isCurrent: true, isFuture: false,
    createdAt: '2026-01-01T00:00:00Z', createdByName: 'Asha Perera', amountHours: 8, amountPeriod: 'month',
    carryForwardCapHours: null, carryForwardExpiryMonths: 3, eligibleFrom: 'after_probation', eligibleAfterMonths: null,
    minimumNoticeDays: 7, minRequestHours: 1, maxRequestHours: null, maxTeamAbsencePercent: null,
    approvalMode: 'any_one', blackouts: [], ...overrides
  };
}

const policy: LeavePolicyDetail = {
  id: 'p1', name: 'Annual - standard', description: null, leaveTypeId: 't1', leaveTypeName: 'Annual Leave',
  leaveTypeColor: '#2563EB', isActive: true, current: version({}),
  versions: [version({ id: 'v2', versionNumber: 2, effectiveFrom: '2026-11-01', isCurrent: false, isFuture: true, amountHours: 10 }), version({})],
  assignments: [{ id: 'a1', targetKind: 'legal_entity', targetId: 'le1', targetName: 'Dapi Technologies', effectiveFrom: '2026-01-01' }]
};

describe('LeavePolicyDetailPanelComponent', () => {
  function render(canManage: boolean) {
    const fixture = TestBed.createComponent(LeavePolicyDetailPanelComponent);
    fixture.componentInstance.policy = policy;
    fixture.componentInstance.canManage = canManage;
    fixture.detectChanges();
    return fixture;
  }

  it('shows the current rules as plain facts in hours', () => {
    const text = render(true).nativeElement.textContent as string;
    expect(text).toContain('8 h / month');
    expect(text).toContain('All unused hours');
    expect(text).toContain('Expire after 3 months');
    expect(text).toContain('After probation');
    expect(text).toContain('Company: Dapi Technologies');
  });

  it('lists versions newest first and only lets scheduled ones be cancelled', () => {
    const fixture = render(true);
    const rows = Array.from(fixture.nativeElement.querySelectorAll('[data-testid="policy-version"]')) as HTMLElement[];
    expect(rows.map((r) => r.querySelector('strong')?.textContent?.trim())).toEqual(['v2', 'v1']);
    expect(rows[0].textContent).toContain('Scheduled');
    expect(rows[0].querySelector('[data-testid="cancel-version"]')).not.toBeNull();
    expect(rows[1].querySelector('[data-testid="cancel-version"]')).toBeNull();
  });

  it('emits the version to cancel', () => {
    const fixture = render(true);
    const emit = vi.spyOn(fixture.componentInstance.deleteVersion, 'emit');
    (fixture.nativeElement.querySelector('[data-testid="cancel-version"]') as HTMLButtonElement).click();
    expect(emit).toHaveBeenCalledWith('v2');
  });

  it('hides actions without manage access', () => {
    const fixture = render(false);
    expect(fixture.nativeElement.querySelector('[data-testid="cancel-version"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="edit-policy"]')).toBeNull();
  });
});
