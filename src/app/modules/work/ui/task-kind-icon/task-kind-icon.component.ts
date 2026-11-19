import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { EntityIconComponent } from '../../../../shared/ui/entity-icon/entity-icon.component';
import { parseEntityIcon } from '../../../../shared/ui/entity-icon/entity-icon.registry';
import { KIND_META, TaskKind } from '../../utils/task-kind';

/**
 * A work item's icon in its type's colour: the category's picked icon, or the type's own while it has none (or one this
 * build doesn't offer). As a tile, it sits on the type's light tint (Task list cards).
 */
@Component({
  selector: 'app-task-kind-icon',
  standalone: true,
  imports: [EntityIconComponent],
  template: `
    <span data-testid="task-kind-icon" role="img" [attr.data-kind]="kind()" [attr.aria-label]="meta().label"
      class="inline-flex shrink-0 items-center justify-center {{ meta().color }} {{ tile() ? 'h-7 w-7 rounded-md ' + meta().tint : '' }}">
      @if (hasPickedIcon()) {
        <app-entity-icon data-testid="task-kind-picked-icon" [icon]="icon()" [bare]="true" [style.--entity-icon-size]="tile() ? '15px' : '13px'" />
      } @else {
        <svg [attr.width]="tile() ? 15 : 13" [attr.height]="tile() ? 15 : 13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path [attr.d]="meta().icon" />
        </svg>
      }
    </span>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskKindIconComponent {
  readonly kind = input.required<TaskKind>();
  /** The category's stored icon ("lucide:{name}" or "emoji:{emoji}"). */
  readonly icon = input<string | null | undefined>(null);
  readonly tile = input(false);

  protected readonly meta = computed(() => KIND_META[this.kind()]);
  protected readonly hasPickedIcon = computed(() => parseEntityIcon(this.icon()) !== null);
}
