import { Component, computed, input } from '@angular/core';
import { InboxTone } from '../../utils/inbox-item.util';

/** Stroke paths (24x24, currentColor) per inbox item type icon. */
const ICON_PATHS: Record<string, string[]> = {
  'task-plus': ['M9 4h6', 'M8 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2', 'M12 10v6', 'M9 13h6'],
  task: ['M9 4h6', 'M8 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2', 'm9 13 2 2 4-4'],
  trash: ['M4 7h16', 'M10 11v6', 'M14 11v6', 'M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12', 'M9 7V4h6v3'],
  clock: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M12 7v5l3 2'],
  module: ['M4 5h7v6H4z', 'M13 5h7v6h-7z', 'M4 13h7v6H4z', 'M13 13h7v6h-7z'],
  'user-plus': ['M15 20a6 6 0 0 0-12 0', 'M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M19 8v6', 'M16 11h6'],
  sprint: ['M4 12a8 8 0 0 1 14-5.3', 'M18 3v4h-4', 'M20 12a8 8 0 0 1-14 5.3', 'M6 21v-4h4'],
  status: ['M4 6h10', 'M4 12h16', 'M4 18h7', 'M18 4l2 2-2 2'],
  alert: ['M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z', 'M12 9v4', 'M12 17h.01']
};

/** A 32px rounded tile with a tinted theme background and an inline SVG type icon. */
@Component({
  selector: 'app-inbox-type-icon',
  standalone: true,
  host: { '[class]': "'iti iti--' + tone()", '[attr.data-icon]': 'icon()' },
  template: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      @for (d of paths(); track $index) {
        <path [attr.d]="d" />
      }
    </svg>
  `,
  styles: [`
    :host { --tone: var(--color-accent); display: inline-flex; flex: 0 0 auto; width: 32px; height: 32px; align-items: center; justify-content: center; border-radius: 9px; background: color-mix(in srgb, var(--tone) 14%, transparent); color: var(--tone); }
    :host(.iti--neutral) { --tone: var(--color-text-secondary); }
    :host(.iti--warning) { --tone: var(--color-warning, #d97706); }
    :host(.iti--danger) { --tone: var(--color-danger); }
    :host(.iti--info) { --tone: var(--color-purple, #7c3aed); }
    svg { width: 17px; height: 17px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  `]
})
export class InboxTypeIconComponent {
  icon = input.required<string>();
  tone = input<InboxTone>('accent');

  protected readonly paths = computed(() => ICON_PATHS[this.icon()] ?? ICON_PATHS['task']);
}
