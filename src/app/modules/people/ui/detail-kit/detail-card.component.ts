import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DetailIconComponent, DetailIconName } from './detail-icon.component';

/**
 * White card used by every employee detail section: tinted icon tile, title, optional subtitle,
 * optional "View …" link (router link) and a `[card-actions]` slot for buttons.
 */
@Component({
  selector: 'app-detail-card',
  standalone: true,
  imports: [RouterLink, DetailIconComponent],
  template: `
    <section class="card" [class.card--flush]="flush()" [attr.aria-label]="title()">
      @if (title()) {
        <header class="card__head">
          @if (icon(); as iconName) {
            <span class="card__icon" [attr.data-tone]="iconTone()"><app-detail-icon [name]="iconName" [size]="20" /></span>
          }
          <div class="card__heading">
            <div class="card__title-row">
              <h2 class="card__title">{{ title() }}</h2>
              @if (inlineSubtitle()) {
                <span class="card__inline-subtitle">{{ inlineSubtitle() }}</span>
              }
            </div>
            @if (subtitle()) {
              <p class="card__subtitle">{{ subtitle() }}</p>
            }
          </div>
          <div class="card__actions">
            <ng-content select="[card-actions]" />
            @if (linkLabel() && linkUrl()) {
              <a class="card__link" [routerLink]="linkUrl()">
                {{ linkLabel() }}
                <app-detail-icon name="arrow-right" [size]="16" />
              </a>
            }
          </div>
        </header>
      }
      <ng-content />
    </section>
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    .card {
      height: 100%;
      box-sizing: border-box;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 0.875rem;
      padding: 1.125rem 1.25rem;
      box-shadow: 0 1px 2px rgb(15 23 42 / 0.04);
    }
    .card--flush { padding: 0; overflow: hidden; }
    .card--flush .card__head { padding: 1.125rem 1.25rem 0; }
    .card__head { display: flex; align-items: flex-start; gap: 0.75rem; margin-bottom: 1rem; }
    .card__icon {
      display: inline-flex; align-items: center; justify-content: center;
      width: 2.25rem; height: 2.25rem; border-radius: 0.625rem; flex-shrink: 0;
      background: color-mix(in srgb, var(--color-accent) 10%, var(--color-surface));
      color: var(--color-accent);
    }
    .card__icon[data-tone='danger'] { background: #fee2e2; color: #dc2626; }
    .card__heading { flex: 1; min-width: 0; }
    .card__title-row { display: flex; align-items: baseline; flex-wrap: wrap; column-gap: 0.75rem; }
    .card__title { margin: 0; font-size: 1.0625rem; font-weight: 600; line-height: 1.4; color: var(--color-text-primary); }
    .card__inline-subtitle { font-size: 0.8125rem; color: var(--color-text-secondary); }
    .card__subtitle { margin: 0.125rem 0 0; font-size: 0.8125rem; color: var(--color-text-secondary); }
    .card__actions { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }
    .card__link {
      display: inline-flex; align-items: center; gap: 0.375rem;
      font-size: 0.8125rem; font-weight: 500; color: var(--color-accent); text-decoration: none; white-space: nowrap;
    }
    .card__link:hover { text-decoration: underline; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DetailCardComponent {
  readonly title = input('');
  readonly subtitle = input('');
  /** Subtitle rendered on the title line (e.g. the Productivity card's description). */
  readonly inlineSubtitle = input('');
  readonly icon = input<DetailIconName | null>(null);
  readonly iconTone = input<'accent' | 'danger'>('accent');
  readonly linkLabel = input('');
  readonly linkUrl = input<string | readonly unknown[] | null>(null);
  /** Removes body padding, for edge-to-edge tables. */
  readonly flush = input(false);
}
