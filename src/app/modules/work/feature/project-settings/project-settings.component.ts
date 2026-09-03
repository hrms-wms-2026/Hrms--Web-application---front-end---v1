import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TaskStatusSettingsTabComponent } from './task-status-settings-tab.component';
import { TaskCategorySettingsTabComponent } from './task-category-settings-tab.component';

@Component({
  selector: 'app-project-settings',
  standalone: true,
  imports: [TaskStatusSettingsTabComponent, TaskCategorySettingsTabComponent],
  template: `
    <section class="project-settings" data-testid="project-settings-page">
      <div class="project-settings__content" aria-label="Work management settings">
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
  protected readonly projectId = signal(this.route.snapshot.paramMap.get('id') ?? '');
  protected readonly activeTab = signal<'statuses' | 'categories'>('statuses');
}

