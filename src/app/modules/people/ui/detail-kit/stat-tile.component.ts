import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DetailIconComponent, DetailIconName } from './detail-icon.component';

export type StatTone = 'default' | 'success' | 'info' | 'warning' | 'danger' | 'purple';

/**
 * Big number + label. With `icon` it renders the Work Summary style (tinted round icon on the
 * left); `divider` draws the vertical rule used between tiles in the Attendance/Work cards.
 */
@Component({
  selector: 'app-stat-tile',
  standalone: true,
  imports: [DetailIconComponent],
  template: `
    <div class="tile" [class.tile--divider]="divider()" [class.tile--compact]="compact()">
      @if (icon(); as iconName) {
        <span class="tile__icon" [attr.data-tone]="tone()"><app-detail-icon [name]="iconName" [size]="20" /></span>
      }
      <div class="min-w-0">
        <div class="tile__value" [attr.data-tone]="valueTone()" [class.tile__value--lg]="large()">{{ value() }}</div>
        <div class="tile__label">{{ label() }}</div>
        @if (hint()) {
          <div class="tile__hint">{{ hint() }}</div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    .tile { display: flex; align-items: center; gap: 0.75rem; }
    .tile--divider { border-left: 1px solid var(--color-border); padding-left: 1rem; }
    .tile__icon {
      display: inline-flex; align-items: center; justify-content: center;
      width: 2.5rem; height: 2.5rem; border-radius: 9999px; flex-shrink: 0;
      background: #e0e7ff; color: #4338ca;
    }
    .tile--compact { gap: 0.5rem; }
    .tile--compact.tile--divider { padding-left: 0.625rem; }
    .tile--compact .tile__icon { width: 2rem; height: 2rem; }
    .tile--compact .tile__value { font-size: 1.125rem; }
    .tile--compact .tile__label { font-size: 0.75rem; }
    .tile__icon[data-tone='success'] { background: #dcfce7; color: #16a34a; }
    .tile__icon[data-tone='info'] { background: #dbeafe; color: #2563eb; }
    .tile__icon[data-tone='warning'] { background: #fef3c7; color: #d97706; }
    .tile__icon[data-tone='danger'] { background: #fee2e2; color: #dc2626; }
    .tile__icon[data-tone='purple'] { background: #ede9fe; color: #7c3aed; }
    .tile__value { font-size: 1.25rem; font-weight: 700; line-height: 1.2; color: var(--color-text-primary); white-space: nowrap; }
    .tile__value--lg { font-size: 1.5rem; }
    .tile__value[data-tone='danger'] { color: #dc2626; }
    .tile__value[data-tone='success'] { color: #16a34a; }
    .tile__label { font-size: 0.8125rem; color: var(--color-text-secondary); white-space: nowrap; }
    .tile__hint { font-size: 0.75rem; color: var(--color-text-secondary); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StatTileComponent {
  readonly value = input.required<string | number>();
  readonly label = input.required<string>();
  readonly hint = input('');
  readonly icon = input<DetailIconName | null>(null);
  readonly tone = input<StatTone>('default');
  readonly valueTone = input<'default' | 'danger' | 'success'>('default');
  readonly divider = input(false);
  readonly large = input(false);
  /** Smaller icon and spacing for four tiles in a narrow card (Recorded Activity). */
  readonly compact = input(false);
}
