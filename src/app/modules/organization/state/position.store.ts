import { inject } from '@angular/core';
import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { PositionApiService } from '../data-access/position-api.service';
import {
  AddCoverageRecordRequest,
  CreatePositionRequest,
  ListPositionsQueryParams,
  ManagementCoverageRecordResponse,
  PositionArchiveBlockers,
  PositionListItemResponse,
  PositionTreeNodeResponse,
  UpdateCoverageRecordRequest,
  UpdatePositionRequest
} from '../models/position.model';

export interface PositionState {
  readonly legalEntityId: string | null;
  readonly viewMode: 'tree' | 'list';
  readonly departmentFilterId: string | null;
  readonly searchQuery: string;
  readonly includeInactive: boolean;
  readonly treeData: readonly PositionTreeNodeResponse[];
  readonly flatItems: readonly PositionListItemResponse[];
  readonly page: number;
  readonly pageSize: number;
  readonly totalCount: number;
  readonly totalPages: number;
  readonly loading: boolean;
  readonly saving: boolean;
  readonly archiveChecking: boolean;
  readonly archiveBlockers: PositionArchiveBlockers | null;
  readonly loadError: string | null;
  readonly actionError: string | null;
  readonly coverageRecords: readonly ManagementCoverageRecordResponse[];
  readonly coverageLoading: boolean;
  readonly coverageSaving: boolean;
  readonly coverageError: string | null;
  readonly selectedCoveragePosition: PositionListItemResponse | PositionTreeNodeResponse | null;
}

const initialState: PositionState = {
  legalEntityId: null,
  viewMode: 'tree',
  departmentFilterId: null,
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
  archiveBlockers: null,
  loadError: null,
  actionError: null,
  coverageRecords: [],
  coverageLoading: false,
  coverageSaving: false,
  coverageError: null,
  selectedCoveragePosition: null
};

function extractErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'error' in err) {
    const body = (err as { error?: { detail?: string; title?: string; message?: string; errors?: Record<string, string[] | string> } }).error;
    if (body?.detail) return body.detail;
    if (body?.message) return body.message;
    if (body?.title && body.title !== 'One or more validation errors occurred.') return body.title;
    if (body?.errors) {
      const firstKey = Object.keys(body.errors)[0];
      if (firstKey && body.errors[firstKey]) {
        const val = body.errors[firstKey];
        return Array.isArray(val) ? val[0] : val;
      }
    }
  }
  return fallback;
}

