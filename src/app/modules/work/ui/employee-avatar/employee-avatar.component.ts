import { Component, OnInit, computed, inject, input } from '@angular/core';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { EmployeeDirectoryStore } from '../../state/employee-directory.store';

@Component({
  selector: 'app-employee-avatar',
  standalone: true,
  imports: [AvatarComponent],
  template: `<app-avatar [avatarUrl]="summary()?.avatarUrl" [userName]="summary()?.name" size="sm" />`
})
export class EmployeeAvatarComponent implements OnInit {
  private readonly directory = inject(EmployeeDirectoryStore);

  employeeId = input.required<string>();

  protected readonly summary = computed(() => this.directory.get(this.employeeId()));

  ngOnInit(): void {
    void this.directory.ensureLoaded([this.employeeId()]);
  }
}
