import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OccupantPreviewItem } from '../../models/position.model';

/**
 * A rendered slot in the seat-stack. Discriminated union:
 * - 'employee' : an assigned occupant (avatar or initials)
 * - 'empty'    : a vacant seat (gray circle)
 * - 'overflow' : the +n summary circle
 */
export type SeatSlot =
  | { kind: 'employee'; item: OccupantPreviewItem }
  | { kind: 'empty' }
  | { kind: 'overflow'; n: number };

/**
 * Compact horizontal seat-stack preview for a position.
 *
 * Display rule (maxVisible = 4):
 *  - If maxOccupancy <= 3: show all seats (≤ 3 circles, no overflow).
 *  - If maxOccupancy == 4: show all 4 seats (no overflow needed — within limit).
 *  - If maxOccupancy > 4:  show 3 seat circles + 1 overflow circle (+n).
 *    n = maxOccupancy - 3  (hidden *capacity* seats, not just hidden employees).
 *
 *  Assigned employees fill visible circles first; empty gray circles fill the rest.
 *
 * Avatar rule:
 *  - Use avatarUrl only if backend explicitly provides a non-null, non-empty string.
 *  - avatarFileId is NEVER used as an image URL.
 *  - If no avatarUrl: render initials text inside the circle.
 *  - Empty seat: gray circle with "Empty seat" aria-label.
 */
@Component({
  selector: 'app-position-seat-preview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './position-seat-preview.component.html',
  styleUrl: './position-seat-preview.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PositionSeatPreviewComponent {
  /** Total active PrimaryEmployment assignments. Default 0 for stale-backend safety. */
  @Input() assignedCount = 0;
  /** Total seat capacity for this position. Default 1. */
  @Input() maxOccupancy = 1;
  /** Occupant preview items from backend (capped at 4 by backend). Default []. */
  @Input() occupantPreview: readonly OccupantPreviewItem[] = [];
  /** assignedCount - occupantPreview.length (never used for rendering; kept for consumers). */
  @Input() remainingAssignedCount = 0;
  /** Maximum circles visible before the overflow indicator. Do not change without updating tests. */
  @Input() maxVisible = 4;

  /** Builds the ordered list of slot descriptors used by the template. */
  get slots(): SeatSlot[] {
    const max = Math.max(0, this.maxOccupancy);
    const assigned = Math.max(0, this.assignedCount);
    const preview = this.occupantPreview ?? [];

    // How many explicit (non-overflow) circles to render
    const useOverflow = max > this.maxVisible;
    // When overflow is active, we only show (maxVisible - 1) explicit circles
    const explicitSlots = useOverflow ? this.maxVisible - 1 : max;

    const slots: SeatSlot[] = [];

    for (let i = 0; i < explicitSlots; i++) {
      if (i < preview.length) {
        slots.push({ kind: 'employee', item: preview[i] });
      } else if (i < assigned) {
        // More assigned than preview items — show as empty (fallback, should not happen
        // with well-behaved backend that provides previews for all visible slots)
        slots.push({ kind: 'empty' });
      } else {
        slots.push({ kind: 'empty' });
      }
    }

    if (useOverflow) {
      const n = max - explicitSlots; // = maxOccupancy - (maxVisible - 1) = maxOccupancy - 3
      slots.push({ kind: 'overflow', n });
    }

    return slots;
  }

  /** True if backend provided a usable avatar URL (never derives one from avatarFileId). */
  hasAvatarUrl(item: OccupantPreviewItem): boolean {
    return typeof item.avatarUrl === 'string' && item.avatarUrl.trim().length > 0;
  }

  /** Safe initials to display (falls back to '?' which backend also sends as its defensive default). */
  getInitials(item: OccupantPreviewItem): string {
    return item.initials?.trim() || '?';
  }

  /** Aria-label for an assigned employee circle. */
  employeeAriaLabel(item: OccupantPreviewItem): string {
    return item.displayName?.trim()
      ? `Assigned: ${item.displayName}`
      : 'Assigned employee';
  }

  /** Title tooltip for an assigned employee circle. */
  employeeTitle(item: OccupantPreviewItem): string {
    return item.displayName?.trim() || 'Assigned employee';
  }

  /** TrackBy for the slots ngFor. */
  trackSlot(index: number, _slot: SeatSlot): number {
    return index;
  }
}
