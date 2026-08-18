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

    @if (store.loading()) {
      <app-loader label="Loading pending approvals…" />
    } @else if (store.myPendingBypassRequests().length === 0) {
      <p class="text-sm text-[var(--color-text-secondary)]">No pending bypass requests.</p>
    } @else {
      <div class="space-y-2">
        @for (request of store.myPendingBypassRequests(); track request.id) {
          <div class="p-3 border border-[var(--color-border)] rounded-lg space-y-2">
            <p class="text-sm">{{ request.bypassReason }}</p>
            <p class="text-xs text-[var(--color-text-secondary)]">Penalty: {{ request.penaltyDescription || 'None' }}</p>
            @if (decidingId() === request.id) {
              <app-input label="Comment (optional)" [value]="comment()" (valueChange)="comment.set($event)" />
            }
            <div class="flex gap-2">
              <app-button variant="primary" [loading]="store.saving()" (pressed)="decide(request.id, 'approve')">Approve</app-button>
              <app-button variant="secondary" [loading]="store.saving()" (pressed)="startReject(request.id)">Reject</app-button>
              @if (decidingId() === request.id) {
                <app-button variant="secondary" [loading]="store.saving()" (pressed)="decide(request.id, 'reject')">Confirm Reject</app-button>
              }
            </div>
          </div>
        }
      </div>
    }
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
