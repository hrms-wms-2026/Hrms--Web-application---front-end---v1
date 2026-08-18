import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { OffboardingWizardStore } from '../../state/offboarding-wizard.store';

@Component({
  selector: 'app-offboarding-approvals',
  standalone: true,
  imports: [ButtonComponent, InputComponent, LoaderComponent],
  template: `
    <h1 class="text-xl font-bold mb-4">My Pending Approvals</h1>
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
