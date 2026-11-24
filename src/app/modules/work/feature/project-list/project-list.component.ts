import { Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { ProjectListStore, AchievedFilter } from '../../state/project-list.store';
import { ProjectCategoryStore } from '../../state/project-category.store';
import { DataTableColumnFilters, DataTableFilterValues } from '../../../../shared/ui/data-table/data-table.component';
import { ProjectFilterBarComponent } from '../../ui/project-filter-bar/project-filter-bar.component';
import { ProjectFormModalComponent } from '../../ui/project-form-modal/project-form-modal.component';
import { ProjectListRowComponent } from '../../ui/project-list-row/project-list-row.component';
import { ProjectExplanationCardComponent } from '../../ui/project-explanation-card/project-explanation-card.component';
import { ProjectTableViewComponent } from '../../ui/project-table-view/project-table-view.component';
import { ProjectCardComponent } from '../../ui/project-card/project-card.component';
import { MemberManagementPopupComponent } from '../../ui/member-management-popup/member-management-popup.component';
import { ConfirmModalComponent } from '../../../../shared/ui/confirm-modal/confirm-modal.component';
import { BreadcrumbHeaderComponent } from '../../../../shared/ui/breadcrumb-header/breadcrumb-header.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ViewModeOption, ViewModeToggleComponent } from '../../../../shared/ui/view-mode-toggle/view-mode-toggle.component';
import { CreateProjectPayload, Project } from '../../models/project.model';

export type ProjectViewMode = 'table' | 'list' | 'card';

@Component({
  selector: 'app-project-list',
  standalone: true,
  imports: [
    ProjectFilterBarComponent, ProjectFormModalComponent, ConfirmModalComponent,
    ProjectListRowComponent, ProjectExplanationCardComponent, ProjectTableViewComponent, ProjectCardComponent,
    MemberManagementPopupComponent, BreadcrumbHeaderComponent, ButtonComponent, ViewModeToggleComponent,
    LoaderComponent, ErrorStateComponent, EmptyStateComponent
  ],
  templateUrl: './project-list.component.html',
  styleUrl: './project-list.component.css'
})
export class ProjectListComponent implements OnInit {
  readonly store = inject(ProjectListStore);
  readonly categoryStore = inject(ProjectCategoryStore);
  private readonly router = inject(Router);

  readonly viewModes: readonly ViewModeOption[] = [
    { value: 'list', label: 'List', icon: 'list' },
    { value: 'card', label: 'Card', icon: 'card' },
    { value: 'table', label: 'Table', icon: 'table' }
  ];
  viewMode = signal<ProjectViewMode>(this.loadInitialViewMode());
  expandedCardIds = signal<Set<string>>(new Set());

  selectedProjectId = signal<string | null>(null);
  createModalOpen = signal(false);
  membersModalOpen = signal(false);
  deleteConfirmOpen = signal(false);
  private targetProject = signal<Project | null>(null);
  actionSubmitting = signal(false);

  private loadInitialViewMode(): ProjectViewMode {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem('projects_view_mode');
      if (saved === 'table' || saved === 'list' || saved === 'card') {
        return saved;
      }
    }
    return 'list';
  }

  setViewMode(mode: ProjectViewMode): void {
    this.viewMode.set(mode);
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('projects_view_mode', mode);
    }
  }

  onViewModeChange(mode: string): void {
    this.setViewMode(mode as ProjectViewMode);
  }

  toggleCardExpand(id: string): void {
    this.expandedCardIds.update((set) => {
      const next = new Set(set);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  readonly projectMemberPopupItems = computed(() =>
    (this.selectedProject()?.members ?? []).map((member) => ({
      id: member.userId,
      name: member.displayName,
      avatarFileId: member.avatarFileId
    }))
  );

  readonly selectedProject = computed(() => {
    const list = this.store.filteredProjects();
    if (list.length === 0) return null;
    const id = this.selectedProjectId();
    return list.find((p) => p.id === id) ?? list[0];
  });

  ngOnInit(): void {
    this.store.loadProjects();
  }

  onSelectProject(project: Project): void {
    if (this.selectedProject()?.id === project.id) {
      this.onView(project);
    } else {
      this.selectedProjectId.set(project.id);
    }
  }

  onView(project: Project): void {
    this.router.navigate(['/work', project.id]);
  }

  async onAchieve(project: Project): Promise<void> {
    this.actionSubmitting.set(true);
    await this.store.achieveProject(project.id);
    this.actionSubmitting.set(false);
  }

  openCreateModal(): void {
    this.createModalOpen.set(true);
  }

  async onCreateSubmit(payload: CreateProjectPayload): Promise<void> {
    this.actionSubmitting.set(true);
    const success = await this.store.createProject(payload);
    this.actionSubmitting.set(false);
    if (success) {
      this.createModalOpen.set(false);
    }
  }

  onMembersRequested(): void {
    this.membersModalOpen.set(true);
  }

  onMembersRequestedForProject(project: Project): void {
    this.selectedProjectId.set(project.id);
    this.membersModalOpen.set(true);
  }

  async onAddProjectMember(employeeId: string): Promise<void> {
    const project = this.selectedProject();
    if (!project) return;
    await this.store.addProjectMember(project.id, employeeId);
  }

  onProjectSettingsRequested(project: Project): void {
    this.router.navigate(['/work', project.id, 'settings']);
  }

  openDeleteConfirm(project: Project): void {
    this.targetProject.set(project);
    this.deleteConfirmOpen.set(true);
  }

  async onDeleteConfirmed(): Promise<void> {
    const project = this.targetProject();
    if (!project) return;
    this.actionSubmitting.set(true);
    const success = await this.store.deleteProject(project.id);
    this.actionSubmitting.set(false);
    if (success) {
      this.deleteConfirmOpen.set(false);
    }
  }

  private readonly projectFilters = viewChild(ProjectFilterBarComponent);

  /** The Category and Status column headers offer the same filters as the filter bar. */
  readonly headerFilters = computed<DataTableColumnFilters>(() => ({
    category: { kind: 'multi', options: this.categoryStore.categories().map((c) => ({ value: c.id, label: c.name })) },
    status: { kind: 'single', options: [{ value: 'active', label: 'Active' }, { value: 'archived', label: 'Archived' }] }
  }));
  readonly headerFilterValues = computed<DataTableFilterValues>(() => ({
    category: this.store.selectedCategoryIds(),
    status: this.store.achievedFilter() === 'all' ? [] : [this.store.achievedFilter()]
  }));
  readonly hasHeaderFilter = computed(() => Object.values(this.headerFilterValues()).some((v) => !!v?.length));

  /** Route header changes through the filter bar so its own state (and count) stays in sync. */
  onHeaderFilterChanged(change: { key: string; values: string[] }): void {
    const bar = this.projectFilters();
    if (change.key === 'category') {
      if (bar) bar.selectCategories(change.values); else this.onCategoryFilterChanged(change.values);
    } else if (change.key === 'status') {
      const status = (change.values[0] ?? 'all') as AchievedFilter;
      if (bar) bar.selectStatus(status); else this.onAchievedFilterChanged(status);
    }
  }

  onCategoryFilterChanged(categoryIds: string[]): void {
    this.store.setCategoryFilter(categoryIds);
  }

  onAchievedFilterChanged(filter: AchievedFilter): void {
    this.store.setAchievedFilter(filter);
  }
}
