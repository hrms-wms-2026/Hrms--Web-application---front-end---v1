import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { TeamHubComponent } from './team-hub.component';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { LeaveBalanceStore } from '../../state/leave-balance.store';
import { LeaveApprovalStore } from '../../state/leave-approval.store';
import { LeaveTypeStore } from '../../state/leave-type.store';
import { NotificationService } from '../../../../core/services/notification.service';
import { signal } from '@angular/core';

describe('TeamHubComponent', () => {
  function emptyStores() {
    return [
      {
        provide: LeaveBalanceStore,
        useValue: {
          team: signal([]), teamLoading: signal(false), teamError: signal(null), teamFilters: signal({}),
          year: signal(2026), loadTeam: vi.fn(), setTeamFilters: vi.fn()
        }
      },
      {
        provide: LeaveApprovalStore,
        useValue: {
          pending: signal([]), pendingLoading: signal(false), pendingError: signal(null), pendingFilter: signal({}),
          all: signal([]), allLoading: signal(false), allError: signal(null), allFilter: signal({}),
          detail: signal(null), deciding: signal(false), decideError: signal(null), cancelling: signal(false), cancelDialogError: signal(null),
          loadPending: vi.fn(), setPendingFilter: vi.fn(), loadAll: vi.fn(), setAllFilter: vi.fn(),
          loadDetail: vi.fn(), clearDetail: vi.fn(), approve: vi.fn(), reject: vi.fn(), requestInfo: vi.fn(),
          bulkApprove: vi.fn(), bulkReject: vi.fn(), cancel: vi.fn()
        }
      },
      { provide: LeaveTypeStore, useValue: { items: signal([]), load: vi.fn() } },
      { provide: NotificationService, useValue: { success: vi.fn(), error: vi.fn() } }
    ];
  }

  async function setup(permissions: readonly string[]) {
    await TestBed.configureTestingModule({
      imports: [TeamHubComponent],
      providers: [
        ...emptyStores(),
        { provide: PermissionService, useValue: { hasPermission: (p: string) => permissions.includes(p) } }
      ]
    }).compileComponents();

    const fixture: ComponentFixture<TeamHubComponent> = TestBed.createComponent(TeamHubComponent);
    fixture.detectChanges();
    return { fixture };
  }

  it('shows all three tabs for a user with every team permission', async () => {
    const { fixture } = await setup(['leave:read-team', 'leave:approve', 'leave:read']);
    const tabs = fixture.nativeElement.querySelectorAll('[role="tab"]');
    expect(Array.from(tabs).map((tab: any) => tab.textContent.trim())).toEqual(['Balances', 'Pending Approvals', 'All Requests']);
  });

  it('shows only the Pending Approvals tab for an approve-only user, and defaults to it', async () => {
    const { fixture } = await setup(['leave:approve']);
    const tabs = fixture.nativeElement.querySelectorAll('[role="tab"]');
    expect(Array.from(tabs).map((tab: any) => tab.textContent.trim())).toEqual(['Pending Approvals']);
    expect(fixture.nativeElement.querySelector('app-pending-approvals')).toBeTruthy();
  });

  it('shows only the All Requests tab for a leave:read-only user, and defaults to it', async () => {
    const { fixture } = await setup(['leave:read']);
    const tabs = fixture.nativeElement.querySelectorAll('[role="tab"]');
    expect(Array.from(tabs).map((tab: any) => tab.textContent.trim())).toEqual(['All Requests']);
    expect(fixture.nativeElement.querySelector('app-requests-list')).toBeTruthy();
  });

  it('defaults to the Balances tab when the user has both read-team and approve', async () => {
    const { fixture } = await setup(['leave:read-team', 'leave:approve']);
    expect(fixture.nativeElement.querySelector('app-team-balances')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-pending-approvals')).toBeNull();
  });

  it('switches to All Requests when that tab is clicked', async () => {
    const { fixture } = await setup(['leave:read-team', 'leave:approve', 'leave:read']);
    const tabs = fixture.nativeElement.querySelectorAll('[role="tab"]');
    (Array.from(tabs).find((tab: any) => tab.textContent.trim() === 'All Requests') as HTMLElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-requests-list')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-team-balances')).toBeNull();
  });
});
