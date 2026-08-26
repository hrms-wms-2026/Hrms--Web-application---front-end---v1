import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, OnDestroy, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BreadcrumbHeaderComponent } from '../../../../shared/ui/breadcrumb-header/breadcrumb-header.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ActivationApiService } from '../../data-access/activation-api.service';

const COPIED_RESET_MS = 1500;

/**
 * Settings → Devices — self-service activation code for the OneXso Workspace desktop app.
 * Generates a code via ActivationApiService, scoped to the logged-in employee's own account.
 * No device list/revoke UI here — MonitoringActivationController has no list-devices
 * endpoint yet; that is a separate backend + frontend effort (see design spec).
 *
 * Error handling: the global error interceptor + ErrorHandlerService already show a banner
 * notification for every HTTP failure status (429, 5xx, etc. — see error-handler.service.ts).
 * This component only resets its own loading state on error; it does not duplicate that
 * message.
 */
@Component({
  selector: 'app-connect-device',
  standalone: true,
  imports: [BreadcrumbHeaderComponent, ButtonComponent],
  templateUrl: './connect-device.component.html',
  styleUrl: './connect-device.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConnectDeviceComponent implements OnDestroy {
  private readonly activationApi = inject(ActivationApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly generating = signal(false);
  readonly code = signal<string | null>(null);
  readonly secondsRemaining = signal(0);
  readonly expired = signal(false);
  readonly copied = signal(false);

  readonly formattedTime = computed(() => {
    const total = this.secondsRemaining();
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  });

  /**
   * Plain instance flag (not a signal) guarding re-entrancy. Kept separate from the
   * `generating` UI-loading signal because ActivationApiService.generate() can resolve
   * synchronously in tests (rxjs `of`) — a signal-only guard read via generating() would
   * already be reset by the time a second synchronous call is made. This flag is set
   * before subscribing and cleared only in a queued microtask after the subscription
   * settles, so two back-to-back synchronous calls still see the guard as active.
   */
  private inFlight = false;

  private countdownId: ReturnType<typeof setInterval> | null = null;
  private copiedResetId: ReturnType<typeof setTimeout> | null = null;

  generate(): void {
    if (this.inFlight) {
      return;
    }

    this.inFlight = true;
    this.generating.set(true);
    this.expired.set(false);
    this.copied.set(false);

    this.activationApi.generate()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.code.set(response.code);
          this.startCountdown(response.expires_in_seconds);
          this.generating.set(false);
        },
        error: (_error: HttpErrorResponse) => {
          this.generating.set(false);
          this.releaseGuard();
        },
        complete: () => {
          this.releaseGuard();
        }
      });
  }

  copyCode(): void {
    const value = this.code();
    if (!value) {
      return;
    }

    void navigator.clipboard.writeText(value);
    this.copied.set(true);

    if (this.copiedResetId !== null) {
      clearTimeout(this.copiedResetId);
    }
    this.copiedResetId = setTimeout(() => this.copied.set(false), COPIED_RESET_MS);
  }

  ngOnDestroy(): void {
    this.clearCountdown();
    if (this.copiedResetId !== null) {
      clearTimeout(this.copiedResetId);
    }
  }

  private releaseGuard(): void {
    queueMicrotask(() => {
      this.inFlight = false;
    });
  }

  private startCountdown(totalSeconds: number): void {
    this.clearCountdown();
    this.secondsRemaining.set(totalSeconds);

    this.countdownId = setInterval(() => {
      const next = this.secondsRemaining() - 1;
      if (next <= 0) {
        this.clearCountdown();
        this.code.set(null);
        this.secondsRemaining.set(0);
        this.expired.set(true);
      } else {
        this.secondsRemaining.set(next);
      }
    }, 1000);
  }

  private clearCountdown(): void {
    if (this.countdownId !== null) {
      clearInterval(this.countdownId);
      this.countdownId = null;
    }
  }
}
