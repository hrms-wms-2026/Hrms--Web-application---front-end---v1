import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export interface TimelineItem {
  readonly date: string;
  readonly title: string;
  readonly description?: string | null;
}

/**
 * Date + title/description list. `rail` draws the connected blue dots (Employment History on the
 * Employment tab); without it the list is the compact Overview variant.
 */
@Component({
  selector: 'app-timeline',
  standalone: true,
  template: `
    <ol class="timeline" [class.timeline--rail]="rail()">
      @for (item of items(); track $index) {
        <li class="timeline__item" data-testid="timeline-item">
          @if (rail()) {
            <span class="timeline__dot" aria-hidden="true"></span>
          }
          <span class="timeline__date">{{ item.date }}</span>
          <span class="timeline__text">
            <span class="timeline__title">{{ item.title }}</span>
            @if (item.description) {
              <span class="timeline__desc">{{ item.description }}</span>
            }
          </span>
        </li>
      }
    </ol>
  `,
  styles: [`
    :host { display: block; }
    .timeline { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 0.75rem; }
    .timeline__item { position: relative; display: grid; grid-template-columns: 7.5rem minmax(0, 1fr); gap: 0.75rem; font-size: 0.8125rem; }
    .timeline--rail .timeline__item { grid-template-columns: 1.25rem 7rem minmax(0, 1fr); gap: 0.875rem; padding-bottom: 0.25rem; }
    .timeline--rail .timeline__item:not(:last-child)::before {
      content: ''; position: absolute; left: 0.5625rem; top: 1rem; bottom: -0.875rem; width: 2px; background: #c7d7fb;
    }
    .timeline__dot { position: relative; z-index: 1; width: 0.75rem; height: 0.75rem; margin: 0.25rem 0 0 0.25rem; border-radius: 9999px; background: var(--color-accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 18%, transparent); }
    .timeline__date { color: var(--color-text-secondary); padding-top: 0.0625rem; }
    .timeline--rail .timeline__date { font-size: 0.875rem; }
    .timeline__text { display: flex; flex-direction: column; min-width: 0; }
    .timeline__title { font-weight: 600; color: var(--color-text-primary); }
    .timeline--rail .timeline__title { font-size: 0.875rem; }
    .timeline__desc { font-size: 0.75rem; color: var(--color-text-secondary); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimelineComponent {
  readonly items = input.required<readonly TimelineItem[]>();
  readonly rail = input(false);
}
