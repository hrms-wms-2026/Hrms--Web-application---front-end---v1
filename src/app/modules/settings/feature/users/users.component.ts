import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { toSafeErrorMessage } from '../../../../core/services/error-handler.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { BreadcrumbHeaderComponent } from '../../../../shared/ui/breadcrumb-header/breadcrumb-header.component';
import { ConfirmModalComponent } from '../../../../shared/ui/confirm-modal/confirm-modal.component';
import { DataTableCellDirective, DataTableColumn, DataTableComponent, DataTableFilterValues, withColumnFilters } from '../../../../shared/ui/data-table/data-table.component';
import { DropdownMenuComponent, MenuItem } from '../../../../shared/ui/dropdown-menu/dropdown-menu.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { PeopleApiService } from '../../../people/data-access/people-api.service';
import { TaskFilterBarComponent, TaskFilterFieldConfig } from '../../../work/ui/task-filter-bar/task-filter-bar.component';
import { UserAccountApiService } from '../../data-access/user-account-api.service';
import { UserSessionsModalComponent } from '../../ui/user-sessions-modal/user-sessions-modal.component';
import { UserAccount, UserAccountStatus } from '../../models/user-account.model';

type UserAction = 'sessions' | 'resend' | 'revoke' | 'suspend' | 'reactivate' | 'sign-out';

const STATUS_LABELS: Record<UserAccountStatus, string> = {
  active: 'Active',
  suspended: 'Suspended',
  invited: 'Invited',
  invite_expired: 'Invite expired',
  invite_revoked: 'Invite revoked',
  offboarded: 'Offboarded',
  inactive: 'Inactive'
};

const STATUS_CLASSES: Record<UserAccountStatus, string> = {
  active: 'bg-[color-mix(in_srgb,var(--color-success)_15%,transparent)] text-[var(--color-success)]',
  suspended: 'bg-[color-mix(in_srgb,var(--color-danger-text)_15%,transparent)] text-[var(--color-danger-text)]',
  invited: 'bg-[color-mix(in_srgb,var(--color-accent)_15%,transparent)] text-[var(--color-accent)]',
  invite_expired: 'bg-[color-mix(in_srgb,var(--color-warning-text)_15%,transparent)] text-[var(--color-warning-text)]',
  invite_revoked: 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]',
  offboarded: 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]',
  inactive: 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]'
};

const STATUS_ORDER: readonly UserAccountStatus[] = [
  'active', 'invited', 'invite_expired', 'invite_revoked', 'suspended', 'offboarded', 'inactive'
];

/** Filter values: status codes and role names, keyed like app-task-filter-bar's fields. */
interface UserFilters { readonly statuses: readonly string[]; readonly roles: readonly string[] }
const NO_FILTERS: UserFilters = { statuses: [], roles: [] };

const CONFIRM_COPY: Record<'revoke' | 'suspend' | 'sign-out', { title: string; label: string; message: (u: UserAccount) => string }> = {
  revoke: {
    title: 'Revoke invitation?',
    label: 'Revoke',
    message: (u) => `The invitation link sent to ${u.email} will stop working and the reserved position is released.`
  },
  suspend: {
    title: 'Suspend user?',
    label: 'Suspend',
    message: (u) => `${u.fullName} will be signed out everywhere and can't sign in until reactivated.`
  },
  'sign-out': {
    title: 'Sign out everywhere?',
    label: 'Sign out',
    message: (u) => `${u.fullName} will be signed out of the web app and the tray app. They can sign in again.`
  }
};

/**
 * Settings > Users: every user account in the tenant (users:read) with suspend / reactivate /
 * sign-out, revoking a single browser or tray sign-in (sessions panel), and invitation resend /
 * revoke (users:manage). The person who added an employee can
 * still resend or revoke that one invitation from the employee detail screen without this page.
 */
