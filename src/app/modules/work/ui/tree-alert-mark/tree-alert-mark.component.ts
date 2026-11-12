import { Component, computed, input } from '@angular/core';
import { MonitorAlertDto } from '../../models/dto/monitor.dto';

/** Red dot on a Tree row that the project monitor flagged; hover lists the problems.
 *  Faded when every alert is on an achieved module (informational, no action needed). */
@Component({
  selector: 'app-tree-alert-mark',
  standalone: true,
  template: `
    @if (alerts().length > 0) {
      <span
        data-testid="tree-row-alert"
        class="tree-alert-mark"
        [class.tree-alert-mark--muted]="muted()"
        role="img"
        [attr.aria-label]="label()"
        [attr.title]="tooltip()"
      ></span>
    }
  `,
  styles: [`
    :host { display: inline-flex; flex-shrink: 0; }
    .tree-alert-mark { display: inline-block; width: 8px; height: 8px; border-radius: 999px; background: var(--color-danger); box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-danger) 25%, transparent); }
    .tree-alert-mark--muted { opacity: 0.35; box-shadow: none; }
  `]
})
export class TreeAlertMarkComponent {
  alerts = input<readonly MonitorAlertDto[]>([]);
  protected readonly muted = computed(() => this.alerts().every((alert) => alert.inAchievedModule));
  protected readonly tooltip = computed(() => {
    const lines = this.alerts().map((alert) => `• ${alert.message}`).join('\n');
    return this.muted() ? `Achieved milestone - no action needed\n${lines}` : lines;
  });
  protected readonly label = computed(() => `${this.alerts().length} project alert${this.alerts().length === 1 ? '' : 's'}`);
}
