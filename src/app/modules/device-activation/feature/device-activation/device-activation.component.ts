import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { DeviceAuthorizationApiService } from '../../data-access/device-authorization-api.service';
import { DeviceAuthorizationPreview } from '../../models/device-authorization.model';

@Component({
  selector: 'app-device-activation',
    standalone: true,
  imports: [DatePipe],
  templateUrl:
 './device-activation.component.html',
  styleUrl: './device-activation.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DeviceActivationComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(DeviceAuthorizationApiService);
  readonly preview = signal<DeviceAuthorizationPreview | null>(null);
  readonly state = signal<'loading' | 'ready' | 'approved' | 'invalid' | 'error'>('loading');
  readonly requestId = signal<string | null>(null);
  readonly userCode = signal<string | null>(null);

  ngOnInit(): void {
    const requestId = this.route.snapshot.queryParamMap.get('request_id');
    const userCode = this.route.snapshot.queryParamMap.get('user_code');
    if (!requestId || !userCode) {
      this.state.set('invalid');
      return;
    }
    this.requestId.set(requestId);
    this.userCode.set(userCode);
    void this.loadPreview(requestId, userCode);
  }

  private async loadPreview(requestId: string, userCode: string): Promise<void> {
    try {
      this.preview.set(await firstValueFrom(this.api.preview(requestId, userCode)));
      this.state.set('ready');
    } catch {
      this.state.set('invalid');
    }
  }

  async approve(): Promise<void> {
    const requestId = this.requestId();
    const userCode = this.userCode();
    if (!requestId || !userCode) return;
    try {
      await firstValueFrom(this.api.approve({ request_id: requestId, user_code: userCode }));
      this.state.set('approved');
    } catch {
      this.state.set('error');
    }
  }

  cancel(): void {
    void this.router.navigate(['/dashboard']);
  }

  returnToWorkspace(): void {
    void this.router.navigate(['/dashboard']);
  }
}
