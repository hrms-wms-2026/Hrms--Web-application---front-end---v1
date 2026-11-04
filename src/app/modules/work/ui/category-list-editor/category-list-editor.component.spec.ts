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
    { id: 'c2', name: 'Bug', displayOrder: 1, kind: 'bug' },
    { id: 'c9', name: 'meeting', displayOrder: 3, systemKey: 'meeting', isSystem: true, kind: 'meeting' }
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
    expect(rows.length).toBe(4);
    expect(Array.from(rows as NodeListOf<HTMLElement>).map((row) => row.querySelector('.category-list__name')?.textContent?.trim()))
      .toEqual(['Task', 'Bug', 'Story', 'meeting']);
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
      { categoryId: 'c1', displayOrder: 2 },
      { categoryId: 'c9', displayOrder: 3 }
    ]);
  });

  it('adds a category and appends it to the list', async () => {
    const { fixture, createCategory } = setup();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.category-list__add-icon') as HTMLButtonElement).click();
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('.category-list__add-form input') as HTMLInputElement;
    input.value = 'Feature';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .find((button) => button.textContent?.trim() === 'Add')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(createCategory).toHaveBeenCalledWith('project-1', { name: 'Feature', displayOrder: 4, kind: 'task' });
    expect(Array.from(fixture.nativeElement.querySelectorAll('.category-list__name') as NodeListOf<HTMLElement>)
      .map((element) => element.textContent?.trim())).toContain('Feature');
  });

  it('the Add row has its own Type select (user types only, Task by default) and sends the chosen type', async () => {
    const { fixture, createCategory } = setup();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.category-list__add-icon') as HTMLButtonElement).click();
    fixture.detectChanges();

    const type = fixture.nativeElement.querySelector('[data-testid="category-add-kind-select"]') as HTMLSelectElement;
    expect(type.value).toBe('task');
    expect(Array.from(type.options).map((o) => o.value)).toEqual(['task', 'bug', 'story', 'feature', 'testing']);

    type.value = 'bug';
    type.dispatchEvent(new Event('change'));
    const input = fixture.nativeElement.querySelector('.category-list__add-form input') as HTMLInputElement;
    input.value = 'Hotfix';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .find((button) => button.textContent?.trim() === 'Add')!.click();
    await fixture.whenStable();

    expect(createCategory).toHaveBeenCalledWith('project-1', { name: 'Hotfix', displayOrder: 4, kind: 'bug' });
  });

  it('the Add row starts again at Task after a cancel', () => {
    const { fixture } = setup();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.category-list__add-icon') as HTMLButtonElement).click();
    fixture.detectChanges();
    const type = fixture.nativeElement.querySelector('[data-testid="category-add-kind-select"]') as HTMLSelectElement;
    type.value = 'story';
    type.dispatchEvent(new Event('change'));
    Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .find((button) => button.textContent?.trim() === 'Cancel')!.click();
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.category-list__add-icon') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect((fixture.nativeElement.querySelector('[data-testid="category-add-kind-select"]') as HTMLSelectElement).value).toBe('task');
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
      .map((element) => element.textContent?.trim())).toEqual(['Bug', 'Story', 'meeting']);
  });

  it('shows a lock badge and no edit or delete buttons on system categories', () => {
    const { fixture } = setup();
    fixture.detectChanges();

    const rows = Array.from(fixture.nativeElement.querySelectorAll('.category-list__row') as NodeListOf<HTMLElement>);
    const meetingRow = rows.find((row) => row.querySelector('.category-list__name')?.textContent?.trim() === 'meeting')!;
    expect(meetingRow.querySelector('.category-list__system-badge')).not.toBeNull();
    expect(meetingRow.querySelector('.category-list__edit-icon')).toBeNull();
    expect(meetingRow.querySelector('.category-list__delete-icon')).toBeNull();
  });

  it('keeps system categories in the saved order', async () => {
    const { fixture, reorderTaskCategories } = setup();
    fixture.detectChanges();

    Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .find((button) => button.textContent?.includes('Update'))!.click();
    await fixture.whenStable();

    expect(reorderTaskCategories).toHaveBeenCalledWith('project-1', expect.arrayContaining([{ categoryId: 'c9', displayOrder: 3 }]));
  });
  it('each row has a Type select; changing it saves the kind', async () => {
    const { fixture, editCategory } = setup();
    fixture.detectChanges();
    const selects = fixture.nativeElement.querySelectorAll('[data-testid="category-kind-select"]') as NodeListOf<HTMLSelectElement>;
    // Task, Bug, Story have a select; the system meeting row shows its type read-only.
    expect(selects.length).toBe(3);
    expect(selects[1].value).toBe('bug');
    expect(selects[0].value).toBe('task');
    expect(Array.from(selects[0].options).map((o) => o.value)).toEqual(['task', 'bug', 'story', 'feature', 'testing']);

    selects[0].value = 'testing';
    selects[0].dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(editCategory).toHaveBeenCalledWith('c1', { name: 'Task', displayOrder: 0, kind: 'testing' });
  });

  it('a system category shows its type and cannot change it', () => {
    const { fixture } = setup();
    fixture.detectChanges();
    const rows = fixture.nativeElement.querySelectorAll('.category-list__row') as NodeListOf<HTMLElement>;

    expect(rows[3].querySelector('[data-testid="category-kind-select"]')).toBeNull();
    expect(rows[3].querySelector('[data-testid="category-kind-readonly"]')!.textContent!.trim()).toBe('Meeting');
  });
});

