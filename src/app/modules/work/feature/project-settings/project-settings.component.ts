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
      <header class="project-settings__header">
        <div>
          <p class="project-settings__eyebrow">Project settings</p>
          <h1 class="project-settings__title">Work management</h1>
        </div>
      </header>

      <nav class="project-settings__tabs" aria-label="Project settings sections" role="tablist">
        <button
          type="button"
          role="tab"
          [attr.aria-selected]="activeTab() === 'statuses'"
          [class.project-settings__tab--active]="activeTab() === 'statuses'"
          (click)="activeTab.set('statuses')"
        >Task Status</button>
        <button
          type="button"
          role="tab"
          [attr.aria-selected]="activeTab() === 'categories'"
          [class.project-settings__tab--active]="activeTab() === 'categories'"
          (click)="activeTab.set('categories')"
        >Task Category</button>
      </nav>

      <div class="project-settings__content">
        @if (activeTab() === 'statuses') {
          <app-task-status-settings-tab [projectId]="projectId()" />
        } @else {
          <app-task-category-settings-tab [projectId]="projectId()" />
        }
      </div>
    </section>
  `,
  styles: [`
    .project-settings { max-width: 960px; margin: 0 auto; }
    .project-settings__header { padding: 8px 0 18px; }
    .project-settings__eyebrow { margin: 0 0 4px; color: var(--color-text-secondary); font-size: 12px; }
    .project-settings__title { margin: 0; color: var(--color-text-primary); font-size: 22px; font-weight: 700; }
    .project-settings__tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--color-border); margin-bottom: 20px; }
    .project-settings__tab { border: 0; border-bottom: 2px solid transparent; background: transparent; color: var(--color-text-secondary); cursor: pointer; padding: 10px 14px; font-size: 13px; }
    .project-settings__tab--active { border-bottom-color: var(--color-primary); color: var(--color-text-primary); font-weight: 600; }
    .project-settings__content { min-height: 120px; }
  `]
})
export class ProjectSettingsComponent {
  private readonly route = inject(ActivatedRoute);
  protected readonly projectId = signal(this.route.snapshot.paramMap.get('id') ?? '');
  protected readonly activeTab = signal<'statuses' | 'categories'>('statuses');
}

