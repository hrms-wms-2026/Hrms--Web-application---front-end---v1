import { Component, OnInit, inject, input, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TaskApiService } from '../../data-access/task-api.service';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { CategoryListEditorComponent } from '../../ui/category-list-editor/category-list-editor.component';
import { TaskCategoryColumn } from '../../models/task-category.model';
import { toTaskCategoryColumn } from '../../utils/task-category.mapper';

@Component({
  selector: 'app-task-category-settings-tab',
  standalone: true,
  imports: [ButtonComponent, CategoryListEditorComponent],
  template: `
    <section class="project-settings-tab" data-testid="project-settings-tab-task-categories">
      <div class="project-settings-tab__header">
        <div class="project-settings-tab__heading">
          <span class="project-settings-tab__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10" /><circle cx="18" cy="6" r="1.5" /><circle cx="14" cy="12" r="1.5" /><circle cx="18" cy="18" r="1.5" /></svg></span>
          <div>
            <h2 class="project-settings-tab__title">Task categories</h2>
            <p class="project-settings-tab__description">Organize tasks with the categories used across this project.</p>
          </div>
        </div>
        <app-button variant="secondary" (pressed)="editOpen.set(true)"><svg class="project-settings-tab__edit-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>Edit</app-button>
      </div>

    <app-category-list-editor
      [open]="editOpen()"
      [projectId]="projectId()"
      [categories]="categories()"
      (closed)="editOpen.set(false)"
      (saved)="reload()"
    />
    </section>
  `,
  styles: [`
    .project-settings-tab { border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-surface); padding: 18px 20px; box-shadow: 0 1px 2px rgb(15 23 42 / .03); }
    .project-settings-tab__header { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    .project-settings-tab__heading { display: flex; min-width: 0; align-items: center; gap: 12px; }
    .project-settings-tab__icon { display: inline-flex; width: 34px; height: 34px; flex: 0 0 auto; align-items: center; justify-content: center; border-radius: 9px; background: color-mix(in srgb, var(--color-accent) 10%, var(--color-surface)); color: var(--color-accent); }
    .project-settings-tab__icon svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .project-settings-tab__title { font-size: 15px; font-weight: 600; color: var(--color-text-primary); margin: 0; }
    .project-settings-tab__description { margin: 3px 0 0; color: var(--color-text-secondary); font-size: 12px; }
    .project-settings-tab__edit-icon { width: 14px; height: 14px; margin-right: 6px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; vertical-align: -2px; }
    @media (max-width: 520px) { .project-settings-tab { padding: 16px; } .project-settings-tab__header { align-items: flex-start; } .project-settings-tab__description { max-width: 28ch; } }
  `]
})
export class TaskCategorySettingsTabComponent implements OnInit {
  private readonly taskApi = inject(TaskApiService);

  readonly projectId = input.required<string>();
  protected readonly editOpen = signal(false);
  protected readonly categories = signal<TaskCategoryColumn[]>([]);

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  protected async reload(): Promise<void> {
    const dtos = await firstValueFrom(this.taskApi.getCategories(this.projectId()));
    this.categories.set(dtos.map(toTaskCategoryColumn));
  }
}

