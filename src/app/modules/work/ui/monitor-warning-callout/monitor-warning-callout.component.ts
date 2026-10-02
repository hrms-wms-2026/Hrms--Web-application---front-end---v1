import { Component, input } from '@angular/core';
import { MonitorWarningDto } from '../../models/dto/monitor.dto';

/** Amber, non-blocking planning warnings from the project monitor. Renders nothing when empty. */
@Component({
  selector: 'app-monitor-warning-callout',
  standalone: true,
  template: `
    @if (warnings().length > 0) {
      <div class="monitor-callout" role="status" data-testid="monitor-warnings">
        <p class="monitor-callout__title">Heads up — you can still save</p>
        <ul>
          @for (warning of warnings(); track warning.code + (warning.employeeId ?? '')) {
            <li>{{ warning.message }}</li>
          }
        </ul>
      </div>
    }
  `,
  styles: [`
    .monitor-callout { padding: 10px 12px; border: 1px solid var(--color-warning); border-radius: 8px; background: var(--color-warning-subtle); color: var(--color-warning-text); font-size: 12px; line-height: 1.45; }
    .monitor-callout__title { margin: 0 0 4px; font-weight: 650; }
    .monitor-callout ul { margin: 0; padding-left: 18px; }
  `]
})
export class MonitorWarningCalloutComponent {
  warnings = input<readonly MonitorWarningDto[]>([]);
}
