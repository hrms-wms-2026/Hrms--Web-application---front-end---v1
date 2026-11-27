import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { StopClickPropagationDirective } from '../../../../shared/directives/stop-click-propagation.directive';

/** One dependency count shown in the archive impact grid. */
export interface ArchiveImpact {
  readonly label: string;
  readonly count: number;
}

/**
 * Archive confirmation dialog shared by the department, position and role archive modals.
 * Each entity modal is a thin wrapper that maps its dependency data onto these inputs.
 */
@Component({
  selector: 'app-archive-confirm-modal',
  standalone: true,
  imports: [StopClickPropagationDirective, ButtonComponent],
  templateUrl: './archive-confirm-modal.component.html',
  styleUrl: './archive-confirm-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'onEscape()' }
})
export class ArchiveConfirmModalComponent {
  /** Lower-case entity word used in the fixed texts, for example "department". */
  readonly entityType = input.required<string>();
  readonly entityName = input.required<string>();
  readonly subtitle = input.required<string>();
  readonly saving = input(false);
  readonly checking = input(false);
  /** Dependency counts. Null hides the impact section (no check or check not loaded yet). */
  readonly impacts = input<readonly ArchiveImpact[] | null>(null);
  /** False shows the blocker alert and disables the confirm button. */
  readonly canArchive = input(true);
  readonly blockerMessages = input<readonly string[]>([]);
  readonly clearMessage = input('');
  readonly warningMessage = input('');
  readonly bodyScrollFade = input(false);

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  onEscape(): void {
    if (!this.saving()) {
      this.cancelled.emit();
    }
  }
}
