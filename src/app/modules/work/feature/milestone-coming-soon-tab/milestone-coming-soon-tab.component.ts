import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ComingSoonPanelComponent } from '../../ui/coming-soon-panel/coming-soon-panel.component';

@Component({
  selector: 'app-milestone-coming-soon-tab',
  standalone: true,
  imports: [ComingSoonPanelComponent],
  template: `<app-coming-soon-panel [title]="title" />`
})
export class MilestoneComingSoonTabComponent {
  private readonly route = inject(ActivatedRoute);
  readonly title: string = this.route.snapshot.data['title'] ?? 'This view';
}
