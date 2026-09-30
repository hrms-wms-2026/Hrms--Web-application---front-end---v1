import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DetailIconComponent, DetailIconName } from './detail-icon.component';

/** Tinted "nothing here yet" box with an icon (Address / Emergency Contact / no-data cards). */
@Component({
  selector: 'app-empty-note',
  standalone: true,
  imports: [DetailIconComponent],
  template: `
    <div class="note" data-testid="empty-note">
      <span class="note__icon"><app-detail-icon [name]="icon()" [size]="20" /></span>
      <div>
        <p class="note__title">{{ title() }}</p>
        @if (description()) {
          <p class="note__desc">{{ description() }}</p>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .note { display: flex; align-items: center; gap: 0.875rem; padding: 0.875rem 1rem; border-radius: 0.625rem; background: #f3f6fb; }
    .note__icon { color: var(--color-accent); }
    .note__title { margin: 0; font-size: 0.875rem; font-weight: 500; color: var(--color-text-primary); }
    .note__desc { margin: 0.125rem 0 0; font-size: 0.8125rem; color: var(--color-text-secondary); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmptyNoteComponent {
  readonly title = input.required<string>();
  readonly description = input('');
  readonly icon = input<DetailIconName>('info');
}
