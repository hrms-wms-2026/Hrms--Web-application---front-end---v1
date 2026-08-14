import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { toSafeErrorMessage } from '../../../core/services/error-handler.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ChecklistApiService } from '../data-access/checklist-api.service';
import {
  ChecklistTemplateDetailResponse,
  ChecklistTemplateListItemResponse,
  ChecklistTemplateListParams,
  CreateChecklistTemplateRequest,
  UpdateChecklistTemplateRequest
} from '../models/checklist-template.model';

export interface ChecklistTemplateState {
  readonly templates: readonly ChecklistTemplateListItemResponse[];
  readonly totalCount: number;
  readonly selectedTemplate: ChecklistTemplateDetailResponse | null;
  readonly loading: boolean;
  readonly saving: boolean;
  readonly archiving: boolean;
  readonly error: string | null;
  readonly filters: ChecklistTemplateListParams;
}

const initialFilters: ChecklistTemplateListParams = {
  legalEntityId: '',
  includeInactive: false,
  page: 1,
  pageSize: 25
};

const initialState: ChecklistTemplateState = {
  templates: [],
  totalCount: 0,
  selectedTemplate: null,
  loading: false,
  saving: false,
  archiving: false,
  error: null,
  filters: initialFilters
};

function areFiltersEqual(a: ChecklistTemplateListParams, b: ChecklistTemplateListParams): boolean {
  return (
    a.legalEntityId === b.legalEntityId &&
    a.templateType === b.templateType &&
    a.departmentId === b.departmentId &&
    a.positionId === b.positionId &&
    a.includeInactive === b.includeInactive &&
    a.page === b.page &&
    a.pageSize === b.pageSize
  );
}

export const ChecklistTemplateStore = signalStore(
  { providedIn: 'root' },
  withState<ChecklistTemplateState>(initialState),
  withMethods(
    (
      store,
      checklistApi = inject(ChecklistApiService),
      notificationService = inject(NotificationService)
    ) => {
      let loadRequestId = 0;

      return {
        reset(): void {
          patchState(store, initialState);
        },

        setFilters(filters: Partial<ChecklistTemplateListParams>): void {
          const current = store.filters();
          const updated = { ...current, ...filters };
          if (areFiltersEqual(current, updated)) {
            return;
          }
          patchState(store, { filters: updated });
          if (updated.legalEntityId) {
            void this.loadTemplates(updated);
          }
        },

        async loadTemplates(overrideFilters?: ChecklistTemplateListParams): Promise<void> {
          const filters = overrideFilters ?? store.filters();
          const requestId = ++loadRequestId;

          if (!filters.legalEntityId) {
            // Invalidates any older in-flight request even though this branch
            // returns synchronously - requestId is already the latest here.
            patchState(store, { templates: [], totalCount: 0, loading: false });
            return;
          }

          patchState(store, { loading: true, error: null });
          try {
            const res = await firstValueFrom(checklistApi.listChecklistTemplates(filters));
            if (requestId !== loadRequestId) {
              return;
            }
            patchState(store, {
              templates: res.items,
              totalCount: res.totalCount,
              loading: false
            });
          } catch (err: unknown) {
            if (requestId !== loadRequestId) {
              return;
            }
            const message = toSafeErrorMessage(err, 'Failed to load checklist templates.');
            patchState(store, { templates: [], totalCount: 0, loading: false, error: message });
          }
        },

        async getTemplate(id: string): Promise<ChecklistTemplateDetailResponse | null> {
          patchState(store, { loading: true, error: null });
          try {
            const detail = await firstValueFrom(checklistApi.getChecklistTemplate(id));
            patchState(store, { selectedTemplate: detail, loading: false });
            return detail;
          } catch (err: unknown) {
            const message = toSafeErrorMessage(err, 'Failed to load checklist template details.');
            patchState(store, { selectedTemplate: null, loading: false, error: message });
            return null;
          }
        },

        async createTemplate(payload: CreateChecklistTemplateRequest): Promise<boolean> {
          patchState(store, { saving: true, error: null });
          try {
            await firstValueFrom(checklistApi.createChecklistTemplate(payload));
            patchState(store, { saving: false });
            notificationService.success('Checklist template created successfully.');
            await this.loadTemplates();
            return true;
          } catch (err: unknown) {
            const message = toSafeErrorMessage(err, 'Failed to create checklist template.');
            patchState(store, { saving: false, error: message });
            notificationService.error(message);
            return false;
          }
        },

        async updateTemplate(id: string, payload: UpdateChecklistTemplateRequest): Promise<boolean> {
          patchState(store, { saving: true, error: null });
          try {
            await firstValueFrom(checklistApi.updateChecklistTemplate(id, payload));
            patchState(store, { saving: false });
            notificationService.success('Checklist template updated successfully.');
            await this.loadTemplates();
            return true;
          } catch (err: unknown) {
            const message = toSafeErrorMessage(err, 'Failed to update checklist template.');
            patchState(store, { saving: false, error: message });
            notificationService.error(message);
            return false;
          }
        },

        async archiveTemplate(id: string): Promise<boolean> {
          patchState(store, { archiving: true, error: null });
          try {
            await firstValueFrom(checklistApi.archiveChecklistTemplate(id));
            patchState(store, { archiving: false });
            notificationService.success('Checklist template archived successfully.');
            await this.loadTemplates();
            return true;
          } catch (err: unknown) {
            const message = toSafeErrorMessage(err, 'Failed to archive checklist template.');
            patchState(store, { archiving: false, error: message });
            notificationService.error(message);
            return false;
          }
        }
      };
    }
  )
);
