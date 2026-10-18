import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { Observable } from 'rxjs';
import { toSafeErrorMessage } from '../../../../core/services/error-handler.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { UserAccountApiService } from '../../data-access/user-account-api.service';
import { UserAccount, UserAccountSessions } from '../../models/user-account.model';

/**
 * Every browser and tray app one user is signed in on, each with its own Revoke - so one of two
 * sign-ins can be ended while the other keeps working. Read-only without users:manage. Your own
 * current session is marked "This session" and can't be revoked here (use Sign out).
 */
@Component({
  selector: 'app-user-sessions-modal',
  standalone: true,
  imports: [DatePipe, ButtonComponent, ErrorStateComponent, LoaderComponent, ModalComponent],
  template: `
    <app-modal
      [open]="!!user()"
      [title]="'Sessions — ' + (user()?.fullName ?? '')"
      subtitle="Where this account is signed in right now."
      icon="device"
      size="lg"
      (closed)="closed.emit()"
    >
      @if (loading()) {
        <app-loader label="Loading sessions…" />
      } @else if (error(); as errorMessage) {
        <app-error-state [message]="errorMessage" [retryable]="true" (retry)="load()" />
      } @else if (sessions(); as data) {
        <section class="us-section">
          <h3 class="us-heading">Web browsers <span class="us-count">{{ data.webSessions.length }}</span></h3>
          @for (session of data.webSessions; track session.id) {
            <div class="us-row" [attr.data-testid]="'web-session-' + session.id">
              <div class="min-w-0">
                <div class="us-title">
                  {{ session.device }}
                  @if (session.isCurrent) {
                    <span class="us-badge">This session</span>
                  }
                </div>
                <div class="us-meta">
                  {{ session.ipAddress || 'Unknown IP' }} · Signed in {{ session.startedAt | date: 'MMM d, h:mm a' }} · Last active {{ session.lastActivityAt | date: 'MMM d, h:mm a' }}
                </div>
              </div>
              @if (canManage() && !session.isCurrent) {
                <app-button
                  variant="secondary"
                  [attr.data-testid]="'revoke-session-' + session.id"
                  [loading]="revokingId() === session.id"
                  [disabled]="!!revokingId()"
                  (pressed)="revokeSession(session.id)"
                >
                  Revoke
                </app-button>
              }
            </div>
          } @empty {
            <p class="us-empty">Not signed in on any browser.</p>
          }
        </section>

        <section class="us-section">
          <h3 class="us-heading">Tray app <span class="us-count">{{ data.trayDevices.length }}</span></h3>
          @for (device of data.trayDevices; track device.id) {
            <div class="us-row" [attr.data-testid]="'tray-device-' + device.id">
              <div class="min-w-0">
                <div class="us-title">{{ device.deviceName || 'Unnamed device' }}</div>
                <div class="us-meta">
                  {{ device.deviceOs || 'Unknown OS' }} · Connected {{ device.activatedAt | date: 'MMM d, y' }}
                  @if (device.lastSeenAt) {
                    · Last seen {{ device.lastSeenAt | date: 'MMM d, h:mm a' }}
                  }
                </div>
              </div>
              @if (canManage()) {
                <app-button
                  variant="secondary"
                  [attr.data-testid]="'revoke-device-' + device.id"
                  [loading]="revokingId() === device.id"
                  [disabled]="!!revokingId()"
                  (pressed)="revokeDevice(device.id)"
                >
                  Revoke
                </app-button>
              }
            </div>
          } @empty {
            <p class="us-empty">No tray app connected.</p>
          }
        </section>

        <p class="us-note">
          A revoked browser is signed out on its next request. A revoked tray app disconnects when its current sign-in token runs out (up to an hour).
        </p>
      }
    </app-modal>
  `,
  styles: [
    `
      .us-section + .us-section {
        margin-top: 20px;
      }
      .us-heading {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
        font-size: 13px;
        font-weight: 600;
        color: var(--color-text-primary);
      }
      .us-count {
        font-size: 12px;
        font-weight: 500;
        color: var(--color-text-secondary);
      }
      .us-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 12px 14px;
        border: 1px solid var(--color-border);
        border-radius: 10px;
      }
      .us-row + .us-row {
        margin-top: 8px;
      }
      .us-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        font-weight: 500;
        color: var(--color-text-primary);
      }
      .us-badge {
        padding: 1px 8px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 500;
        color: var(--color-accent);
        background: color-mix(in srgb, var(--color-accent) 12%, transparent);
      }
      .us-meta {
        margin-top: 2px;
        font-size: 12px;
        color: var(--color-text-secondary);
      }
      .us-empty,
      .us-note {
        font-size: 13px;
        color: var(--color-text-secondary);
      }
      .us-note {
        margin-top: 16px;
        font-size: 12px;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserSessionsModalComponent {
  private readonly api = inject(UserAccountApiService);
  private readonly notifications = inject(NotificationService);

  /** The account whose sessions are shown; null keeps the modal closed. */
  readonly user = input<UserAccount | null>(null);
  readonly canManage = input(false);
  readonly closed = output<void>();
  /** A session or device was revoked - the parent refreshes its counts. */
  readonly changed = output<void>();

  readonly sessions = signal<UserAccountSessions | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly revokingId = signal<string | null>(null);

  constructor() {
    effect(() => {
      const user = this.user();
      untracked(() => {
        this.sessions.set(null);
        if (user) this.load();
      });
    });
  }

  load(): void {
    const user = this.user();
    if (!user) return;
    this.loading.set(true);
    this.error.set(null);
    this.api.sessions(user.userId).subscribe({
      next: (data) => {
        this.sessions.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(toSafeErrorMessage(err, 'Could not load sessions.'));
      }
    });
  }

  revokeSession(sessionId: string): void {
    const user = this.user();
    if (user) this.revoke(sessionId, this.api.revokeSession(user.userId, sessionId), 'Browser session revoked.');
  }

  revokeDevice(deviceId: string): void {
    const user = this.user();
    if (user) this.revoke(deviceId, this.api.revokeDevice(user.userId, deviceId), 'Tray app disconnected.');
  }

  private revoke(id: string, call: Observable<void>, success: string): void {
    this.revokingId.set(id);
    call.subscribe({
      next: () => {
        this.revokingId.set(null);
        this.notifications.success(success);
        this.changed.emit();
        this.load();
      },
      error: (err) => {
        this.revokingId.set(null);
        this.notifications.error(toSafeErrorMessage(err, 'Could not revoke this sign-in.'));
      }
    });
  }
}
