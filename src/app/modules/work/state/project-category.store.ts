import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { ProjectCategoryApiService } from '../data-access/project-category-api.service';
import { ProjectCategory } from '../models/project-category.model';

interface ProjectCategoryState {
  readonly categories: readonly ProjectCategory[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly loaded: boolean;
}

const initialState: ProjectCategoryState = { categories: [], loading: false, error: null, loaded: false };

export const ProjectCategoryStore = signalStore(
  { providedIn: 'root' },
  withState<ProjectCategoryState>(initialState),
  withMethods((store, api = inject(ProjectCategoryApiService)) => ({
    async loadCategories(): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const dtos = await firstValueFrom(api.list());
        patchState(store, {
          categories: dtos.map((dto) => ({ id: dto.id, name: dto.name })),
          loading: false,
          loaded: true
        });
      } catch (err: any) {
        patchState(store, {
          error: err?.error?.detail || err?.error?.message || err?.message || 'Failed to load project categories.',
          loading: false,
          loaded: true
        });
      }
    },

    async createCategory(name: string): Promise<ProjectCategory> {
      const dto = await firstValueFrom(api.create(name));
      const category: ProjectCategory = { id: dto.id, name: dto.name };
      patchState(store, {
        categories: [...store.categories(), category].sort((a, b) => a.name.localeCompare(b.name))
      });
      return category;
    }
  }))
);
