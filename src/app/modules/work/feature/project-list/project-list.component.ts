import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ProjectListStore, AchievedFilter } from '../../state/project-list.store';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { ProjectFilterBarComponent } from '../../ui/project-filter-bar/project-filter-bar.component';
import { ProjectFormModalComponent } from '../../ui/project-form-modal/project-form-modal.component';
import { ProjectSettingsModalComponent } from '../../ui/project-settings-modal/project-settings-modal.component';
import { ProjectListRowComponent } from '../../ui/project-list-row/project-list-row.component';
import { ProjectExplanationCardComponent } from '../../ui/project-explanation-card/project-explanation-card.component';
import { MemberManagementPopupComponent } from '../../ui/member-management-popup/member-management-popup.component';
import { MyInvitationsPanelComponent } from '../../ui/my-invitations-panel/my-invitations-panel.component';
import { ConfirmModalComponent } from '../../../../shared/ui/confirm-modal/confirm-modal.component';
import { BreadcrumbHeaderComponent } from '../../../../shared/ui/breadcrumb-header/breadcrumb-header.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { CreateProjectPayload, EditProjectPayload, Project, ProjectDetail } from '../../models/project.model';

@Component({
  selector: 'app-project-list',
  standalone: true,
  imports: [
    ProjectFilterBarComponent, ProjectFormModalComponent, ProjectSettingsModalComponent, ConfirmModalComponent,
    ProjectListRowComponent, ProjectExplanationCardComponent, MemberManagementPopupComponent,
    MyInvitationsPanelComponent, BreadcrumbHeaderComponent, ButtonComponent, LoaderComponent, ErrorStateComponent, EmptyStateComponent
  ],
  templateUrl: './project-list.component.html',
  styleUrl: './project-list.component.css'
})
export class ProjectListComponent implements OnInit {
  readonly store = inject(ProjectListStore);
  readonly detailStore = inject(ProjectDetailStore);
  private readonly router = inject(Router);

  selectedProjectId = signal<string | null>(null);
  createModalOpen = signal(false);
  settingsModalOpen = signal(false);
  settingsModalInitialValue = signal<ProjectDetail | null>(null);
  membersModalOpen = signal(false);
  deleteConfirmOpen = signal(false);
  private targetProject = signal<Project | null>(null);
  actionSubmitting = signal(false);

  readonly projectMemberPopupItems = computed(() =>
    (this.selectedProject()?.members ?? []).map((member) => ({ id: member.userId, name: member.displayName }))
  );

  readonly selectedProject = computed(() => {
    const list = this.store.filteredProjects();
    if (list.length === 0) return null;
    const id = this.selectedProjectId();
    return list.find((p) => p.id === id) ?? list[0];
  });

  ngOnInit(): void {
    this.store.loadProjects();
    this.detailStore.loadMyInvitations();
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

  async onAddProjectMember(employeeId: string): Promise<void> {
    const project = this.selectedProject();
    if (!project) return;
    await this.store.addProjectMember(project.id, employeeId);
  }

  onProjectSettingsRequested(project: Project): void {
    this.targetProject.set(project);
    this.settingsModalOpen.set(true);
    this.loadFullDetailForSettings(project.id);
  }

  private async loadFullDetailForSettings(id: string): Promise<void> {
    const detail = await this.store.getProjectDetail(id);
    if (detail && this.targetProject()?.id === id) {
      this.settingsModalInitialValue.set(detail);
    }
  }

  async onProjectSettingsSaved(event: { fields: EditProjectPayload; achievedChanged: boolean; achieved: boolean }): Promise<void> {
    const project = this.targetProject();
    if (!project) return;
    this.actionSubmitting.set(true);

    const editSuccess = await this.store.editProject(project.id, event.fields);
    if (!editSuccess) {
      this.actionSubmitting.set(false);
      return;
    }

    if (event.achievedChanged) {
      const achieveSuccess = event.achieved
        ? await this.store.achieveProject(project.id)
        : await this.store.unachieveProject(project.id);
      if (!achieveSuccess) {
        this.actionSubmitting.set(false);
        return;
      }
    }

    this.actionSubmitting.set(false);
    this.settingsModalOpen.set(false);
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

  onCategoryFilterChanged(categoryIds: string[]): void {
    this.store.setCategoryFilter(categoryIds);
  }

  onAchievedFilterChanged(filter: AchievedFilter): void {
    this.store.setAchievedFilter(filter);
  }

  async onAcceptInvitation(invitationId: string): Promise<void> {
    const result = await this.detailStore.acceptInvitation(invitationId);
    if (result.success) {
      await this.detailStore.loadMyInvitations();
      await this.store.loadProjects();
    }
  }

  async onRejectInvitation(invitationId: string): Promise<void> {
    const result = await this.detailStore.rejectInvitation(invitationId);
    if (result.success) {
      await this.detailStore.loadMyInvitations();
    }
  }
}
