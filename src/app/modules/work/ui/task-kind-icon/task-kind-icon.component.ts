import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { KIND_META, TaskKind } from '../../utils/task-kind';

/** A work item type's icon in its colour; as a tile, on the type's light tint (Task list cards). */
@Component({
  selector: 'app-task-kind-icon',
  standalone: true,
  template: `
    <span data-testid="task-kind-icon" role="img" [attr.data-kind]="kind()" [attr.aria-label]="meta().label"
      class="inline-flex shrink-0 items-center justify-center {{ meta().color }} {{ tile() ? 'h-7 w-7 rounded-md ' + meta().tint : '' }}">
      <svg [attr.width]="tile() ? 15 : 13" [attr.height]="tile() ? 15 : 13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path [attr.d]="meta().icon" />
      </svg>
    </span>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskKindIconComponent {
  readonly kind = input.required<TaskKind>();
  readonly tile = input(false);

  protected readonly meta = computed(() => KIND_META[this.kind()]);
}
