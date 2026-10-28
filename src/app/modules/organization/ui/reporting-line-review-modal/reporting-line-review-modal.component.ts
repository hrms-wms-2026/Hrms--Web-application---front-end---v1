import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { buildFileUrl } from '../../../../shared/data-access/file-api.service';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ReportingLineMoveImpact } from '../../models/position.model';
import { StopClickPropagationDirective } from '../../../../shared/directives/stop-click-propagation.directive';

@Component({
  selector: 'app-reporting-line-review-modal',
  host: { 'animate.leave': 'ui-popup-leave' },
  standalone: true,
  imports: [StopClickPropagationDirective, ButtonComponent],
  templateUrl: './reporting-line-review-modal.component.html',
  styleUrl: './reporting-line-review-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReportingLineReviewModalComponent {
  readonly impact = input.required<ReportingLineMoveImpact>();
  readonly avatarFileIds = input<ReadonlyMap<string, string | null>>(new Map());
  readonly saving = input(false);
  readonly confirmed = output<string | null>();
  readonly cancelled = output<void>();
  readonly reason = signal('');
  private readonly failedAvatarEmployeeIds = signal<ReadonlySet<string>>(new Set());

  avatarUrl(employeeId: string): string | null {
    if (this.failedAvatarEmployeeIds().has(employeeId)) return null;
    const fileId = this.avatarFileIds().get(employeeId);
    return fileId ? buildFileUrl(fileId) : null;
  }

  markAvatarFailed(employeeId: string): void {
    this.failedAvatarEmployeeIds.update((current) => new Set([...current, employeeId]));
  }

  initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    return `${parts[0].charAt(0)}${parts.length > 1 ? parts.at(-1)!.charAt(0) : ''}`.toUpperCase();
  }

  confirm(): void {
    const reason = this.reason().trim();
    this.confirmed.emit(reason || null);
  }
}
