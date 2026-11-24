import { inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { computed } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DepartmentApiService } from '../data-access/department-api.service';
import {
  CreateDepartmentRequest,
  DepartmentArchiveDependencyResponse,
  DepartmentListItemResponse,
  DepartmentTreeNodeResponse,
  ListDepartmentsQueryParams,
  UpdateDepartmentRequest
} from '../models/department.model';

export interface DepartmentState {
  readonly legalEntityId: string | null;
  readonly viewMode: 'tree' | 'list';
  readonly searchQuery: string;
  readonly includeInactive: boolean;
  readonly treeData: readonly DepartmentTreeNodeResponse[];
  readonly flatItems: readonly DepartmentListItemResponse[];
  readonly page: number;
  readonly pageSize: number;
  readonly totalCount: number;
  readonly totalPages: number;
  readonly loading: boolean;
  readonly saving: boolean;
  readonly archiveChecking: boolean;
  readonly loadError: string | null;
  readonly actionError: string | null;
  /** The last failed create/update as an ApiError, so the form can show field errors (task 20). */
  readonly actionApiError: ApiError | null;
  readonly archiveDependency: DepartmentArchiveDependencyResponse | null;
}

const initialState: DepartmentState = {
  legalEntityId: null,
  viewMode: 'tree',
  searchQuery: '',
  includeInactive: false,
  treeData: [],
  flatItems: [],
  page: 1,
  pageSize: 25,
  totalCount: 0,
  totalPages: 1,
  loading: false,
  saving: false,
  archiveChecking: false,
  loadError: null,
  actionError: null, actionApiError: null,
  archiveDependency: null
};

import { toSafeErrorMessage } from '../../../core/services/error-handler.service';
import { ApiError, toApiError } from '../../../core/errors/api-error';

export const DepartmentStore = signalStore(
  { providedIn: 'root' },
  withState<DepartmentState>(initialState),
  withComputed(({ treeData, flatItems, viewMode }) => ({
    hasDepartments: computed(() => (viewMode() === 'tree' ? treeData().length > 0 : flatItems().length > 0)),
    allFlatList: computed(() => {
      if (viewMode() === 'list') return flatItems();
      const result: DepartmentListItemResponse[] = [];
      function flatten(nodes: readonly DepartmentTreeNodeResponse[]) {
        if (!nodes || !Array.isArray(nodes)) return;
        for (const n of nodes) {
          result.push({
            id: n.id,
            legalEntityId: n.legalEntityId,
            name: n.name,
            code: n.code,
            parentDepartmentId: n.parentDepartmentId,
            headPositionId: n.headPositionId,
            isActive: n.isActive,
            createdAt: '',
            updatedAt: null,
            positionCount: n.positionCount,
            employeeCount: n.employeeCount,
            headPositionTitle: n.headPositionTitle
          });
          if (n.children && n.children.length > 0) {
            flatten(n.children);
          }
        }
      }
      flatten(treeData());
      return result;
    })
  })),
  withMethods((store, api = inject(DepartmentApiService)) => ({
    setViewMode(viewMode: 'tree' | 'list'): void {
      patchState(store, { viewMode });
      const leId = store.legalEntityId();
      if (leId) {
        this.load(leId);
      }
    },

    setSearch(searchQuery: string): void {
      patchState(store, { searchQuery, page: 1 });
      const leId = store.legalEntityId();
      if (leId) {
        this.load(leId);
      }
    },

    setIncludeInactive(includeInactive: boolean): void {
      patchState(store, { includeInactive, page: 1 });
      const leId = store.legalEntityId();
      if (leId) {
        this.load(leId);
      }
    },

    async load(legalEntityId: string): Promise<void> {
      patchState(store, { legalEntityId, loading: true, loadError: null });
      const mode = store.viewMode();
      const search = store.searchQuery();
      const includeInactive = store.includeInactive();

      try {
        if (mode === 'tree') {
          const res = await firstValueFrom(api.listTree(legalEntityId, { search, includeInactive }));
          if (store.legalEntityId() !== legalEntityId) return;
          patchState(store, { treeData: res.treeItems, loading: false });
        } else {
          const params: ListDepartmentsQueryParams = {
            view: 'flat',
            search,
            includeInactive,
            page: store.page(),
            pageSize: store.pageSize(),
            sortBy: 'name',
            sortDirection: 'asc'
          };
          const res = await firstValueFrom(api.listFlat(legalEntityId, params));
          if (store.legalEntityId() !== legalEntityId) return;
          patchState(store, {
            flatItems: res.items,
            page: res.page,
            pageSize: res.pageSize,
            totalCount: res.totalCount,
            totalPages: res.totalPages,
            loading: false
          });
        }
      } catch (err) {
        if (store.legalEntityId() !== legalEntityId) return;
        patchState(store, { loading: false, loadError: toSafeErrorMessage(err, 'Failed to load departments.') });
      }
    },

    async createDepartment(legalEntityId: string, payload: CreateDepartmentRequest): Promise<boolean> {
      patchState(store, { saving: true, actionError: null, actionApiError: null });
      try {
        await firstValueFrom(api.createDepartment(legalEntityId, payload));
        patchState(store, { saving: false });
        await this.load(legalEntityId);
        return true;
      } catch (err) {
        const apiError = toApiError(err, 'Failed to create department.');
        patchState(store, { saving: false, actionError: apiError.message, actionApiError: apiError });
        return false;
      }
    },

    async updateDepartment(legalEntityId: string, departmentId: string, payload: UpdateDepartmentRequest): Promise<boolean> {
      patchState(store, { saving: true, actionError: null, actionApiError: null });
      try {
        await firstValueFrom(api.updateDepartment(legalEntityId, departmentId, payload));
        patchState(store, { saving: false });
        await this.load(legalEntityId);
        return true;
      } catch (err) {
        const apiError = toApiError(err, 'Failed to update department.');
        patchState(store, { saving: false, actionError: apiError.message, actionApiError: apiError });
        return false;
      }
    },

    async checkArchive(legalEntityId: string, departmentId: string): Promise<DepartmentArchiveDependencyResponse | null> {
      patchState(store, { archiveChecking: true, actionError: null, archiveDependency: null });
      try {
        const res = await firstValueFrom(api.checkArchive(legalEntityId, departmentId));
        patchState(store, { archiveChecking: false, archiveDependency: res });
        return res;
      } catch (err) {
        patchState(store, { archiveChecking: false, actionError: toSafeErrorMessage(err, 'Failed to check archive blockers.') });
        return null;
      }
    },

    async archiveDepartment(legalEntityId: string, departmentId: string): Promise<boolean> {
      patchState(store, { saving: true, actionError: null, actionApiError: null });
      try {
        await firstValueFrom(api.archiveDepartment(legalEntityId, departmentId));
        patchState(store, { saving: false, archiveDependency: null });
        await this.load(legalEntityId);
        return true;
      } catch (err) {
        patchState(store, { saving: false, actionError: toSafeErrorMessage(err, 'Failed to archive department.') });
        return false;
      }
    },

    async restoreDepartment(legalEntityId: string, departmentId: string): Promise<boolean> {
      patchState(store, { saving: true, actionError: null, actionApiError: null });
      try {
        await firstValueFrom(api.restoreDepartment(legalEntityId, departmentId));
        patchState(store, { saving: false });
        await this.load(legalEntityId);
        return true;
      } catch (err) {
        patchState(store, { saving: false, actionError: toSafeErrorMessage(err, 'Failed to restore department.') });
        return false;
      }
    }
  }))
);