@Component({
  selector: 'app-users',
  standalone: true,
  imports: [
    DatePipe,
    AvatarComponent,
    BreadcrumbHeaderComponent,
    ConfirmModalComponent,
    DataTableComponent,
    DataTableCellDirective,
    DropdownMenuComponent,
    ErrorStateComponent,
    TaskFilterBarComponent,
    UserSessionsModalComponent
  ],
  template: `
    <!-- Same sticky breadcrumb header, expanding search and Filter button as People > Employees. -->
    <header class="app-page-header">
      <div class="users-header-row">
        <app-breadcrumb-header class="users-header-breadcrumb" parentLabel="Settings" currentLabel="Users" icon="settings" />

        <div class="users-controls">
          <div class="users-search-container">
            @if (searchExpanded()) {
              <div class="users-search-expandable ui-field ui-field--sm">
                <span class="ui-field__addon" aria-hidden="true"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg></span>
                <input
                  type="text"
                  class="ui-field__control"
                  placeholder="Search by name or email..."
                  aria-label="Search users"
                  data-testid="users-search"
                  [value]="search()"
                  (input)="search.set($any($event.target).value)"
                />
                <span class="ui-field__trailing"><button type="button" class="ui-field__icon-btn" (click)="toggleSearch()" title="Close search" aria-label="Close search">
                  &times;
                </button></span>
              </div>
            } @else {
              <button
                type="button"
                class="users-icon-btn"
                [class.users-icon-btn--active]="search()"
                data-testid="users-search-toggle"
                (click)="toggleSearch()"
                title="Search users"
                aria-label="Search users"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
              </button>
            }
          </div>

          <app-task-filter-bar
            [fields]="filterFields()"
            [values]="filterValues()"
            [emitFieldChangedOnClear]="false"
            (fieldChanged)="onFilterChanged($event)"
            (allCleared)="filters.set(noFilters)"
          />
        </div>
      </div>
    </header>

    @if (error(); as errorMessage) {
      <app-error-state [message]="errorMessage" [retryable]="true" (retry)="load()" />
    } @else {
      <app-data-table
        class="block"
        [columns]="tableColumns()"
        [rows]="visibleUsers()"
        [filterValues]="headerFilterValues()"
        (filterChanged)="onFilterChanged({ key: $event.key === 'status' ? 'statuses' : $event.key, values: $event.values })"
        [trackBy]="trackById"
        [loading]="loading()"
        loadingLabel="Loading users…"
        caption="User accounts"
        emptyMessage="No users match"
        emptyDescription="Try a different filter or search."
        [rowMuted]="isMuted"
        [busyRowId]="actingId()"
      >
        <ng-template appDataTableCell="user" let-user>
          <div class="flex min-w-0 items-center gap-3">
            <app-avatar size="sm" [userName]="user.fullName" [email]="user.email" />
            <div class="min-w-0">
              <div class="truncate font-medium text-[var(--color-text-primary)]">
                {{ user.fullName }}
                @if (user.isSelf) {
                  <span class="text-xs font-normal text-[var(--color-text-secondary)]">(you)</span>
                }
              </div>
              <div class="truncate text-xs text-[var(--color-text-secondary)]">{{ user.email }}</div>
            </div>
          </div>
        </ng-template>
        <ng-template appDataTableCell="roles" let-user>{{ user.roles.length ? user.roles.join(', ') : '—' }}</ng-template>
        <ng-template appDataTableCell="status" let-user>
          <span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium" [class]="statusClass(user.status)" [attr.data-testid]="'user-status-' + user.userId">
            {{ statusLabel(user.status) }}
          </span>
          @if (user.status === 'invited' && user.invitationExpiresAt) {
            <div class="mt-1 text-xs text-[var(--color-text-secondary)]">Expires {{ user.invitationExpiresAt | date: 'MMM d, h:mm a' }}</div>
          }
        </ng-template>
        <ng-template appDataTableCell="lastLogin" let-user>{{ user.lastLoginAt ? (user.lastLoginAt | date: 'MMM d, y, h:mm a') : 'Never' }}</ng-template>
        <ng-template appDataTableCell="sessions" let-user>
          @if (user.activeSessionCount + user.activeDeviceCount > 0) {
            <button type="button" class="users-sessions-link" [attr.data-testid]="'user-sessions-' + user.userId" (click)="sessionsUser.set(user)">
              {{ sessionsLabel(user) }}
            </button>
          } @else {
            —
          }
        </ng-template>
        <ng-template appDataTableCell="actions" let-user>
          @let items = menuFor(user);
          @if (items.length) {
            <app-dropdown-menu [items]="items" ariaLabel="User actions" (selected)="onAction(user, $any($event))">
              <button menu-trigger type="button" class="users-kebab" [attr.data-testid]="'user-actions-' + user.userId" aria-label="User actions">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h.01M12 12h.01M19 12h.01" /></svg>
              </button>
            </app-dropdown-menu>
          }
        </ng-template>
      </app-data-table>
    }

    <app-user-sessions-modal
      [user]="sessionsUser()"
      [canManage]="canManage()"
      (closed)="sessionsUser.set(null)"
      (changed)="load()"
    />

    <app-confirm-modal
      [open]="!!pending()"
      [title]="confirmTitle()"
      [message]="confirmMessage()"
      [confirmLabel]="confirmLabel()"
      cancelLabel="Cancel"
      [loading]="!!pending() && actingId() === pending()!.user.userId"
      (confirmed)="confirmPending()"
      (cancelled)="pending.set(null)"
    />
  `,
  styles: [
    `
      .users-header-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        width: 100%;
        min-height: 36px;
      }
      .users-header-breadcrumb {
        display: inline-flex;
        align-items: center;
        flex-shrink: 0;
      }
      .users-header-row ::ng-deep .bh-header-bar {
        display: flex !important;
        align-items: center !important;
        margin-bottom: 0 !important;
        padding-bottom: 0 !important;
        border-bottom: none !important;
      }
      .users-controls {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-left: auto;
      }
      .users-search-container,
      .users-search-expandable {
        position: relative;
        display: flex;
        align-items: center;
      }
      .users-search-expandable {
        width: 260px;
        animation: usersSearchExpand 0.15s ease-out;
      }
      @keyframes usersSearchExpand {
        from { opacity: 0; width: 30px; }
        to { opacity: 1; width: 260px; }
      }
      .users-icon-btn {
        width: 32px;
        height: 32px;
        border-radius: 6px;
        border: 1px solid var(--color-border);
        background: var(--color-surface);
        color: var(--color-text-secondary);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
      }
      .users-icon-btn:hover {
        background: var(--color-surface-secondary);
        color: var(--color-text-primary);
      }
      .users-icon-btn--active {
        background: var(--color-accent-subtle);
        color: var(--color-accent);
        border-color: var(--color-accent);
      }
      @media (max-width: 640px) {
        .users-header-row { flex-wrap: wrap; }
        .users-search-input { width: min(260px, 60vw); }
      }
      .users-sessions-link {
        color: var(--color-accent);
        font-size: inherit;
        text-decoration: underline;
        text-decoration-color: color-mix(in srgb, var(--color-accent) 35%, transparent);
        text-underline-offset: 3px;
        cursor: pointer;
      }
      .users-kebab {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        border-radius: 8px;
        color: var(--color-text-secondary);
        cursor: pointer;
      }
      .users-kebab:hover {
        background: var(--color-surface-secondary);
        color: var(--color-text-primary);
      }
      .users-kebab svg {
        width: 18px;
        height: 18px;
        fill: none;
        stroke: currentColor;
        stroke-width: 3;
        stroke-linecap: round;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UsersComponent {
  private readonly api = inject(UserAccountApiService);
  private readonly peopleApi = inject(PeopleApiService);
  private readonly notifications = inject(NotificationService);
  private readonly permissions = inject(PermissionService);

  protected readonly noFilters = NO_FILTERS;
  protected readonly trackById = (user: UserAccount): string => user.userId;
  protected readonly isMuted = (user: UserAccount): boolean =>
    user.status === 'offboarded' || user.status === 'inactive' || user.status === 'invite_revoked';

  /** users:read alone is a read-only view; every action needs users:manage. */
  readonly canManage = computed(() => this.permissions.hasPermission('users:manage'));

  /** Table columns, with the Roles and Status headers offering the filter bar's Role and Status filters. */
  readonly tableColumns = computed(() => {
    const [statusField, roleField] = this.filterFields();
    return withColumnFilters(this.columns(), {
      status: { kind: 'multi', options: statusField.options },
      roles: { kind: 'multi', options: roleField.options }
    });
  });
  readonly headerFilterValues = computed<DataTableFilterValues>(() => ({ status: this.filters().statuses, roles: this.filters().roles }));

  readonly columns = computed<readonly DataTableColumn[]>(() => [
    { key: 'user', label: 'User', width: '30%' },
    { key: 'roles', label: 'Roles', wrap: true },
    { key: 'status', label: 'Status' },
    { key: 'lastLogin', label: 'Last sign-in' },
    { key: 'sessions', label: 'Signed in on', interactive: true },
    // A fixed width: the User column's width switches the table to a fixed layout, where a
    // "shrink" (1%) column is too narrow and the menu button spills outside the row.
    ...(this.canManage() ? [{ key: 'actions', label: '', interactive: true, width: '56px' }] : [])
  ]);

  readonly users = signal<readonly UserAccount[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly actingId = signal<string | null>(null);
  readonly filters = signal<UserFilters>(NO_FILTERS);
  readonly search = signal('');
  readonly searchExpanded = signal(false);
  /** The account whose sessions panel is open. */
  readonly sessionsUser = signal<UserAccount | null>(null);
  readonly pending = signal<{ user: UserAccount; action: 'revoke' | 'suspend' | 'sign-out' } | null>(null);

  /** Status options carry a live count; roles come from the accounts actually loaded. */
  readonly filterFields = computed<readonly TaskFilterFieldConfig[]>(() => {
    const users = this.users();
    const roles = [...new Set(users.flatMap((u) => u.roles))].sort((a, b) => a.localeCompare(b));
    return [
      {
        key: 'statuses',
        label: 'Status',
        icon: 'status',
        kind: 'multi',
        options: STATUS_ORDER.map((status) => ({
          value: status,
          label: `${STATUS_LABELS[status]} (${users.filter((u) => u.status === status).length})`
        }))
      },
      { key: 'roles', label: 'Role', icon: 'people', kind: 'multi', options: roles.map((r) => ({ value: r, label: r })) }
    ];
  });

  readonly filterValues = computed<Record<string, readonly string[]>>(() => {
    const f = this.filters();
    const values: Record<string, readonly string[]> = {};
    if (f.statuses.length) values['statuses'] = f.statuses;
    if (f.roles.length) values['roles'] = f.roles;
    return values;
  });

  readonly visibleUsers = computed(() => {
    const { statuses, roles } = this.filters();
    const term = this.search().trim().toLowerCase();
    return this.users().filter(
      (u) =>
        (statuses.length === 0 || statuses.includes(u.status)) &&
        (roles.length === 0 || u.roles.some((r) => roles.includes(r))) &&
        (!term || u.fullName.toLowerCase().includes(term) || u.email.toLowerCase().includes(term))
    );
  });

  readonly confirmTitle = computed(() => {
    const p = this.pending();
    return p ? CONFIRM_COPY[p.action].title : '';
  });
  readonly confirmLabel = computed(() => {
    const p = this.pending();
    return p ? CONFIRM_COPY[p.action].label : 'Confirm';
  });
  readonly confirmMessage = computed(() => {
    const p = this.pending();
    return p ? CONFIRM_COPY[p.action].message(p.user) : '';
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.list().subscribe({
      next: (users) => {
        this.users.set(users);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(toSafeErrorMessage(err, 'Could not load users.'));
      }
    });
  }

  toggleSearch(): void {
    this.searchExpanded.update((open) => !open);
    if (!this.searchExpanded()) this.search.set('');
  }

  onFilterChanged(change: { key: string; values: string[] }): void {
    if (change.key === 'statuses' || change.key === 'roles') {
      this.filters.update((f) => ({ ...f, [change.key]: change.values }));
    }
  }

  statusLabel(status: UserAccountStatus): string {
    return STATUS_LABELS[status];
  }

  statusClass(status: UserAccountStatus): string {
    return STATUS_CLASSES[status];
  }

  sessionsLabel(user: UserAccount): string {
    const parts: string[] = [];
    if (user.activeSessionCount) parts.push(`${user.activeSessionCount} web`);
    if (user.activeDeviceCount) parts.push(`${user.activeDeviceCount} tray`);
    return parts.length ? parts.join(' · ') : '—';
  }

  menuFor(user: UserAccount): MenuItem[] {
    if (!this.canManage()) return [];
    const items: MenuItem[] = [];
    if (user.canManageSessions) items.push({ id: 'sessions', label: 'Manage sessions' });
    if (user.canResendInvitation) items.push({ id: 'resend', label: 'Resend invitation' });
    if (user.canRevokeInvitation) items.push({ id: 'revoke', label: 'Revoke invitation', danger: true });
    if (user.canReactivate) items.push({ id: 'reactivate', label: 'Reactivate' });
    if (user.canSignOut) items.push({ id: 'sign-out', label: 'Sign out everywhere' });
    if (user.canSuspend) items.push({ id: 'suspend', label: 'Suspend', danger: true });
    return items;
  }

  onAction(user: UserAccount, action: UserAction): void {
    if (action === 'sessions') {
      this.sessionsUser.set(user);
      return;
    }
    if (action === 'resend' || action === 'reactivate') {
      this.run(user, action);
      return;
    }
    this.pending.set({ user, action });
  }

  confirmPending(): void {
    const p = this.pending();
    if (p) this.run(p.user, p.action);
  }

  private run(user: UserAccount, action: UserAction): void {
    const request = this.requestFor(user, action);
    if (!request) return;

    this.actingId.set(user.userId);
    request.call.subscribe({
      next: () => {
        this.actingId.set(null);
        this.pending.set(null);
        this.notifications.success(request.success);
        this.load();
      },
      error: (err) => {
        this.actingId.set(null);
        this.notifications.error(toSafeErrorMessage(err, request.failure));
      }
    });
  }

  private requestFor(user: UserAccount, action: UserAction): { call: Observable<unknown>; success: string; failure: string } | null {
    switch (action) {
      case 'resend':
        return user.employeeId
          ? { call: this.peopleApi.resendInvitation(user.employeeId), success: 'Invitation resent.', failure: 'Could not resend the invitation.' }
          : null;
      case 'revoke':
        return user.employeeId
          ? { call: this.peopleApi.revokeInvitation(user.employeeId), success: 'Invitation revoked.', failure: 'Could not revoke the invitation.' }
          : null;
      case 'suspend':
        return { call: this.api.suspend(user.userId), success: `${user.fullName} suspended.`, failure: 'Could not suspend this user.' };
      case 'reactivate':
        return { call: this.api.reactivate(user.userId), success: `${user.fullName} reactivated.`, failure: 'Could not reactivate this user.' };
      case 'sessions':
        return null;
      case 'sign-out':
        return { call: this.api.signOut(user.userId), success: `${user.fullName} signed out everywhere.`, failure: 'Could not sign this user out.' };
    }
  }
}
