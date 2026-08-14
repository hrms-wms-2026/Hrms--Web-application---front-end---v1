import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { BreadcrumbHeaderComponent } from '../../../../shared/ui/breadcrumb-header/breadcrumb-header.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { LegalEntityStore } from '../../../organization/state/legal-entity.store';
import {
  ChecklistTemplateListItemResponse,
  ChecklistTemplateListParams,
  ChecklistTemplateType
} from '../../models/checklist-template.model';
import { ChecklistTemplateStore } from '../../state/checklist-template.store';

@Component({
  selector: 'app-checklist-templates',
  standalone: true,
  imports: [
    BreadcrumbHeaderComponent,
    ButtonComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    LoaderComponent
  ],
  templateUrl: './checklist-templates.component.html',
  styleUrl: './checklist-templates.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChecklistTemplatesComponent {
  readonly store = inject(ChecklistTemplateStore);
  private readonly legalEntityStore = inject(LegalEntityStore);
  private readonly permissionService = inject(PermissionService);
  private readonly router = inject(Router);

  readonly canManage = computed(() => this.permissionService.hasPermission('employees:write'));
  readonly selectedCompany = this.legalEntityStore.selectedLegalEntity;

  readonly activeTypeTab = signal<'all' | 'onboarding' | 'offboarding'>('all');

  readonly emptyStateTitle = computed(() => {
    switch (this.activeTypeTab()) {
      case 'onboarding':
        return 'No onboarding checklist templates have been created yet.';
      case 'offboarding':
        return 'No offboarding checklist templates have been created yet.';
      default:
        return 'No checklist templates have been created yet.';
    }
  });

  constructor() {
    effect(() => {
      const filters = this.buildFilters();
      if (filters) {
        this.store.setFilters(filters);
      }
    });
  }

  private buildFilters(): Partial<ChecklistTemplateListParams> | null {
    const company = this.selectedCompany();
    if (!company) {
      return null;
    }
    return {
      legalEntityId: company.id,
      templateType: this.activeTypeTab() === 'all' ? undefined : (this.activeTypeTab() as ChecklistTemplateType),
      includeInactive: false
    };
  }

  setTypeTab(tab: 'all' | 'onboarding' | 'offboarding'): void {
    this.activeTypeTab.set(tab);
  }

  openCreateModal(): void {
    void this.router.navigate(['/people/checklists/new']);
  }

  openEditModal(template: ChecklistTemplateListItemResponse): void {
    void this.router.navigate(['/people/checklists', template.id, 'edit']);
  }

  async onArchiveTemplate(template: ChecklistTemplateListItemResponse): Promise<void> {
    if (confirm(`Are you sure you want to archive "${template.name}"?`)) {
      await this.store.archiveTemplate(template.id);
    }
  }

  getScopeBadgeLabel(tmpl: ChecklistTemplateListItemResponse): string {
    if (tmpl.positionName) {
      return `Position: ${tmpl.positionName}`;
    }
    if (tmpl.departmentName) {
      return `Department: ${tmpl.departmentName}`;
    }
    return 'Company default';
  }

  loadTemplates(): void {
    this.store.loadTemplates();
  }
}