export const PositionStore = signalStore(
  { providedIn: 'root' },
  withState<PositionState>(initialState),
  withComputed(({ treeData, flatItems, viewMode }) => ({
    hasPositions: computed(() => (viewMode() === 'tree' ? treeData().length > 0 : flatItems().length > 0)),
    allPositionsList: computed(() => {
      if (viewMode() === 'list') return flatItems();
      const result: PositionListItemResponse[] = [];
      function flatten(nodes: readonly PositionTreeNodeResponse[]) {
        for (const n of nodes) {
          result.push({
            id: n.id,
            legalEntityId: n.legalEntityId,
            departmentId: n.departmentId,
            name: n.name,
            code: n.code,
            positionType: n.positionType,
            maxOccupancy: n.maxOccupancy,
            reportsToPositionId: n.reportsToPositionId,
            isActive: n.isActive,
            createdAt: '',
            updatedAt: null
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
  withMethods((store, api = inject(PositionApiService)) => ({
    setViewMode(viewMode: 'tree' | 'list'): void {
      patchState(store, { viewMode });
      const leId = store.legalEntityId();
      if (leId) {
        this.load(leId);
      }
    },

    setDepartmentFilter(departmentFilterId: string | null): void {
      patchState(store, { departmentFilterId, page: 1 });
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
      const departmentId = store.departmentFilterId() || undefined;

      try {
        if (mode === 'tree') {
          const res = await firstValueFrom(api.listTree(legalEntityId, includeInactive));
          if (store.legalEntityId() !== legalEntityId) return;
          patchState(store, { treeData: res, loading: false });
        } else {
          const params: ListPositionsQueryParams = {
            departmentId,
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
        patchState(store, { loading: false, loadError: extractErrorMessage(err, 'Failed to load positions.') });
      }
    },

    async createPosition(legalEntityId: string, payload: CreatePositionRequest): Promise<boolean> {
      patchState(store, { saving: true, actionError: null });
      try {
        await firstValueFrom(api.createPosition(legalEntityId, payload));
        patchState(store, { saving: false });
        await this.load(legalEntityId);
        return true;
      } catch (err) {
        patchState(store, { saving: false, actionError: extractErrorMessage(err, 'Failed to create position.') });
        return false;
      }
    },

    async updatePosition(legalEntityId: string, positionId: string, payload: UpdatePositionRequest): Promise<boolean> {
      patchState(store, { saving: true, actionError: null });
      try {
        await firstValueFrom(api.updatePosition(legalEntityId, positionId, payload));
        patchState(store, { saving: false });
        await this.load(legalEntityId);
        return true;
      } catch (err) {
        patchState(store, { saving: false, actionError: extractErrorMessage(err, 'Failed to update position.') });
        return false;
      }
    },

    async checkArchive(legalEntityId: string, positionId: string): Promise<PositionArchiveBlockers | null> {
      patchState(store, { archiveChecking: true, actionError: null, archiveBlockers: null });
      try {
        const res = await firstValueFrom(api.checkArchive(legalEntityId, positionId));
        patchState(store, { archiveChecking: false, archiveBlockers: res });
        return res;
      } catch (err) {
        patchState(store, { archiveChecking: false, actionError: extractErrorMessage(err, 'Failed to check archive blockers.') });
        return null;
      }
    },

    async archivePosition(legalEntityId: string, positionId: string): Promise<boolean> {
      patchState(store, { saving: true, actionError: null });
      try {
        await firstValueFrom(api.archivePosition(legalEntityId, positionId));
        patchState(store, { saving: false, archiveBlockers: null });
        await this.load(legalEntityId);
        return true;
      } catch (err) {
        patchState(store, { saving: false, actionError: extractErrorMessage(err, 'Failed to archive position.') });
        return false;
      }
    },

    async restorePosition(legalEntityId: string, positionId: string): Promise<boolean> {
      patchState(store, { saving: true, actionError: null });
      try {
        await firstValueFrom(api.restorePosition(legalEntityId, positionId));
        patchState(store, { saving: false });
        await this.load(legalEntityId);
        return true;
      } catch (err) {
        patchState(store, { saving: false, actionError: extractErrorMessage(err, 'Failed to restore position.') });
        return false;
      }
    },

    async loadCoverage(
      legalEntityId: string,
      position: PositionListItemResponse | PositionTreeNodeResponse
    ): Promise<void> {
      patchState(store, {
        selectedCoveragePosition: position,
        coverageLoading: true,
        coverageError: null,
        coverageRecords: []
      });
      try {
        const res = await firstValueFrom(api.listCoverage(legalEntityId, position.id));
        patchState(store, { coverageRecords: res, coverageLoading: false });
      } catch (err) {
        patchState(store, {
          coverageLoading: false,
          coverageError: extractErrorMessage(err, 'Failed to load management coverage records.')
        });
      }
    },

    async addCoverage(
      legalEntityId: string,
      positionId: string,
      payload: AddCoverageRecordRequest
    ): Promise<boolean> {
      patchState(store, { coverageSaving: true, coverageError: null });
      try {
        await firstValueFrom(api.addCoverage(legalEntityId, positionId, payload));
        const res = await firstValueFrom(api.listCoverage(legalEntityId, positionId));
        patchState(store, { coverageRecords: res, coverageSaving: false });
        return true;
      } catch (err) {
        patchState(store, {
          coverageSaving: false,
          coverageError: extractErrorMessage(err, 'Failed to add management coverage record.')
        });
        return false;
      }
    },

    async updateCoverage(
      legalEntityId: string,
      positionId: string,
      coverageId: string,
      payload: UpdateCoverageRecordRequest
    ): Promise<boolean> {
      patchState(store, { coverageSaving: true, coverageError: null });
      try {
        const updated = await firstValueFrom(api.updateCoverage(legalEntityId, positionId, coverageId, payload));
        patchState(store, {
          coverageRecords: store.coverageRecords().map((record) => (record.id === updated.id ? updated : record)),
          coverageSaving: false
        });
        return true;
      } catch (err) {
        patchState(store, {
          coverageSaving: false,
          coverageError: extractErrorMessage(err, 'Failed to update management coverage record.')
        });
        return false;
      }
    },

    async removeCoverage(
      legalEntityId: string,
      positionId: string,
      coverageId: string
    ): Promise<boolean> {
      patchState(store, { coverageSaving: true, coverageError: null });
      try {
        await firstValueFrom(api.removeCoverage(legalEntityId, positionId, coverageId));
        const res = await firstValueFrom(api.listCoverage(legalEntityId, positionId));
        patchState(store, { coverageRecords: res, coverageSaving: false });
        return true;
      } catch (err) {
        patchState(store, {
          coverageSaving: false,
          coverageError: extractErrorMessage(err, 'Failed to remove management coverage record.')
        });
        return false;
      }
    },

    clearCoverage(): void {
      patchState(store, {
        selectedCoveragePosition: null,
        coverageRecords: [],
        coverageLoading: false,
        coverageSaving: false,
        coverageError: null
      });
    }
  }))
);

