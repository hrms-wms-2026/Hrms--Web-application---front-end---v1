export type UserAccountStatus =
  | 'active'
  | 'suspended'
  | 'invited'
  | 'invite_expired'
  | 'invite_revoked'
  | 'offboarded'
  | 'inactive';

/**
 * A row on Settings > Users (GET /api/v1/users). The can* flags say what the account's state
 * allows; the screen also requires users:manage before offering any of them.
 */
export interface UserAccount {
  readonly userId: string;
  readonly employeeId: string | null;
  readonly fullName: string;
  readonly email: string;
  readonly status: UserAccountStatus;
  readonly roles: readonly string[];
  readonly lastLoginAt: string | null;
  readonly invitationExpiresAt: string | null;
  readonly suspendedAt: string | null;
  readonly activeSessionCount: number;
  readonly activeDeviceCount: number;
  readonly isSelf: boolean;
  readonly canSuspend: boolean;
  readonly canReactivate: boolean;
  readonly canSignOut: boolean;
  /** Has a web session or tray device that can be revoked on its own (not counting your current one). */
  readonly canManageSessions: boolean;
  readonly canResendInvitation: boolean;
  readonly canRevokeInvitation: boolean;
}

export interface SignOutUserAccountResponse {
  readonly endedCount: number;
}

/** One signed-in browser (GET /api/v1/users/{id}/sessions). */
export interface UserWebSession {
  readonly id: string;
  /** "Chrome on Windows" - best effort from the user agent. */
  readonly device: string;
  readonly ipAddress: string;
  readonly startedAt: string;
  readonly lastActivityAt: string;
  readonly expiresAt: string;
  /** The session you are using right now - can't be revoked here. */
  readonly isCurrent: boolean;
}

/** One connected tray app install. */
export interface UserTrayDevice {
  readonly id: string;
  readonly deviceName: string;
  readonly deviceOs: string;
  readonly activatedAt: string;
  readonly lastSeenAt: string | null;
}

export interface UserAccountSessions {
  readonly webSessions: readonly UserWebSession[];
  readonly trayDevices: readonly UserTrayDevice[];
}
