import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NavIconComponent } from '../../../layouts/main-layout/side-navbar/nav-icon.component';
import { NavIconName } from '../../../layouts/main-layout/nav/nav-item.model';

@Component({
  selector: 'app-breadcrumb-header',
  standalone: true,
  imports: [NavIconComponent],
  templateUrl: './breadcrumb-header.component.html',
  styleUrl: './breadcrumb-header.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BreadcrumbHeaderComponent {
  parentLabel = input.required<string>();
  currentLabel = input.required<string>();
  icon = input<NavIconName | undefined>(undefined);
}
