import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { TrayPresenceStore } from '../../../../core/tray-presence/state/tray-presence.store';
import { tenantWorkspaceReady } from '../../../../core/tray-presence/utils/tenant-workspace-ready';
import { LegalEntityStore } from '../../../../modules/organization/state/legal-entity.store';
import { CreateLegalEntityRequest } from '../../../../modules/organization/models/legal-entity.model';
import { CreateCompanyModalComponent } from '../../../../modules/organization/ui/create-company-modal/create-company-modal.component';
import { PopoverComponent } from '../../../../shared/ui/popover/popover.component';
import { failedSaveToast } from '../../../../shared/utils/validators';

@Component({
  selector: 'app-company-selector',
  standalone: true,
  imports: [PopoverComponent, CreateCompanyModalComponent],
  templateUrl: './company-selector.component.html',
  styleUrl: './company-selector.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CompanySelectorComponent {
  readonly store = inject(LegalEntityStore);
  private readonly permissionService = inject(PermissionService);
  private readonly notificationService = inject(NotificationService);
  private readonly trayPresence = inject(TrayPresenceStore);
  private readonly authStore = inject(AuthStore);

  readonly isOpen = signal(false);
  readonly showCreateModal = signal(false);

  readonly canCreateLegalEntity = computed(() => this.permissionService.hasPermission('legal_entity:create'));

  readonly selectedCompany = this.store.selectedLegalEntity;
  readonly otherCompanies = this.store.otherCompanies;

  readonly triggerLabel = computed(() => {
    if (this.selectedCompany()) {
      return this.selectedCompany()!.name;
    }
    if (!tenantWorkspaceReady(this.authStore, this.permissionService, this.trayPresence)) {
      return 'Select Company';
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

  constructor() {
    effect(() => {
      if (!tenantWorkspaceReady(this.authStore, this.permissionService, this.trayPresence))
        return;
      if (!this.store.loaded() && !this.store.loading()) {
        this.store.loadCompanies();
      }
    });
  }

  toggle(): void {
    this.isOpen.update((open) => !open);
  }

  close(): void {
    this.isOpen.set(false);
  }

  async selectCompany(legalEntityId: string): Promise<void> {
    const switched = await this.store.selectCompany(legalEntityId);
    if (switched) {
      this.close();
      return;
    }

    this.notificationService.error(this.store.switchError() ?? 'Unable to switch company.');
  }

  onAddCompany(): void {
    this.close();
    this.showCreateModal.set(true);
  }

  closeCreateModal(): void {
    this.showCreateModal.set(false);
  }

  async onCreateCompany(payload: CreateLegalEntityRequest): Promise<void> {
    const success = await this.store.createCompany(payload);
    if (success) {
      this.notificationService.success(`Company '${payload.name}' created successfully.`);
      this.closeCreateModal();
    } else {
      const toast = failedSaveToast(this.store.createApiError(), 'Failed to create company.');
      if (toast) this.notificationService.error(toast);
    }
  }
}
