import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../auth/state/auth.store';
import { TrayInstallerApiService } from '../../data-access/tray-installer-api.service';
import { TrayInstallerInfo } from '../../models/tray-installer.model';
import { TrayPresenceStore } from '../../state/tray-presence.store';

@Component({
  selector: 'app-tray-activation-gate',
  standalone: true,
  imports: [NgTemplateOutlet],
  templateUrl: './tray-activation-gate.component.html',
  styleUrl: './tray-activation-gate.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TrayActivationGateComponent implements OnInit {
  readonly presence = inject(TrayPresenceStore);
  private readonly auth = inject(AuthStore);
  private readonly installerApi = inject(TrayInstallerApiService);

  readonly installer = signal<TrayInstallerInfo | null>(null);
  readonly installerState = signal<'loading' | 'ready' | 'unavailable'>('loading');
  readonly sizeLabel = computed(() => {
    const info = this.installer();
    return info ? `${(info.file_size_bytes / 1024 / 1024).toFixed(1)} MB` : '';
  });

  ngOnInit(): void {
    void this.loadInstaller();
  }

  private async loadInstaller(): Promise<void> {
    try {
      this.installer.set(await firstValueFrom(this.installerApi.getLatest()));
      this.installerState.set('ready');
    } catch {
      // 404 (nothing published) and network errors both degrade to "unavailable";
      // the code flow must keep working for people who already have the app.
      this.installerState.set('unavailable');
    }
  }

  async copyCode(): Promise<void> {
    await this.presence.copyCode();
  }

  generate(): void {
    void this.presence.generateCode();
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
