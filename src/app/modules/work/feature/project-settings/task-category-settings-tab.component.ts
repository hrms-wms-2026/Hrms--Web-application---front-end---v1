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
        <app-button variant="secondary" (pressed)="editOpen.set(true)">
          <svg class="project-settings-tab__edit-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
          Edit
        </app-button>
      </div>

      @if (categories().length > 0) {
        <div class="project-settings-tab__preview">
          @for (category of categories(); track category.id) {
            <span class="project-settings-tab__chip">
              <svg class="project-settings-tab__chip-icon" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                <line x1="7" y1="7" x2="7.01" y2="7" />
              </svg>
              <span class="project-settings-tab__chip-name">{{ category.name }}</span>
            </span>
          }
        </div>
      }

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
    .project-settings-tab {
      border: 1px solid var(--color-border);
      border-radius: 12px;
      background: var(--color-surface);
      padding: 20px 24px;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
      transition: border-color 150ms ease, box-shadow 150ms ease;
    }
    .project-settings-tab:hover {
      border-color: color-mix(in srgb, var(--color-border) 70%, var(--color-accent, #2563eb));
      box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
    }
    .project-settings-tab__header { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    .project-settings-tab__heading { display: flex; min-width: 0; align-items: center; gap: 14px; }
    .project-settings-tab__icon {
      display: inline-flex;
      width: 40px;
      height: 40px;
      flex: 0 0 auto;
      align-items: center;
      justify-content: center;
      border-radius: 10px;
      background: color-mix(in srgb, var(--color-accent, #2563eb) 10%, var(--color-surface));
      color: var(--color-accent, #2563eb);
    }
    .project-settings-tab__icon svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .project-settings-tab__title { font-size: 15px; font-weight: 600; color: var(--color-text-primary); margin: 0; }
    .project-settings-tab__description { margin: 3px 0 0; color: var(--color-text-secondary); font-size: 12.5px; }
    .project-settings-tab__edit-icon { width: 14px; height: 14px; margin-right: 6px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; vertical-align: -2px; }
    .project-settings-tab__preview {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      margin-top: 14px;
      padding-top: 14px;
      border-top: 1px solid color-mix(in srgb, var(--color-border) 60%, transparent);
    }
    .project-settings-tab__chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 9999px;
      background: color-mix(in srgb, var(--color-border) 20%, var(--color-surface));
      border: 1px solid var(--color-border);
      font-size: 12px;
      font-weight: 500;
      color: var(--color-text-primary);
    }
    .project-settings-tab__chip-icon {
      color: var(--color-text-secondary);
      flex-shrink: 0;
    }
    @media (max-width: 520px) {
      .project-settings-tab { padding: 16px; }
      .project-settings-tab__header { align-items: flex-start; }
      .project-settings-tab__description { max-width: 28ch; }
    }
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

