import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * One label/value row. `divided` draws the hairline between rows (Employment tab cards);
 * `compact` tightens spacing (Overview's Employment & Organization card). The value is projected.
 */
@Component({
  selector: 'app-kv-row',
  standalone: true,
  host: {
    role: 'group',
    '[attr.aria-label]': 'label()',
    '[class.kv--divided]': 'divided()',
    '[class.kv--compact]': 'compact()'
  },
  template: `
    <span class="kv__label">{{ label() }}</span>
    <span class="kv__value"><ng-content /></span>
  `,
  styles: [`
    :host {
      display: grid;
      grid-template-columns: minmax(7.5rem, 42%) minmax(0, 1fr);
      gap: 1rem;
      align-items: center;
      padding: 0.5rem 0;
      font-size: 0.875rem;
    }
    :host(.kv--divided) { border-bottom: 1px solid var(--color-border); padding: 0.625rem 0; }
    :host(.kv--divided:last-of-type) { border-bottom: 0; }
    :host(.kv--compact) { padding: 0.1875rem 0; font-size: 0.8125rem; }
    .kv__label { color: var(--color-text-secondary); }
    .kv__value { color: var(--color-text-primary); font-weight: 500; overflow-wrap: anywhere; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class KvRowComponent {
  readonly label = input.required<string>();
  readonly divided = input(false);
  readonly compact = input(false);
}
