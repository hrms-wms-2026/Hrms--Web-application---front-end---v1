import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { BreadcrumbHeaderComponent } from '../../../../shared/ui/breadcrumb-header/breadcrumb-header.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { OffboardingWizardStore } from '../../state/offboarding-wizard.store';

@Component({
  selector: 'app-offboarding-approvals',
  standalone: true,
  imports: [BreadcrumbHeaderComponent, ButtonComponent, InputComponent, LoaderComponent],
  template: `
    <header class="ap-page-header">
      <div class="ap-header-row">
        <app-breadcrumb-header
          parentLabel="People"
          currentLabel="Approvals"
          icon="people"
        />
      </div>
    </header>

    <div class="ap-container">
      <div class="ap-intro">
        <h3 class="ap-intro__title">Offboarding Bypass Approvals</h3>
        <p class="ap-intro__subtitle">Review and decide pending bypass requests for offboarding checklist requirements.</p>
      </div>

      @if (store.loading()) {
        <app-loader label="Loading pending approvals…" />
      } @else if (store.myPendingBypassRequests().length === 0) {
        <div class="ap-empty-box">
          <p class="ap-empty-box__text">No pending bypass requests requiring your approval.</p>
        </div>
      } @else {
        <div class="ap-request-list">
          @for (request of store.myPendingBypassRequests(); track request.id) {
            <div class="ap-card">
              <div class="ap-card__header">
                <div class="ap-card__reason-box">
                  <span class="ap-card__label">Bypass Reason</span>
                  <p class="ap-card__reason">{{ request.bypassReason }}</p>
                </div>
                <span class="ap-badge ap-badge--pending">Pending Approval</span>
              </div>

              <div class="ap-card__penalty-box">
                <span class="ap-card__penalty-label">Associated Penalty / Note:</span>
                <span class="ap-card__penalty-val">{{ request.penaltyDescription || 'None' }}</span>
              </div>

              @if (decidingId() === request.id) {
                <div class="ap-reject-box">
                  <app-input label="Rejection comment (optional)" [value]="comment()" (valueChange)="comment.set($event)" />
                </div>
              }

              <div class="ap-card__actions">
                <app-button variant="primary" size="sm" [loading]="store.saving()" (pressed)="decide(request.id, 'approve')">
                  Approve Bypass
                </app-button>
                @if (decidingId() !== request.id) {
                  <app-button variant="secondary" size="sm" [loading]="store.saving()" (pressed)="startReject(request.id)">
                    Reject
                  </app-button>
                } @else {
                  <app-button variant="secondary" size="sm" [loading]="store.saving()" (pressed)="decide(request.id, 'reject')">
                    Confirm Rejection
                  </app-button>
                  <app-button variant="secondary" size="sm" (pressed)="decidingId.set(null)">
                    Cancel
                  </app-button>
                }
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .ap-page-header {
      margin-top: -1.25rem;
      margin-bottom: 1.25rem;
      padding-bottom: 0.625rem;
      border-bottom: 1px solid var(--color-border);
    }
    .ap-header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      width: 100%;
      height: 36px;
      min-height: 36px;
    }
    .ap-container {
      max-width: 44rem;
    }
    .ap-intro {
      margin-bottom: 1.25rem;
    }
    .ap-intro__title {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 700;
      color: var(--color-text-primary);
    }
    .ap-intro__subtitle {
      margin: 0.25rem 0 0;
      font-size: 0.825rem;
      color: var(--color-text-secondary);
    }
    .ap-empty-box {
      padding: 2.5rem 1.5rem;
      text-align: center;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 12px;
    }
    .ap-empty-box__text {
      margin: 0;
      font-size: 0.875rem;
      color: var(--color-text-secondary);
    }
    .ap-request-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .ap-card {
      padding: 1.25rem;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
    }
    .ap-card__header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 0.875rem;
    }
    .ap-card__reason-box {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .ap-card__label {
      font-size: 0.725rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--color-text-secondary);
    }
    .ap-card__reason {
      margin: 0;
      font-size: 0.925rem;
      font-weight: 650;
      color: var(--color-text-primary);
    }
    .ap-badge {
      padding: 0.15rem 0.55rem;
      border-radius: 9999px;
      font-size: 0.725rem;
      font-weight: 650;
    }
    .ap-badge--pending {
      background: color-mix(in srgb, var(--color-warning) 15%, var(--color-surface));
      color: var(--color-warning-text);
    }
    .ap-card__penalty-box {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.625rem 0.875rem;
      margin-bottom: 1rem;
      background: color-mix(in srgb, var(--color-border) 15%, var(--color-surface));
      border-radius: 8px;
      font-size: 0.8rem;
    }
    .ap-card__penalty-label {
      color: var(--color-text-secondary);
      font-weight: 500;
    }
    .ap-card__penalty-val {
      color: var(--color-text-primary);
      font-weight: 650;
    }
    .ap-reject-box {
      margin-bottom: 1rem;
    }
    .ap-card__actions {
      display: flex;
      align-items: center;
      gap: 0.625rem;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OffboardingApprovalsComponent implements OnInit {
  readonly store = inject(OffboardingWizardStore);
  readonly decidingId = signal<string | null>(null);
  readonly comment = signal('');

  ngOnInit(): void {
    void this.store.loadMyPendingBypassRequests();
  }

  startReject(id: string): void {
    this.decidingId.set(id);
    this.comment.set('');
  }

  async decide(id: string, decision: 'approve' | 'reject'): Promise<void> {
    await this.store.decideBypassRequest(id, decision, decision === 'reject' ? this.comment() || null : null);
    this.decidingId.set(null);
  }
}
