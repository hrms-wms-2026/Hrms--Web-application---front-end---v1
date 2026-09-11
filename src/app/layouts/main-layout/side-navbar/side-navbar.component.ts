import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LegalEntityApiService } from '../../../modules/organization/data-access/legal-entity-api.service';
import { LegalEntityStore } from '../../../modules/organization/state/legal-entity.store';
import { CompanyLogoTileComponent } from '../../../shared/ui/company-logo-tile/company-logo-tile.component';
import { NavigationStateService } from '../nav/navigation-state.service';
import { NavIconComponent } from './nav-icon.component';

@Component({
  selector: 'app-side-navbar',
  standalone: true,
  imports: [RouterLink, NavIconComponent, CompanyLogoTileComponent],
  templateUrl: './side-navbar.component.html',
  styleUrl: './side-navbar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SideNavbarComponent {
  private readonly navState = inject(NavigationStateService);
  private readonly legalEntityStore = inject(LegalEntityStore);
  private readonly legalEntityApi = inject(LegalEntityApiService);

  readonly visibleItems = this.navState.visibleItems;
  readonly activeItem = this.navState.activeItem;

  readonly selectedCompany = this.legalEntityStore.selectedLegalEntity;

  // Same URL construction as GeneralSettingsComponent.logoUrl() - the only real
  // logo-serving route is GET /api/v1/org/legal-entities/{id}/logo (confirmed against
  // HRMS-Backend-v1's LegalEntitiesController; there is no generic /api/v1/files/{id} route).
  readonly companyLogoUrl = computed(() => {
    const company = this.selectedCompany();
    return company?.logoFileId ? this.legalEntityApi.getLogoUrl(company.id, company.logoFileId) : null;
  });

  readonly canExpandSubSidebar = this.navState.canExpandSubSidebar;

  expandSubSidebar(): void {
    this.navState.expandSubSidebar();
  }
}
