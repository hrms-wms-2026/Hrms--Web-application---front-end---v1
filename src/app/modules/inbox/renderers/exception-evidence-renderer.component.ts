import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ExceptionEvidenceResponse } from '../../../shared/models/exception-evidence.model';
import { ExceptionEvidencePanelComponent } from '../../../shared/ui/exception-evidence-panel/exception-evidence-panel.component';
import { InboxItemDetailDto } from '../models/inbox.dto';

/** "exception-evidence": a monitoring exception case - (reviewers only) the day's evidence.
 *  The employee the case is about gets nothing here: the server sends no evidence to them (P10). */
@Component({
  selector: 'app-exception-evidence-renderer',
  standalone: true,
  imports: [ExceptionEvidencePanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rnd">
      @if (evidence(); as ev) {
        <app-exception-evidence-panel [evidence]="ev" />
      }
    </div>
  `,
  styleUrl: './renderers.css'
})
export class ExceptionEvidenceRendererComponent {
  extra = input<Record<string, unknown> | null>(null);
  detail = input<InboxItemDetailDto | null>(null);

  protected readonly evidence = computed(() => this.extra() as ExceptionEvidenceResponse | null);
}
