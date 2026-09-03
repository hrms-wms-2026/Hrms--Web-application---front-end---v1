import { Component, input, output } from '@angular/core';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ObjectiveInvitationDto } from '../../models/dto/objective-invitation.dto';

@Component({
  selector: 'app-my-invitations-panel',
  standalone: true,
  imports: [ButtonComponent],
  template: `
    @if (invitations().length > 0) {
      <div data-testid="invitations-panel" class="flex flex-col gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
        <h3 class="text-xs font-semibold text-[var(--color-text-secondary)]">Pending invitations</h3>
        @for (invitation of invitations(); track invitation.id) {
          <div data-testid="invitation-row" class="flex items-center justify-between gap-2 text-xs">
            <span>You've been invited as {{ invitation.inviteType }} on a milestone.</span>
            <div class="flex items-center gap-1">
              <span data-testid="accept-button" (click)="acceptRequested.emit(invitation.id)">
                <app-button variant="primary" size="sm">Accept</app-button>
              </span>
              <span data-testid="reject-button" (click)="rejectRequested.emit(invitation.id)">
                <app-button variant="secondary" size="sm">Reject</app-button>
              </span>
            </div>
          </div>
        }
      </div>
    }
  `
})
export class MyInvitationsPanelComponent {
  invitations = input<readonly ObjectiveInvitationDto[]>([]);
  acceptRequested = output<string>();
  rejectRequested = output<string>();
}
