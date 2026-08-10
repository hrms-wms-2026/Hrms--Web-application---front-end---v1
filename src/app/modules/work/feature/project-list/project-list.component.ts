import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ProjectListStore, AchievedFilter } from '../../state/project-list.store';
import { ProjectCardComponent } from '../../ui/project-card/project-card.component';
import { ProjectFilterBarComponent } from '../../ui/project-filter-bar/project-filter-bar.component';
import { ProjectFormModalComponent } from '../../ui/project-form-modal/project-form-modal.component';
import { ConfirmModalComponent } from '../../../../shared/ui/confirm-modal/confirm-modal.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { CreateProjectPayload, EditProjectPayload, Project, ProjectDetail } from '../../models/project.model';

@Component({
  selector: 'app-project-list',
  standalone: true,
  imports: [
    ProjectCardComponent, ProjectFilterBarComponent, ProjectFormModalComponent, ConfirmModalComponent,
    PageHeaderComponent, ButtonComponent, LoaderComponent, ErrorStateComponent, EmptyStateComponent
  ],
  templateUrl: './project-list.component.html'
})
export class ProjectListComponent implements OnInit {
  readonly store = inject(ProjectListStore);
  private readonly router = inject(Router);

  formModalOpen = signal(false);
  formModalMode = signal<'create' | 'edit'>('create');
  formModalInitialValue = signal<Project | ProjectDetail | null>(null);
  deleteConfirmOpen = signal(false);
  achieveConfirmOpen = signal(false);
  private targetProject = signal<Project | null>(null);
  actionSubmitting = signal(false);

  ngOnInit(): void {
    this.store.loadProjects();
  }

  onView(project: Project): void {
    this.router.navigate(['/work', project.id]);
  }

  openCreateModal(): void {
    this.formModalMode.set('create');
    this.formModalInitialValue.set(null);
    this.formModalOpen.set(true);
  }

  openEditModal(project: Project): void {
    this.targetProject.set(project);
    this.formModalMode.set('edit');
    this.formModalInitialValue.set(project);
    this.formModalOpen.set(true);
    this.loadFullDetailForEdit(project.id);
  }

  private async loadFullDetailForEdit(id: string): Promise<void> {
    const detail = await this.store.getProjectDetail(id);
    if (detail && this.targetProject()?.id === id) {
      this.formModalInitialValue.set(detail);
    }
  }

  async onCreateSubmit(payload: CreateProjectPayload): Promise<void> {
    this.actionSubmitting.set(true);
    const success = await this.store.createProject(payload);
    this.actionSubmitting.set(false);
    if (success) {
      this.formModalOpen.set(false);
    }
  }

  async onEditSubmit(payload: EditProjectPayload): Promise<void> {
    const project = this.targetProject();
    if (!project) return;
    this.actionSubmitting.set(true);
    const success = await this.store.editProject(project.id, payload);
    this.actionSubmitting.set(false);
    if (success) {
      this.formModalOpen.set(false);
    }
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

  openAchieveConfirm(project: Project): void {
    this.targetProject.set(project);
    this.achieveConfirmOpen.set(true);
  }

  async onAchieveConfirmed(): Promise<void> {
    const project = this.targetProject();
    if (!project) return;
    this.actionSubmitting.set(true);
    const success = project.isAchieved
      ? await this.store.unachieveProject(project.id)
      : await this.store.achieveProject(project.id);
    this.actionSubmitting.set(false);
    if (success) {
      this.achieveConfirmOpen.set(false);
    }
  }

  onCategoryFilterChanged(categoryId: string | null): void {
    this.store.setCategoryFilter(categoryId);
  }

  onAchievedFilterChanged(filter: AchievedFilter): void {
    this.store.setAchievedFilter(filter);
  }
}
