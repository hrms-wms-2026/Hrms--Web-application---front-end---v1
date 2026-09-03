import { Component, OnInit, computed, inject, input } from '@angular/core';
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
          [class]="invertText() ? 'text-white font-semibold' : 'text-[var(--color-text-secondary)]'"
          data-testid="employee-owner-name"
        >
          {{ summary()?.name }}
        </span>
      }
    </div>
  `
})
export class EmployeeAvatarComponent implements OnInit {
  private readonly directory = inject(EmployeeDirectoryStore);

  employeeId = input.required<string>();
  showName = input<boolean>(false);
  invertText = input<boolean>(false);

  protected readonly summary = computed(() => this.directory.get(this.employeeId()));

  ngOnInit(): void {
    void this.directory.ensureLoaded([this.employeeId()]);
  }
}
