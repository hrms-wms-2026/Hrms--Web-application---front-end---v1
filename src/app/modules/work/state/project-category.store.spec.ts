import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ProjectCategoryStore } from './project-category.store';
import { ProjectCategoryApiService } from '../data-access/project-category-api.service';
import { ProjectCategoryDto } from '../models/dto/project-category.dto';

describe('ProjectCategoryStore', () => {
  function setup(apiOverrides: Partial<ProjectCategoryApiService> = {}) {
    TestBed.configureTestingModule({
      providers: [{ provide: ProjectCategoryApiService, useValue: apiOverrides }]
    });
    return TestBed.inject(ProjectCategoryStore);
  }

  it('loads categories successfully', async () => {
    const dtos: ProjectCategoryDto[] = [{ id: 'cat1', name: 'Backend' }];
    const store = setup({ list: () => of(dtos) } as Partial<ProjectCategoryApiService>);

    await store.loadCategories();

    expect(store.categories()).toEqual([{ id: 'cat1', name: 'Backend' }]);
    expect(store.loading()).toBe(false);
    expect(store.loaded()).toBe(true);
    expect(store.error()).toBeNull();
  });

  it('sets an error and still marks loaded on failure', async () => {
    const store = setup({
      list: () => throwError(() => ({ error: { detail: 'Not Found' } }))
    } as Partial<ProjectCategoryApiService>);

    await store.loadCategories();

    expect(store.categories()).toEqual([]);
    expect(store.loading()).toBe(false);
    expect(store.loaded()).toBe(true);
    expect(store.error()).toBe('Not Found');
  });

  it('creates a category and appends it to the sorted list', async () => {
    const dtos: ProjectCategoryDto[] = [{ id: 'cat1', name: 'Backend' }];
    const created: ProjectCategoryDto = { id: 'cat2', name: 'Analytics' };
    const store = setup({
      list: () => of(dtos),
      create: () => of(created)
    } as Partial<ProjectCategoryApiService>);

    await store.loadCategories();
    const result = await store.createCategory('Analytics');

    expect(result).toEqual({ id: 'cat2', name: 'Analytics' });
    expect(store.categories()).toEqual([
      { id: 'cat2', name: 'Analytics' },
      { id: 'cat1', name: 'Backend' }
    ]);
  });

  it('propagates errors from creating a category without mutating state', async () => {
    const store = setup({
      list: () => of([]),
      create: () => throwError(() => ({ error: { detail: 'Duplicate name' } }))
    } as Partial<ProjectCategoryApiService>);

    await store.loadCategories();
    await expect(store.createCategory('Backend')).rejects.toBeTruthy();

    expect(store.categories()).toEqual([]);
  });
});
