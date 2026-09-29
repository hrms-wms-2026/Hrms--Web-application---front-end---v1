import { Component, computed, input } from '@angular/core';
import { MonitorAlertDto } from '../../models/dto/monitor.dto';

/** Red dot on a Tree row that the project monitor flagged; hover lists the problems. */
@Component({
  selector: 'app-tree-alert-mark',
  standalone: true,
  template: `
    @if (alerts().length > 0) {
      <span
        data-testid="tree-row-alert"
        class="tree-alert-mark"
        role="img"
        [attr.aria-label]="label()"
        [attr.title]="tooltip()"
      ></span>
    }
  `,
  styles: [`
    :host { display: inline-flex; flex-shrink: 0; }
    .tree-alert-mark { display: inline-block; width: 8px; height: 8px; border-radius: 999px; background: var(--color-danger); box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-danger) 25%, transparent); }
  `]
})
export class TreeAlertMarkComponent {
  alerts = input<readonly MonitorAlertDto[]>([]);
  protected readonly tooltip = computed(() => this.alerts().map((alert) => `• ${alert.message}`).join('\n'));
  protected readonly label = computed(() => `${this.alerts().length} project alert${this.alerts().length === 1 ? '' : 's'}`);
}
