import { Component, input } from '@angular/core';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';

@Component({
  selector: 'app-coming-soon-panel',
  standalone: true,
  imports: [EmptyStateComponent],
  template: `<app-empty-state [title]="title() + ' — Coming soon'" description="This view isn't built yet." />`
})
export class ComingSoonPanelComponent {
  title = input.required<string>();
}
