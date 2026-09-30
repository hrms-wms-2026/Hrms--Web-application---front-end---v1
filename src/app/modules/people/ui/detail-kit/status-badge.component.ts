import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'neutral';

/** Soft pill badge (Approved, Pending, In Progress, High, …). */
@Component({
  selector: 'app-status-badge',
  standalone: true,
  template: `<span class="badge" [attr.data-tone]="tone()"><ng-content /></span>`,
  styles: [`
    :host { display: inline-flex; }
    .badge {
      display: inline-flex; align-items: center; white-space: nowrap;
      padding: 0.1875rem 0.625rem; border-radius: 9999px;
      font-size: 0.75rem; font-weight: 600; line-height: 1.25;
      background: var(--color-surface-secondary); color: var(--color-text-secondary);
    }
    .badge[data-tone='success'] { background: #dcfce7; color: #15803d; }
    .badge[data-tone='warning'] { background: #fef3c7; color: #b45309; }
    .badge[data-tone='danger'] { background: #fee2e2; color: #b91c1c; }
    .badge[data-tone='info'] { background: #dbeafe; color: #1d4ed8; }
    .badge[data-tone='purple'] { background: #ede9fe; color: #6d28d9; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StatusBadgeComponent {
  readonly tone = input<BadgeTone>('neutral');
}
