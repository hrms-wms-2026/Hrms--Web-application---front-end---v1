import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { PeopleApiService } from '../../../people/data-access/people-api.service';
import { UserAccountApiService } from '../../data-access/user-account-api.service';
import { UserAccount } from '../../models/user-account.model';
import { UsersComponent } from './users.component';

const base: UserAccount = {
  userId: 'u-1',
  employeeId: 'e-1',
  fullName: 'Ada Lovelace',
  email: 'ada@example.com',
  status: 'active',
  roles: ['Employee'],
  lastLoginAt: '2026-10-15T09:00:00Z',
  invitationExpiresAt: null,
  suspendedAt: null,
  activeSessionCount: 1,
  activeDeviceCount: 1,
  isSelf: false,
  canSuspend: true,
  canReactivate: false,
  canSignOut: true,
  canManageSessions: true,
  canResendInvitation: false,
  canRevokeInvitation: false
};

const expiredInvite: UserAccount = {
  ...base,
  userId: 'u-2',
  employeeId: 'e-2',
  fullName: 'Grace Hopper',
  email: 'grace@example.com',
  status: 'invite_expired',
  lastLoginAt: null,
  activeSessionCount: 0,
  activeDeviceCount: 0,
  canSuspend: false,
  canSignOut: false,
  canManageSessions: false,
  canResendInvitation: true,
  canRevokeInvitation: true
};

function setup(permissions: readonly string[], users: readonly UserAccount[] = [base, expiredInvite]) {
  const api = {
    list: vi.fn().mockReturnValue(of(users)),
    suspend: vi.fn().mockReturnValue(of(undefined)),
    reactivate: vi.fn().mockReturnValue(of(undefined)),
    signOut: vi.fn().mockReturnValue(of({ endedCount: 2 })),
    sessions: vi.fn().mockReturnValue(of({ webSessions: [], trayDevices: [] })),
    revokeSession: vi.fn().mockReturnValue(of(undefined)),
    revokeDevice: vi.fn().mockReturnValue(of(undefined))
  };
  const peopleApi = {
    resendInvitation: vi.fn().mockReturnValue(of({ expiresAt: '2026-10-17T09:00:00Z' })),
    revokeInvitation: vi.fn().mockReturnValue(of(undefined))
  };
  const notifications = { success: vi.fn(), error: vi.fn() };

  TestBed.configureTestingModule({
    imports: [UsersComponent],
    providers: [
      provideRouter([]),
      { provide: UserAccountApiService, useValue: api },
      { provide: PeopleApiService, useValue: peopleApi },
      { provide: NotificationService, useValue: notifications },
      { provide: PermissionService, useValue: { hasPermission: (p: string) => permissions.includes(p) } }
    ]
  });

  const fixture = TestBed.createComponent(UsersComponent);
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance, api, peopleApi, notifications };
}

describe('UsersComponent', () => {
  it('lists every account with its status', () => {
    const { fixture } = setup(['users:read']);
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Ada Lovelace');
    expect(text).toContain('Grace Hopper');
    expect(text).toContain('Invite expired');
    expect(text).toContain('1 web · 1 tray');
  });

  it('is read-only with users:read alone', () => {
    const { fixture, component } = setup(['users:read']);

    expect(component.menuFor(base)).toEqual([]);
    expect(fixture.nativeElement.querySelector('[data-testid="user-actions-u-1"]')).toBeNull();
  });

  it('offers only the actions the account state allows to users:manage', () => {
    const { component } = setup(['users:read', 'users:manage']);

    expect(component.menuFor(base).map((i) => i.id)).toEqual(['sessions', 'sign-out', 'suspend']);
    expect(component.menuFor(expiredInvite).map((i) => i.id)).toEqual(['resend', 'revoke']);
  });

  it('suspends only after confirmation, then reloads', () => {
    const { component, api, notifications } = setup(['users:manage']);

    component.onAction(base, 'suspend');
    expect(api.suspend).not.toHaveBeenCalled();
    expect(component.confirmTitle()).toBe('Suspend user?');

    component.confirmPending();
    expect(api.suspend).toHaveBeenCalledWith('u-1');
    expect(notifications.success).toHaveBeenCalledWith('Ada Lovelace suspended.');
    expect(component.pending()).toBeNull();
    expect(api.list).toHaveBeenCalledTimes(2);
  });

  it('resends an invitation straight away through the employee endpoint', () => {
    const { component, peopleApi } = setup(['users:manage']);

    component.onAction(expiredInvite, 'resend');

    expect(peopleApi.resendInvitation).toHaveBeenCalledWith('e-2');
  });

  it('revokes an invitation after confirmation', () => {
    const { component, peopleApi } = setup(['users:manage']);

    component.onAction(expiredInvite, 'revoke');
    component.confirmPending();

    expect(peopleApi.revokeInvitation).toHaveBeenCalledWith('e-2');
  });

  it('filters by status, role and search from the header controls', () => {
    const { fixture, component } = setup(['users:read']);

    component.onFilterChanged({ key: 'statuses', values: ['invite_expired'] });
    expect(component.visibleUsers().map((u) => u.userId)).toEqual(['u-2']);

    component.filters.set({ statuses: [], roles: [] });
    component.onFilterChanged({ key: 'roles', values: ['Employee'] });
    expect(component.visibleUsers().map((u) => u.userId)).toEqual(['u-1', 'u-2']);

    component.filters.set({ statuses: [], roles: [] });
    (fixture.nativeElement.querySelector('[data-testid="users-search-toggle"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('[data-testid="users-search"]') as HTMLInputElement;
    input.value = 'ada@';
    input.dispatchEvent(new Event('input'));
    expect(component.visibleUsers().map((u) => u.userId)).toEqual(['u-1']);

    component.toggleSearch();
    expect(component.search()).toBe('');
  });

  it('offers Status options with live counts and the roles that exist', () => {
    const { component } = setup(['users:read']);
    const [status, role] = component.filterFields();

    expect(status.options.find((o) => o.value === 'active')?.label).toBe('Active (1)');
    expect(role.options.map((o) => o.value)).toEqual(['Employee']);
  });

  it('puts the breadcrumb in the shared sticky page header', () => {
    const { fixture } = setup(['users:read']);

    expect(fixture.nativeElement.querySelector('header.app-page-header app-breadcrumb-header')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('header.app-page-header app-task-filter-bar')).not.toBeNull();
  });

  it('opens the sessions panel from the menu or the "Signed in on" link, even read-only', () => {
    const { fixture, component, api } = setup(['users:read']);

    (fixture.nativeElement.querySelector('[data-testid="user-sessions-u-1"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(component.sessionsUser()?.userId).toBe('u-1');
    expect(api.sessions).toHaveBeenCalledWith('u-1');

    component.sessionsUser.set(null);
    component.onAction(base, 'sessions');
    expect(component.sessionsUser()?.userId).toBe('u-1');
  });
});
