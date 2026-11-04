import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Delta } from '../../utils/employee-overview.utils';

/** Small "▲ +2" chip showing a change against the previous period; renders nothing for null. */
@Component({
  selector: 'app-delta-badge',
  standalone: true,
  template: `
    @if (delta(); as d) {
      <span
        data-testid="delta"
        class="delta"
        [class]="'delta--' + d.tone"
        [attr.aria-label]="label()"
      >{{ arrow() }} {{ d.text }}</span>
    }
  `,
  styles: [`
    .delta { display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.75rem; font-weight: 600; }
    .delta--good { color: var(--color-success); }
    .delta--bad { color: var(--color-danger-text); }
    .delta--neutral { color: var(--color-text-secondary); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DeltaBadgeComponent {
  readonly delta = input<Delta | null>(null);
  readonly against = input<string | null>(null);

  readonly arrow = computed(() => {
    const d = this.delta();
    return d?.direction === 'up' ? '▲' : d?.direction === 'down' ? '▼' : '–';
  });

  readonly label = computed(() => {
    const d = this.delta();
    if (!d) return null;
    const word = d.direction === 'up' ? 'Up' : d.direction === 'down' ? 'Down' : 'No change';
    const against = this.against() ?? 'the previous period';
    return d.direction === 'flat' ? `No change versus ${against}` : `${word} ${d.text} versus ${against}`;
  });
}
