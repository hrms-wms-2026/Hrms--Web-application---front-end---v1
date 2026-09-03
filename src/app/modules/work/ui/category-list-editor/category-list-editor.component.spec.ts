import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { of } from 'rxjs';
import { CategoryListEditorComponent } from './category-list-editor.component';
import { TaskApiService } from '../../data-access/task-api.service';
import { TaskCategoryColumn } from '../../models/task-category.model';
import { TaskCategoryDto } from '../../models/dto/task-category.dto';

describe('CategoryListEditorComponent', () => {
  const categories: TaskCategoryColumn[] = [
    { id: 'c3', name: 'Story', displayOrder: 2 },
    { id: 'c1', name: 'Task', displayOrder: 0 },
    { id: 'c2', name: 'Bug', displayOrder: 1 }
  ];

  function setup() {
    const reorderTaskCategories = vi.fn().mockReturnValue(of(categories as TaskCategoryDto[]));
    const createCategory = vi.fn().mockReturnValue(of({ id: 'c4', name: 'Feature', displayOrder: 3 } as TaskCategoryDto));
    const editCategory = vi.fn().mockReturnValue(of(undefined));
    const deleteCategory = vi.fn().mockReturnValue(of(undefined));
    TestBed.configureTestingModule({
      imports: [CategoryListEditorComponent],
      providers: [{ provide: TaskApiService, useValue: { reorderTaskCategories, createCategory, editCategory, deleteCategory } }]
    });
    const fixture = TestBed.createComponent(CategoryListEditorComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('projectId', 'project-1');
    fixture.componentRef.setInput('categories', categories);
    return { fixture, reorderTaskCategories, createCategory, editCategory, deleteCategory };
  }

  it('renders categories sorted by display order', () => {
    const { fixture } = setup();
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('.category-list__row');
    expect(rows.length).toBe(3);
    expect(Array.from(rows as NodeListOf<HTMLElement>).map((row) => row.querySelector('.category-list__name')?.textContent?.trim()))
      .toEqual(['Task', 'Bug', 'Story']);
  });

  it('saves the current row order through reorderTaskCategories', async () => {
    const { fixture, reorderTaskCategories } = setup();
    fixture.detectChanges();
    fixture.componentInstance.onDrop({ previousIndex: 0, currentIndex: 2 } as Parameters<typeof fixture.componentInstance.onDrop>[0]);

    const updateButton = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .find((button) => button.textContent?.includes('Update'))!;
    updateButton.click();
    await fixture.whenStable();

    expect(reorderTaskCategories).toHaveBeenCalledWith('project-1', [
      { categoryId: 'c2', displayOrder: 0 },
      { categoryId: 'c3', displayOrder: 1 },
      { categoryId: 'c1', displayOrder: 2 }
    ]);
  });

  it('adds a category and appends it to the list', async () => {
    const { fixture, createCategory } = setup();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.category-list__add-icon') as HTMLButtonElement).click();
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('.category-list__new-input') as HTMLInputElement;
    input.value = 'Feature';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .find((button) => button.textContent?.trim() === 'Add')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(createCategory).toHaveBeenCalledWith('project-1', { name: 'Feature', displayOrder: 3 });
    expect(Array.from(fixture.nativeElement.querySelectorAll('.category-list__name') as NodeListOf<HTMLElement>)
      .map((element) => element.textContent?.trim())).toContain('Feature');
  });

  it('renames a category through the edit endpoint', async () => {
    const { fixture, editCategory } = setup();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.category-list__edit-icon') as HTMLButtonElement).click();
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('.category-list__rename-input') as HTMLInputElement;
    input.value = 'Work item';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .find((button) => button.textContent?.trim() === 'Save')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(editCategory).toHaveBeenCalledWith('c1', { name: 'Work item', displayOrder: 0 });
    expect(fixture.nativeElement.querySelector('.category-list__name')?.textContent?.trim()).toBe('Work item');
  });

  it('deletes a category and removes its row', async () => {
    const { fixture, deleteCategory } = setup();
    fixture.detectChanges();
    const firstDelete = fixture.nativeElement.querySelector('.category-list__delete-icon') as HTMLButtonElement;
    firstDelete.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(deleteCategory).toHaveBeenCalledWith('c1');
    expect(Array.from(fixture.nativeElement.querySelectorAll('.category-list__name') as NodeListOf<HTMLElement>)
      .map((element) => element.textContent?.trim())).toEqual(['Bug', 'Story']);
  });
});

