import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { NotificationService } from '../../../../core/services/notification.service';
import { UserAccountApiService } from '../../data-access/user-account-api.service';
import { UserAccount, UserAccountSessions } from '../../models/user-account.model';
import { UserSessionsModalComponent } from './user-sessions-modal.component';

const user = { userId: 'u-1', fullName: 'Ada Lovelace' } as UserAccount;

const data: UserAccountSessions = {
  webSessions: [
    { id: 's-current', device: 'Chrome on Windows', ipAddress: '10.0.0.1', startedAt: '2026-10-15T08:00:00Z', lastActivityAt: '2026-10-15T09:00:00Z', expiresAt: '2026-11-14T08:00:00Z', isCurrent: true },
    { id: 's-other', device: 'Safari on macOS', ipAddress: '10.0.0.2', startedAt: '2026-10-14T08:00:00Z', lastActivityAt: '2026-10-14T12:00:00Z', expiresAt: '2026-11-13T08:00:00Z', isCurrent: false }
  ],
  trayDevices: [{ id: 'd-1', deviceName: 'DAPI-LAPTOP', deviceOs: 'Windows 11', activatedAt: '2026-10-10T08:00:00Z', lastSeenAt: '2026-10-15T09:00:00Z' }]
};

function setup(canManage: boolean) {
  const api = {
    sessions: vi.fn().mockReturnValue(of(data)),
    revokeSession: vi.fn().mockReturnValue(of(undefined)),
    revokeDevice: vi.fn().mockReturnValue(of(undefined))
  };
  const notifications = { success: vi.fn(), error: vi.fn() };
  TestBed.configureTestingModule({
    imports: [UserSessionsModalComponent],
    providers: [
      { provide: UserAccountApiService, useValue: api },
      { provide: NotificationService, useValue: notifications }
    ]
  });
  const fixture = TestBed.createComponent(UserSessionsModalComponent);
  fixture.componentRef.setInput('user', user);
  fixture.componentRef.setInput('canManage', canManage);
  fixture.detectChanges();
  const changed = vi.fn();
  fixture.componentInstance.changed.subscribe(changed);
  return { fixture, api, notifications, changed };
}

const q = (root: HTMLElement, id: string) => document.querySelector(`[data-testid="${id}"]`) ?? root.querySelector(`[data-testid="${id}"]`);

describe('UserSessionsModalComponent', () => {
  it('lists each browser and tray app separately', () => {
    const { fixture, api } = setup(true);
    const text = document.body.textContent ?? '';

    expect(api.sessions).toHaveBeenCalledWith('u-1');
    expect(text).toContain('Chrome on Windows');
    expect(text).toContain('This session');
    expect(text).toContain('Safari on macOS');
    expect(text).toContain('DAPI-LAPTOP');
    expect(q(fixture.nativeElement, 'revoke-session-s-other')).not.toBeNull();
    // Your own current session is ended with Sign out, not from here.
    expect(q(fixture.nativeElement, 'revoke-session-s-current')).toBeNull();
  });

  it('revokes just one session and leaves the rest', () => {
    const { fixture, api, notifications, changed } = setup(true);

    fixture.componentInstance.revokeSession('s-other');

    expect(api.revokeSession).toHaveBeenCalledWith('u-1', 's-other');
    expect(api.revokeDevice).not.toHaveBeenCalled();
    expect(notifications.success).toHaveBeenCalledWith('Browser session revoked.');
    expect(changed).toHaveBeenCalled();
    expect(api.sessions).toHaveBeenCalledTimes(2);
  });

  it('disconnects one tray device', () => {
    const { fixture, api } = setup(true);

    fixture.componentInstance.revokeDevice('d-1');

    expect(api.revokeDevice).toHaveBeenCalledWith('u-1', 'd-1');
  });

  it('is read-only without users:manage', () => {
    const { fixture } = setup(false);

    expect(q(fixture.nativeElement, 'revoke-session-s-other')).toBeNull();
    expect(q(fixture.nativeElement, 'revoke-device-d-1')).toBeNull();
  });
});
