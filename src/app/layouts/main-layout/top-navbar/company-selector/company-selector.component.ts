import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { LegalEntityStore } from '../../../../modules/organization/state/legal-entity.store';
import { PopoverComponent } from '../../../../shared/ui/popover/popover.component';

@Component({
  selector: 'app-company-selector',
  standalone: true,
  imports: [PopoverComponent],
  templateUrl: './company-selector.component.html',
  styleUrl: './company-selector.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CompanySelectorComponent implements OnInit {
  readonly store = inject(LegalEntityStore);
  private readonly permissionService = inject(PermissionService);
  private readonly notificationService = inject(NotificationService);

  readonly isOpen = signal(false);

  readonly hasOrgAccess = computed(() => {
    return (
      this.permissionService.hasModule('org_structure') &&
      this.permissionService.hasAnyPermission(['org:read', 'org:manage'])
    );
  });

  readonly canCreateLegalEntity = computed(() => this.permissionService.hasPermission('legal_entity:create'));

  readonly selectedCompany = this.store.selectedLegalEntity;
  readonly otherCompanies = this.store.otherCompanies;

  readonly triggerLabel = computed(() => {
    if (this.selectedCompany()) {
      return this.selectedCompany()!.name;
    }
    if (this.store.loading()) {
      return 'Loading companies...';
    }
    if (this.store.error()) {
      return 'Company unavailable';
    }
    if (this.store.loaded() && this.store.companies().length === 0) {
      return 'No companies';
    }
    return 'Select Company';
  });

  ngOnInit(): void {
    if (this.hasOrgAccess() && !this.store.loaded() && !this.store.loading()) {
      this.store.loadCompanies();
    }
  }

  toggle(): void {
    this.isOpen.update((open) => !open);
  }

  close(): void {
    this.isOpen.set(false);
  }

  selectCompany(legalEntityId: string): void {
    this.store.selectCompany(legalEntityId);
    this.close();
  }

  onAddCompany(): void {
    this.close();
    this.notificationService.info('Add Company flow will be available in Part 2D.');
  }
}
