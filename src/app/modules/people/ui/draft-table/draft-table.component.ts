import { Component, inject, input, output } from '@angular/core';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { DRAFT_REASON_LABELS, DRAFT_STATUS_LABELS, DraftListItemResponse } from '../../models/onboarding-draft.model';
import { isTerminalDraft } from '../../utils/draft-status.utils';

@Component({
  selector: 'app-draft-table',
  standalone: true,
  imports: [EmptyStateComponent],
  templateUrl: './draft-table.component.html',
  styleUrl: './draft-table.component.css'
})
export class DraftTableComponent {
  private readonly permissionService = inject(PermissionService);

  drafts = input.required<readonly DraftListItemResponse[]>();
  continueDraft = output<string>();

  readonly statusLabels = DRAFT_STATUS_LABELS;
  readonly reasonLabels = DRAFT_REASON_LABELS;

  stepLabel(step: string): string {
    return step
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  isTerminal(draft: DraftListItemResponse): boolean {
    return isTerminalDraft(draft.status, draft.draftReason);
  }

  onRowClick(draft: DraftListItemResponse): void {
    if (!this.isTerminal(draft) && this.permissionService.hasPermission('employees:write')) {
      this.continueDraft.emit(draft.id);
    }
  }
}
