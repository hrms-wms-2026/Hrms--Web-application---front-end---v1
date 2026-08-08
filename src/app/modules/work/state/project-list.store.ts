import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { ProjectApiService } from '../data-access/project-api.service';
import { toProject } from '../utils/project.mapper';
import { Project, CreateProjectPayload, EditProjectPayload } from '../models/project.model';

export type AchievedFilter = 'active' | 'archived' | 'all';

interface ProjectListState {
  readonly projects: readonly Project[];
  readonly pageNumber: number;
  readonly pageSize: number;
  readonly totalCount: number;
  readonly selectedCategoryId: string | null;
  readonly achievedFilter: AchievedFilter;
  readonly loading: boolean;
  readonly error: string | null;
}

const initialState: ProjectListState = {
  projects: [], pageNumber: 1, pageSize: 20, totalCount: 0,
  selectedCategoryId: null, achievedFilter: 'all', loading: false, error: null
};

function extractError(err: any, fallback: string): string {
  return err?.error?.detail || err?.error?.message || err?.message || fallback;
}

export const ProjectListStore = signalStore(
  { providedIn: 'root' },
  withState<ProjectListState>(initialState),
  withComputed(({ projects, selectedCategoryId, achievedFilter }) => ({
    filteredProjects: computed(() => {
      const categoryId = selectedCategoryId();
      const status = achievedFilter();
      return projects().filter((p) => {
        if (categoryId && p.categoryId !== categoryId) return false;
        if (status === 'active' && p.isAchieved) return false;
        if (status === 'archived' && !p.isAchieved) return false;
        return true;
      });
    })
  })),
  withMethods((store, api = inject(ProjectApiService)) => ({
    async loadProjects(): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const page = await firstValueFrom(api.listMine(store.pageNumber(), store.pageSize()));
        patchState(store, {
          projects: page.items.map(toProject),
          totalCount: page.totalCount,
          loading: false
        });
      } catch (err) {
        patchState(store, { error: extractError(err, 'Failed to load projects.'), loading: false });
      }
    },

    setCategoryFilter(categoryId: string | null): void {
      patchState(store, { selectedCategoryId: categoryId });
    },

    setAchievedFilter(filter: AchievedFilter): void {
      patchState(store, { achievedFilter: filter });
    },

    async createProject(payload: CreateProjectPayload): Promise<boolean> {
      patchState(store, { error: null });
      try {
        await firstValueFrom(api.create(payload));
        await this.loadProjects();
        return true;
      } catch (err) {
        patchState(store, { error: extractError(err, 'Failed to create project.') });
        return false;
      }
    },

    async editProject(id: string, payload: EditProjectPayload): Promise<boolean> {
      patchState(store, { error: null });
      try {
        await firstValueFrom(api.edit(id, payload));
        await this.loadProjects();
        return true;
      } catch (err) {
        patchState(store, { error: extractError(err, 'Failed to save changes.') });
        return false;
      }
    },

    async deleteProject(id: string): Promise<boolean> {
      patchState(store, { error: null });
      try {
        await firstValueFrom(api.delete(id));
        await this.loadProjects();
        return true;
      } catch (err) {
        patchState(store, { error: extractError(err, 'Failed to delete project.') });
        return false;
      }
    },

    async achieveProject(id: string): Promise<boolean> {
      patchState(store, { error: null });
      try {
        await firstValueFrom(api.achieve(id));
        await this.loadProjects();
        return true;
      } catch (err) {
        patchState(store, { error: extractError(err, 'Failed to achieve project.') });
        return false;
      }
    },

    async unachieveProject(id: string): Promise<boolean> {
      patchState(store, { error: null });
      try {
        await firstValueFrom(api.unachieve(id));
        await this.loadProjects();
        return true;
      } catch (err) {
        patchState(store, { error: extractError(err, 'Failed to unachieve project.') });
        return false;
      }
    }
  }))
);
