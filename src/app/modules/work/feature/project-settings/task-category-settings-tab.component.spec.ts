import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { of } from 'rxjs';
import { TaskCategorySettingsTabComponent } from './task-category-settings-tab.component';
import { TaskApiService } from '../../data-access/task-api.service';

describe('TaskCategorySettingsTabComponent', () => {
  it('loads categories using the project id input', async () => {
    const getCategories = vi.fn().mockReturnValue(of([
      { id: 'c-1', name: 'Feature', displayOrder: 0 }
    ]));
    TestBed.configureTestingModule({
      imports: [TaskCategorySettingsTabComponent],
      providers: [{ provide: TaskApiService, useValue: { getCategories, createCategory: vi.fn(), editCategory: vi.fn(), deleteCategory: vi.fn(), reorderTaskCategories: vi.fn() } }]
    });
    const fixture = TestBed.createComponent(TaskCategorySettingsTabComponent);
    fixture.componentRef.setInput('projectId', 'project-1');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(getCategories).toHaveBeenCalledWith('project-1');
    expect(fixture.nativeElement.textContent).toContain('Task categories');
  });
});

