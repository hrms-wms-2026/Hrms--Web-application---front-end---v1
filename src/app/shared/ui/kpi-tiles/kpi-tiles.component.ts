import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IconComponent, IconName } from '../icon/icon.component';

export type KpiTileTone = 'accent' | 'success' | 'warning' | 'danger' | 'neutral';

export interface KpiTile {
  readonly label: string;
  readonly value: string | number;
  /** Optional muted line under the value. */
  readonly hint?: string;
  /** Round icon badge on the left, tinted by `tone`. */
  readonly icon?: IconName;
  /** Badge colour. 'danger' and 'warning' also colour the value, for figures that need attention. */
  readonly tone?: KpiTileTone;
  /** Rendered as data-testid on the value, so specs can read it. */
  readonly testId?: string;
}

/** Theme tokens (not raw hex) so tiles follow the tenant's theme preset in light and dark. */
const TONE_COLOR: Record<KpiTileTone, string> = {
  accent: 'var(--color-accent)',
  success: 'var(--color-success)',
  warning: 'var(--color-warning-text)',
  danger: 'var(--color-danger-text)',
  neutral: 'var(--color-text-secondary)'
};

/** A single row of compact KPI tiles: icon badge, label, value and optional hint — the same card shape as the
 * People overview KPI strip. Column count follows the number of tiles (max 4) so 2, 3 or 4 tiles fill one row. */
@Component({
  selector: 'app-kpi-tiles',
  standalone: true,
  imports: [IconComponent],
  template: `
    <section class="kpi-tiles" [style.--kpi-cols]="columns()" [attr.aria-label]="ariaLabel() || null">
      @for (tile of tiles(); track tile.label) {
        @let tone = tile.tone ?? 'accent';
        <article
          class="kpi-tile"
          data-testid="kpi-tile"
          [class.kpi-tile--warning]="tone === 'warning'"
          [class.kpi-tile--danger]="tone === 'danger'"
        >
          @if (tile.icon) {
            <span
              class="kpi-tile__icon"
              aria-hidden="true"
              [style.color]="toneColor(tone)"
              [style.backgroundColor]="toneBackground(tone)"
            >
              <app-icon [name]="tile.icon" />
            </span>
          }
          <div class="kpi-tile__body">
            <p class="kpi-tile__label">{{ tile.label }}</p>
            <p class="kpi-tile__value" [attr.data-testid]="tile.testId || null">{{ tile.value }}</p>
            @if (tile.hint) {
              <p class="kpi-tile__hint" [title]="tile.hint">{{ tile.hint }}</p>
            }
          </div>
        </article>
      }
    </section>
  `,
  styles: [`
    :host { display: block; }
    .kpi-tiles {
      display: grid;
      grid-template-columns: repeat(var(--kpi-cols, 3), minmax(0, 1fr));
      gap: 0.75rem;
      margin: 0 0 1rem;
    }
    .kpi-tile {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      min-width: 0;
      padding: 0.75rem 0.875rem;
      /* A host page can flatten the tiles (My Team dashboard sets both to transparent/none). */
      border: 1px solid var(--kpi-tile-border, var(--color-border));
      border-radius: var(--radius-content);
      background: var(--color-surface);
      box-shadow: var(--kpi-tile-shadow, 0 1px 2px var(--color-card-shadow));
    }
    .kpi-tile__icon {
      display: flex;
      flex-shrink: 0;
      align-items: center;
      justify-content: center;
      width: 2.25rem;
      height: 2.25rem;
      border-radius: 999px;
    }
    .kpi-tile__body { min-width: 0; flex: 1; }
    .kpi-tile__label,
    .kpi-tile__value,
    .kpi-tile__hint {
      margin: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .kpi-tile__label {
      color: var(--color-text-secondary);
      font-size: 0.75rem;
      font-weight: 500;
    }
    .kpi-tile__value {
      color: var(--color-text-primary);
      font-size: 1.25rem;
      font-weight: 700;
      line-height: 1.3;
    }
    .kpi-tile--warning .kpi-tile__value { color: var(--color-warning-text); }
    .kpi-tile--danger .kpi-tile__value { color: var(--color-danger-text); }
    .kpi-tile__hint {
      color: var(--color-text-secondary);
      font-size: 0.6875rem;
    }
    @media (max-width: 860px) {
      .kpi-tiles { grid-template-columns: repeat(min(var(--kpi-cols, 3), 2), minmax(0, 1fr)); }
    }
    @media (max-width: 520px) {
      .kpi-tiles { grid-template-columns: 1fr; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class KpiTilesComponent {
  readonly tiles = input.required<readonly KpiTile[]>();
  readonly ariaLabel = input('');
  /** The most tiles one row holds before wrapping; a wide panel can raise it to keep them on one row. */
  readonly maxColumns = input(4);

  readonly columns = computed(() => Math.min(Math.max(this.tiles().length, 1), this.maxColumns()));

  toneColor(tone: KpiTileTone): string {
    return TONE_COLOR[tone];
  }

  toneBackground(tone: KpiTileTone): string {
    return `color-mix(in srgb, ${TONE_COLOR[tone]} 14%, transparent)`;
  }
}
