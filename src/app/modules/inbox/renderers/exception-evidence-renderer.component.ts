import { KeyValuePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { EXCEPTION_ALERT_TYPE_LABELS, ExceptionAlertType, ExceptionEvidenceResponse } from '../../../shared/models/exception-evidence.model';
import { ExceptionEvidencePanelComponent } from '../../../shared/ui/exception-evidence-panel/exception-evidence-panel.component';
import { InboxItemDetailDto } from '../models/inbox.dto';

/** "exception-evidence": a monitoring exception case - the reason, its facts and (reviewers only) the day's evidence.
 *  The employee the case is about gets the facts only: the server sends no evidence to them (P10). */
@Component({
  selector: 'app-exception-evidence-renderer',
  standalone: true,
  imports: [KeyValuePipe, ExceptionEvidencePanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rnd">
      @if (typeLabel()) { <span class="rnd__badge" data-testid="exception-type">{{ typeLabel() }}</span> }
      @if (detail()?.explanation; as reason) { <p class="rnd__note" data-testid="exception-reason">{{ reason }}</p> }
      @if (detail()?.explanationDetails; as facts) {
        <div class="rnd__box" data-testid="exception-facts">
          @for (fact of facts | keyvalue; track fact.key) {
            <div class="rnd__row"><span class="rnd__key">{{ fact.key }}</span><span class="rnd__value">{{ fact.value }}</span></div>
          }
        </div>
      }
      @if (evidence(); as ev) {
        <div class="rnd__label">Evidence</div>
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
  protected readonly typeLabel = computed(() => {
    const type = (this.evidence()?.type ?? this.detail()?.item.actionType) as ExceptionAlertType | undefined;
    return type ? EXCEPTION_ALERT_TYPE_LABELS[type] ?? null : null;
  });
}
