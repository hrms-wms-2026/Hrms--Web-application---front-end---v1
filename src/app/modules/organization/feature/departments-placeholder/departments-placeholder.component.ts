import { ChangeDetectionStrategy, Component } from '@angular/core';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';

/**
 * Minimal placeholder shell for Departments management route (/organization/departments).
 * Department management screens and API interactions will be built in Part 2F.
 */
@Component({
  selector: 'app-departments-placeholder',
  standalone: true,
  imports: [PageHeaderComponent, EmptyStateComponent],
  template: `
    <app-page-header title="Departments" subtitle="Manage the department structure for the selected Company." />
    <app-empty-state
      title="Department Management"
      description="Department hierarchy and management features will be connected in subsequent implementation phases."
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DepartmentsPlaceholderComponent {}
