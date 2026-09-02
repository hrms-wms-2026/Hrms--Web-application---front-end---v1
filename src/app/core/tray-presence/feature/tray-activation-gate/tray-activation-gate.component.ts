import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthStore } from '../../../auth/state/auth.store';
import { TrayPresenceStore } from '../../state/tray-presence.store';

@Component({
  selector: 'app-tray-activation-gate',
  standalone: true,
  templateUrl: './tray-activation-gate.component.html',
  styleUrl: './tray-activation-gate.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TrayActivationGateComponent {
  readonly presence = inject(TrayPresenceStore);
  private readonly auth = inject(AuthStore);

  async copyCode(): Promise<void> {
    await this.presence.copyCode();
  }

  regenerate(): void {
    void this.presence.retry();
  }

  retry(): void {
    void this.presence.retry();
  }

  async logout(): Promise<void> {
    await this.auth.logout();
  }
}
