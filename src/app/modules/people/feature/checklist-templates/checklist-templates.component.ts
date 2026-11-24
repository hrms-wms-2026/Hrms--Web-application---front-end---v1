import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
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
import { ChecklistBuilderComponent } from '../checklist-builder/checklist-builder.component';

import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DataTableCellDirective, DataTableColumn, DataTableComponent } from '../../../../shared/ui/data-table/data-table.component';

@Component({
  selector: 'app-checklist-templates',
  standalone: true,
  imports: [
    DataTableComponent,
    DataTableCellDirective,
    BreadcrumbHeaderComponent,
    ButtonComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    LoaderComponent,
    ChecklistBuilderComponent
  ],
  templateUrl: './checklist-templates.component.html',
  styleUrl: './checklist-templates.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChecklistTemplatesComponent {
  protected readonly templateColumns = computed<DataTableColumn[]>(() => [
    { key: 'name', label: 'Template Name' },
    { key: 'type', label: 'Type', filterValue: (t: ChecklistTemplateListItemResponse) => (t.templateType === 'onboarding' ? 'Onboarding' : 'Offboarding') },
    { key: 'applicability', label: 'Applicability', filterValue: (t: ChecklistTemplateListItemResponse) => this.getScopeBadgeLabel(t) },
    { key: 'tasks', label: 'Tasks' },
    { key: 'status', label: 'Status', filterValue: (t: ChecklistTemplateListItemResponse) => (t.isActive ? 'Active' : 'Archived') },
    ...(this.canManage() ? [{ key: 'actions', label: 'Actions', interactive: true, shrink: true, align: 'end' as const }] : [])
  ]);
  protected readonly trackById = (template: { id: string }): string => template.id;
  protected readonly isArchived = (template: { isActive: boolean }): boolean => !template.isActive;

  readonly store = inject(ChecklistTemplateStore);
  private readonly legalEntityStore = inject(LegalEntityStore);
  private readonly permissionService = inject(PermissionService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute, { optional: true });

  readonly isModalOpen = signal(false);
  readonly selectedTemplateId = signal<string | null>(null);

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

    if (this.route) {
      this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
        if (params.get('create') === 'true') {
          this.selectedTemplateId.set(null);
          this.isModalOpen.set(true);
        } else if (params.get('edit')) {
          this.selectedTemplateId.set(params.get('edit'));
          this.isModalOpen.set(true);
        }
      });
    }
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
    this.selectedTemplateId.set(null);
    this.isModalOpen.set(true);
  }

  openEditModal(template: ChecklistTemplateListItemResponse): void {
    this.selectedTemplateId.set(template.id);
    this.isModalOpen.set(true);
  }

  onModalClose(): void {
    this.isModalOpen.set(false);
    this.selectedTemplateId.set(null);
    if (this.route && this.route.snapshot.queryParamMap.keys.length > 0) {
      void this.router.navigate([], { relativeTo: this.route, queryParams: {} });
    }
  }

  onModalSaved(): void {
    this.isModalOpen.set(false);
    this.selectedTemplateId.set(null);
    if (this.route && this.route.snapshot.queryParamMap.keys.length > 0) {
      void this.router.navigate([], { relativeTo: this.route, queryParams: {} });
    }
    this.loadTemplates();
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

