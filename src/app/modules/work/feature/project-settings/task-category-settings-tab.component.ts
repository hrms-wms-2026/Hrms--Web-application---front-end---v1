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
    <div class="project-settings-tab__header" data-testid="project-settings-tab-task-categories">
      <h2 class="project-settings-tab__title">Task categories</h2>
      <app-button variant="secondary" (pressed)="editOpen.set(true)">Edit</app-button>
    </div>

    <app-category-list-editor
      [open]="editOpen()"
      [projectId]="projectId()"
      [categories]="categories()"
      (closed)="editOpen.set(false)"
      (saved)="reload()"
    />
  `,
  styles: [`
    .project-settings-tab__header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .project-settings-tab__title { font-size: 15px; font-weight: 600; color: var(--color-text-primary); margin: 0; }
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

