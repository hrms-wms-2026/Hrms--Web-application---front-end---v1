import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NetworkStatusService } from '../../../core/network/network-status.service';

/**
 * A strip at the top of the app while the browser is offline (Improvements task 20). Requests fail while it shows,
 * so the error handler skips its own "could not reach the server" toasts.
 */
@Component({
  selector: 'app-offline-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // The live region is always in the page so screen readers announce the text when it appears.
  template: `<div role="status">
    @if (!network.online()) {
      <p class="offline-banner">You are offline. Changes will not be saved until the connection is back.</p>
    }
  </div>`,
  styles: `
    .offline-banner {
      margin: 0;
      padding: 0.375rem 1rem;
      text-align: center;
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--color-warning-text);
      background: var(--color-warning-subtle);
      border-bottom: 1px solid var(--color-warning);
    }
  `,
})
export class OfflineBannerComponent {
  protected readonly network = inject(NetworkStatusService);
}
