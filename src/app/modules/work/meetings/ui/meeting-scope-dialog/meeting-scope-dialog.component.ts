import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ModalComponent } from '../../../../../shared/ui/modal/modal.component';
import { MeetingScope } from '../../models/meeting.models';

const LABELS: Record<MeetingScope, string> = { this: 'This occurrence', following: 'This and following', all: 'All occurrences' };

/** "Which occurrences?" for an edit, cancel or move of a recurring meeting. */
@Component({
  selector: 'app-meeting-scope-dialog',
  standalone: true,
  imports: [ModalComponent],
  template: `
    <app-modal [open]="open()" [title]="title()" size="md" (closed)="cancelled.emit()">
      <div class="flex flex-col gap-2">
        @for (scope of scopes(); track scope) {
          <button type="button" data-testid="meeting-scope-option"
            class="rounded-md border border-[var(--color-border)] px-3 py-2 text-left text-sm hover:bg-[var(--color-surface-secondary)]"
            (click)="chosen.emit(scope)">{{ label(scope) }}</button>
        }
      </div>
    </app-modal>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MeetingScopeDialogComponent {
  readonly open = input(false);
  readonly title = input('Which occurrences?');
  readonly scopes = input<readonly MeetingScope[]>(['this', 'following', 'all']);
  readonly chosen = output<MeetingScope>();
  readonly cancelled = output<void>();

  protected label(scope: MeetingScope): string {
    return LABELS[scope];
  }
}
