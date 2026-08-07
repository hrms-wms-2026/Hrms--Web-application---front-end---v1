import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LegalEntityStore } from '../../../modules/organization/state/legal-entity.store';
import { NavigationStateService } from '../nav/navigation-state.service';
import { NavIconComponent } from './nav-icon.component';

@Component({
  selector: 'app-side-navbar',
  standalone: true,
  imports: [RouterLink, NavIconComponent],
  templateUrl: './side-navbar.component.html',
  styleUrl: './side-navbar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SideNavbarComponent {
  private readonly navState = inject(NavigationStateService);
  private readonly legalEntityStore = inject(LegalEntityStore);

  readonly visibleItems = this.navState.visibleItems;
  readonly activeItem = this.navState.activeItem;

  readonly selectedCompany = this.legalEntityStore.selectedLegalEntity;

  readonly companyInitial = computed(() => {
    const company = this.selectedCompany();
    if (company && company.name) {
      return company.name.trim().charAt(0).toUpperCase();
    }
    return 'O';
  });
}
