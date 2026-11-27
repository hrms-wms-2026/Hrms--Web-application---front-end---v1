import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type WidgetEmptyIllustration = 'clipboard-clock' | 'inbox' | 'calendar-add';

/**
 * Illustrated empty placeholder for dashboard widgets: a soft line drawing in the widget blue-gray shades, a title,
 * a short line and any projected actions. Every colour is a theme token, so it follows the accent and dark mode.
 */
@Component({
  selector: 'app-widget-empty',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'widget-empty' },
  template: `
    <svg class="widget-empty__art" viewBox="0 0 120 110" fill="none" aria-hidden="true">
      @switch (illustration()) {
        @case ('clipboard-clock') {
          <rect x="16" y="16" width="68" height="84" rx="9" class="we-paper" />
          <rect x="34" y="8" width="32" height="15" rx="5" class="we-tab" />
          <path d="M29 44l4 4 7-8M29 66l4 4 7-8" class="we-mark" />
          <path d="M48 45h22M48 67h14" class="we-line" />
          <circle cx="88" cy="80" r="21" class="we-badge" />
          <path d="M88 69v11l7 5" class="we-glyph" />
        }
        @case ('inbox') {
          <path d="M60 6v12M38 14l6 9M82 14l-6 9" class="we-spark" />
          <path d="M31 38h58l17 26v24a9 9 0 0 1-9 9H23a9 9 0 0 1-9-9V64z" class="we-paper" />
          <path d="M14 64h26l6 10h28l6-10h26" class="we-edge" />
        }
        @case ('calendar-add') {
          <rect x="12" y="20" width="84" height="76" rx="10" class="we-paper" />
          <path d="M12 42h84" class="we-edge" />
          <path d="M34 12v16M74 12v16" class="we-edge" />
          <circle cx="34" cy="58" r="4" class="we-dot" />
          <circle cx="54" cy="58" r="4" class="we-dot" />
          <circle cx="74" cy="58" r="4" class="we-dot" />
          <circle cx="34" cy="76" r="4" class="we-dot" />
          <circle cx="54" cy="76" r="4" class="we-dot" />
          <circle cx="92" cy="82" r="19" class="we-badge" />
          <path d="M92 73v18M83 82h18" class="we-glyph" />
        }
      }
    </svg>
    <p class="widget-empty__title">{{ heading() }}</p>
    @if (description()) {
      <p class="widget-empty__text">{{ description() }}</p>
    }
    <div class="widget-empty__actions"><ng-content /></div>
  `,
  styles: `
    :host {
      display: flex;
      flex: 1 1 auto;
      min-height: 0;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.25rem;
      padding: 1rem 0.75rem;
      text-align: center;
    }
    .widget-empty__art { width: 6.5rem; height: auto; margin-bottom: 0.5rem; flex-shrink: 1; min-height: 3rem; }
    .widget-empty__title { font-size: 1rem; font-weight: 600; color: var(--color-text-primary); line-height: 1.35; }
    .widget-empty__text { max-width: 22rem; font-size: 0.8125rem; color: var(--color-text-secondary); line-height: 1.45; }
    .widget-empty__actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.5rem; margin-top: 0.75rem; }
    .widget-empty__actions:empty { display: none; }

    .we-paper { fill: var(--color-surface); stroke: var(--color-widget-shade-3); stroke-width: 3; stroke-linejoin: round; }
    .we-tab { fill: var(--color-widget-track); stroke: var(--color-widget-shade-3); stroke-width: 3; }
    .we-edge { stroke: var(--color-widget-shade-3); stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
    .we-mark { stroke: var(--color-widget-shade-2); stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
    .we-line { stroke: var(--color-widget-shade-4); stroke-width: 3.5; stroke-linecap: round; }
    .we-spark { stroke: var(--color-widget-shade-2); stroke-width: 3; stroke-linecap: round; }
    .we-dot { fill: var(--color-widget-shade-4); }
    .we-badge { fill: var(--color-widget-shade-2); stroke: var(--color-surface); stroke-width: 4; }
    .we-glyph { stroke: var(--color-surface); stroke-width: 3.5; stroke-linecap: round; stroke-linejoin: round; }
  `
})
export class WidgetEmptyComponent {
  readonly illustration = input.required<WidgetEmptyIllustration>();
  readonly heading = input.required<string>();
  readonly description = input<string>('');
}
