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
  PositionAccessTemplateResponse,
  PositionListItemResponse,
  PositionTemplatePackResponse,
  PositionTreeNodeResponse,
  SetPositionAccessRequest,
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
  readonly accessTemplate: PositionAccessTemplateResponse | null;
  readonly accessLoading: boolean;
  readonly accessSaving: boolean;
  readonly accessError: string | null;
  readonly selectedAccessPosition: PositionListItemResponse | PositionTreeNodeResponse | null;
  readonly templatePacks: readonly PositionTemplatePackResponse[];
  readonly templatePacksLoading: boolean;
  readonly templatePacksError: string | null;
  readonly selectedTemplatePackKey: string | null;
  readonly templateSearchQuery: string;
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
  selectedCoveragePosition: null,
  accessTemplate: null,
  accessLoading: false,
  accessSaving: false,
  accessError: null,
  selectedAccessPosition: null,
  templatePacks: [],
  templatePacksLoading: false,
  templatePacksError: null,
  selectedTemplatePackKey: null,
  templateSearchQuery: ''
};

import { toSafeErrorMessage } from '../../../core/services/error-handler.service';

export const PositionStore = signalStore(
  { providedIn: 'root' },
  withState<PositionState>(initialState),
  withComputed(({ treeData, flatItems, viewMode, templatePacks, selectedTemplatePackKey, templateSearchQuery }) => ({
    hasPositions: computed(() => (viewMode() === 'tree' ? treeData().length > 0 : flatItems().length > 0)),
    filteredTemplatePacks: computed(() => {
      let result = templatePacks();
      const selKey = selectedTemplatePackKey();
      if (selKey) {
        result = result.filter(p => p.templateKey === selKey);
      }
      const q = templateSearchQuery().trim().toLowerCase();
      if (q) {
        result = result.filter(p =>
          p.name.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q)) ||
          p.positions.some(pos => pos.positionName.toLowerCase().includes(q) || pos.departmentName.toLowerCase().includes(q))
        );
      }
      return result;
    }),

    allPositionsList: computed(() => {
      if (viewMode() === 'list') return flatItems();
      const result: PositionListItemResponse[] = [];
      function flatten(nodes: readonly PositionTreeNodeResponse[]) {
        if (!nodes || !Array.isArray(nodes)) return;
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
        patchState(store, { loading: false, loadError: toSafeErrorMessage(err, 'Failed to load positions.') });
      }
    },

    async createPosition(legalEntityId: string, payload: CreatePositionRequest): Promise<PositionListItemResponse | null> {
      patchState(store, { saving: true, actionError: null });
      try {
        const created = await firstValueFrom(api.createPosition(legalEntityId, payload));
        patchState(store, { saving: false });
        await this.load(legalEntityId);
        return created;
      } catch (err) {
        patchState(store, { saving: false, actionError: toSafeErrorMessage(err, 'Failed to create position.') });
        return null;
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
        patchState(store, { saving: false, actionError: toSafeErrorMessage(err, 'Failed to update position.') });
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
        patchState(store, { archiveChecking: false, actionError: toSafeErrorMessage(err, 'Failed to check archive blockers.') });
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
        patchState(store, { saving: false, actionError: toSafeErrorMessage(err, 'Failed to archive position.') });
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
        patchState(store, { saving: false, actionError: toSafeErrorMessage(err, 'Failed to restore position.') });
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
          coverageError: toSafeErrorMessage(err, 'Failed to load management coverage records.')
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
        try {
          const res = await firstValueFrom(api.listCoverage(legalEntityId, positionId));
          patchState(store, { coverageRecords: res });
        } catch {
          // ignore secondary refresh error
        }
        patchState(store, {
          coverageSaving: false,
          coverageError: toSafeErrorMessage(err, 'Failed to add management coverage record.')
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
        try {
          const res = await firstValueFrom(api.listCoverage(legalEntityId, positionId));
          patchState(store, { coverageRecords: res });
        } catch {
          // ignore secondary refresh error
        }
        patchState(store, {
          coverageSaving: false,
          coverageError: toSafeErrorMessage(err, 'Failed to update management coverage record.')
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
          coverageError: toSafeErrorMessage(err, 'Failed to remove management coverage record.')
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
    },

    async loadAccess(
      legalEntityId: string,
      position: PositionListItemResponse | PositionTreeNodeResponse
    ): Promise<PositionAccessTemplateResponse | null> {
      patchState(store, {
        selectedAccessPosition: position,
        accessLoading: true,
        accessError: null,
        accessTemplate: null
      });
      try {
        const res = await firstValueFrom(api.getPositionAccess(legalEntityId, position.id));
        patchState(store, { accessTemplate: res, accessLoading: false });
        return res;
      } catch (err) {
        patchState(store, {
          accessLoading: false,
          accessError: toSafeErrorMessage(err, 'Failed to load position system access template.')
        });
        return null;
      }
    },

    async setPositionAccess(
      legalEntityId: string,
      positionId: string,
      payload: SetPositionAccessRequest
    ): Promise<boolean> {
      patchState(store, { accessSaving: true, accessError: null });
      try {
        const updated = await firstValueFrom(api.setPositionAccess(legalEntityId, positionId, payload));
        patchState(store, { accessTemplate: updated, accessSaving: false });
        return true;
      } catch (err) {
        patchState(store, {
          accessSaving: false,
          accessError: toSafeErrorMessage(err, 'Failed to set position system access.')
        });
        return false;
      }
    },

    clearAccess(): void {
      patchState(store, {
        selectedAccessPosition: null,
        accessTemplate: null,
        accessLoading: false,
        accessSaving: false,
        accessError: null
      });
    },

    async loadTemplatePacks(): Promise<void> {
      patchState(store, { templatePacksLoading: true, templatePacksError: null });
      try {
        const res = await firstValueFrom(api.listPositionTemplatePacks());
        patchState(store, { templatePacks: res.items, templatePacksLoading: false });
      } catch (err) {
        patchState(store, {
          templatePacksLoading: false,
          templatePacksError: toSafeErrorMessage(err, 'Position templates could not be loaded. Try again.')
        });
      }
    },

    setSelectedTemplatePack(templateKey: string | null): void {
      patchState(store, { selectedTemplatePackKey: templateKey });
    },

    setTemplateSearch(query: string): void {
      patchState(store, { templateSearchQuery: query });
    }
  }))
);

