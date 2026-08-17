import { Component, OnInit, computed, inject, input } from '@angular/core';
import { EmployeeDirectoryStore } from '../../state/employee-directory.store';

@Component({
  selector: 'app-employee-avatar',
  standalone: true,
  template: `
    <span class="employee-avatar" [attr.title]="summary()?.name ?? ''" [attr.aria-label]="summary()?.name ?? 'Unknown'">
      @if (summary()?.avatarUrl) {
        <img [src]="summary()!.avatarUrl" [alt]="summary()!.name" class="employee-avatar__img" />
      } @else {
        <span class="employee-avatar__initials">{{ summary()?.initials ?? '?' }}</span>
      }
    </span>
  `,
  styles: [`
    .employee-avatar { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 999px; overflow: hidden; background: var(--color-surface-secondary); color: var(--color-text-primary); font-size: 11px; font-weight: 600; flex-shrink: 0; }
    .employee-avatar__img { width: 100%; height: 100%; object-fit: cover; }
  `]
})
export class EmployeeAvatarComponent implements OnInit {
  private readonly directory = inject(EmployeeDirectoryStore);

  employeeId = input.required<string>();

  protected readonly summary = computed(() => this.directory.get(this.employeeId()));

  ngOnInit(): void {
    void this.directory.ensureLoaded([this.employeeId()]);
  }
}
