import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { EmptyStateComponent } from '../../../../../shared/ui/empty-state/empty-state.component';

/**
 * Placeholder for the period-based tabs (Attendance, Work & Activity) until their
 * employee-scoped backend aggregates exist. Title/description come from the route data.
 */
@Component({
  selector: 'app-employee-upcoming-tab',
  standalone: true,
  imports: [EmptyStateComponent],
  template: `
    <app-empty-state [title]="title" [description]="description" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeUpcomingTabComponent {
  private readonly data = inject(ActivatedRoute).snapshot.data;

  readonly title: string = this.data['placeholderTitle'] ?? 'Coming soon';
  readonly description: string = this.data['placeholderDescription'] ?? '';
}
