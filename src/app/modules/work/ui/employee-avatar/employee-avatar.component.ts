import { Component, computed, effect, inject, input, untracked } from '@angular/core';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { EmployeeDirectoryStore } from '../../state/employee-directory.store';

@Component({
  selector: 'app-employee-avatar',
  standalone: true,
  imports: [AvatarComponent],
  template: `
    <div class="inline-flex items-center gap-1.5 min-w-0">
      <app-avatar [avatarUrl]="summary()?.avatarUrl" [userName]="summary()?.name" size="sm" />
      @if (showName() && summary()?.name) {
        <span
          class="truncate text-xs font-medium"
          [class]="invertText() ? 'text-[var(--color-text-on-solid)] font-semibold' : 'text-[var(--color-text-secondary)]'"
          data-testid="employee-owner-name"
        >
          {{ summary()?.name }}
        </span>
      }
    </div>
  `
})
export class EmployeeAvatarComponent {
  private readonly directory = inject(EmployeeDirectoryStore);

  employeeId = input.required<string>();
  showName = input<boolean>(false);
  invertText = input<boolean>(false);

  protected readonly summary = computed(() => this.directory.get(this.employeeId()));

  constructor() {
    // Re-resolve whenever the id changes, not just on init: callers often bind an id that is
    // still empty on first render (e.g. the current user's id arriving from /me) and fills in later.
    effect(() => {
      const id = this.employeeId();
      if (id) untracked(() => void this.directory.ensureLoaded([id]));
    });
  }
}
