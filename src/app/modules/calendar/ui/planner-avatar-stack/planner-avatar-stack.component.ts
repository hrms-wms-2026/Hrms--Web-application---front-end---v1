import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { EmployeeAvatarComponent } from '../../../work/ui/employee-avatar/employee-avatar.component';

/** Who attends, on a meeting block in the Planner: the first few avatars, then "+N" for the rest. Nothing for no one. */
@Component({
  selector: 'app-planner-avatar-stack',
  standalone: true,
  imports: [EmployeeAvatarComponent],
  template: `
    @if (employeeIds().length > 0) {
      <span data-testid="avatar-stack" class="flex items-center">
        @for (id of shown(); track id) {
          <span class="-ml-1 first:ml-0 rounded-full ring-2 ring-[var(--color-surface)]"><app-employee-avatar [employeeId]="id" /></span>
        }
        @if (more() > 0) {
          <span data-testid="avatar-stack-more"
            class="-ml-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--color-surface-secondary)] px-1 text-[10px] font-semibold text-[var(--color-text-secondary)] ring-2 ring-[var(--color-surface)]">+{{ more() }}</span>
        }
      </span>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlannerAvatarStackComponent {
  readonly employeeIds = input<readonly string[]>([]);
  readonly max = input(3);

  protected readonly shown = computed(() => this.employeeIds().slice(0, this.max()));
  protected readonly more = computed(() => Math.max(0, this.employeeIds().length - this.max()));
}
