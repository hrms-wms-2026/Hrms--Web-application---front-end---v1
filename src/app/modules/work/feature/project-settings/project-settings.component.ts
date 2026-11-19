import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NotificationService } from '../../../../core/services/notification.service';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { ProjectListStore } from '../../state/project-list.store';
import { ProjectGeneralSettingsComponent, ProjectGeneralSettingsSave } from './project-general-settings.component';
import { TaskStatusSettingsTabComponent } from './task-status-settings-tab.component';
import { TaskCategorySettingsTabComponent } from './task-category-settings-tab.component';

@Component({
  selector: 'app-project-settings',
  standalone: true,
  imports: [ProjectGeneralSettingsComponent, TaskStatusSettingsTabComponent, TaskCategorySettingsTabComponent],
  template: `
    <section class="project-settings" data-testid="project-settings-page">
      <div class="project-settings__content" aria-label="Work management settings">
        @if (detailStore.project(); as project) {
          <app-project-general-settings
            [project]="project"
            [submitting]="submitting()"
            [errorMessage]="projectStore.error() ?? ''"
            (saved)="onProjectSettingsSaved($event)"
          />
        }
        <app-task-status-settings-tab [projectId]="projectId()" />
        <app-task-category-settings-tab [projectId]="projectId()" />
      </div>
    </section>
  `,
  styles: [`
    .project-settings { width: min(100%, 1040px); margin: 0 auto; padding: 8px 0 24px; }
    .project-settings__content { display: flex; flex-direction: column; gap: 14px; }
    @media (max-width: 640px) { .project-settings { padding-inline: 0; } }
  `]
})
export class ProjectSettingsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly notificationService = inject(NotificationService);
  protected readonly detailStore = inject(ProjectDetailStore);
  protected readonly projectStore = inject(ProjectListStore);
  protected readonly projectId = signal(this.route.snapshot.paramMap.get('id') ?? '');
  protected readonly submitting = signal(false);

  protected async onProjectSettingsSaved(event: ProjectGeneralSettingsSave): Promise<void> {
    const projectId = this.projectId();
    if (!projectId) return;

    this.submitting.set(true);
    const editSuccess = await this.projectStore.editProject(projectId, event.fields);
    if (!editSuccess) {
      this.submitting.set(false);
      return;
    }

    const logoSuccess = event.logoFile
      ? await this.projectStore.setProjectLogo(projectId, event.logoFile)
      : event.removeLogo ? await this.projectStore.removeProjectLogo(projectId) : true;
    if (!logoSuccess) {
      await this.detailStore.loadProject(projectId);
      this.submitting.set(false);
      return;
    }

    if (event.achievedChanged) {
      const lifecycleSuccess = event.achieved
        ? await this.projectStore.achieveProject(projectId)
        : await this.projectStore.unachieveProject(projectId);
      if (!lifecycleSuccess) {
        await this.detailStore.loadProject(projectId);
        this.submitting.set(false);
        return;
      }
    }

    await this.detailStore.loadProject(projectId);
    this.submitting.set(false);
    this.notificationService.success('Project settings saved.');
  }
}

