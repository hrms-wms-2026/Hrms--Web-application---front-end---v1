import { inject } from '@angular/core';
import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { RolesApiService } from '../data-access/roles-api.service';
import {
  AssignRolePermissionsRequest,
  CreateRoleRequest,
  ModulePermissionGroup,
  PermissionCatalogItem,
  PermissionCatalogResponse,
  RoleDetailResponse,
  RoleSummaryResponse,
  UpdateRoleRequest
} from '../models/role.model';

export interface RoleState {
  readonly roles: readonly RoleSummaryResponse[];
  readonly catalog: PermissionCatalogResponse | null;
  readonly selectedRoleDetail: RoleDetailResponse | null;
  readonly loading: boolean;
  readonly catalogLoading: boolean;
  readonly detailLoading: boolean;
  readonly saving: boolean;
  readonly loadError: string | null;
  readonly actionError: string | null;
}

const initialState: RoleState = {
  roles: [],
  catalog: null,
  selectedRoleDetail: null,
  loading: false,
  catalogLoading: false,
  detailLoading: false,
  saving: false,
  loadError: null,
  actionError: null
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

function formatModuleTitle(moduleKey: string): string {
  if (!moduleKey) return 'General';
  return moduleKey
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export const RoleStore = signalStore(
  { providedIn: 'root' },
  withState<RoleState>(initialState),
  withComputed(({ roles, catalog }) => ({
    systemRoles: computed(() => roles().filter((r) => r.isSystem)),
    customRoles: computed(() => roles().filter((r) => !r.isSystem)),
    groupedCatalog: computed<readonly ModulePermissionGroup[]>(() => {
      const cat = catalog();
      if (!cat) return [];
      const map = new Map<string, PermissionCatalogItem[]>();

      for (const item of cat.assignablePermissions) {
        const key = item.module || 'general';
        if (!map.has(key)) {
          map.set(key, []);
        }
        map.get(key)!.push(item);
      }

      const result: ModulePermissionGroup[] = [];
      map.forEach((items, moduleKey) => {
        result.push({
          module: moduleKey,
          moduleTitle: formatModuleTitle(moduleKey),
          permissions: items
        });
      });

      return result.sort((a, b) => a.moduleTitle.localeCompare(b.moduleTitle));
    })
  })),
  withMethods((store, api = inject(RolesApiService)) => ({
    async loadAll(): Promise<void> {
      patchState(store, { loading: true, catalogLoading: true, loadError: null });
      try {
        const [roles, catalog] = await Promise.all([
          firstValueFrom(api.getRoles()),
          firstValueFrom(api.getPermissionCatalog())
        ]);
        patchState(store, { roles, catalog, loading: false, catalogLoading: false });
      } catch (err) {
        patchState(store, {
          loading: false,
          catalogLoading: false,
          loadError: extractErrorMessage(err, 'Failed to load roles and permissions.')
        });
      }
    },

    async loadRoleDetail(id: string): Promise<RoleDetailResponse | null> {
      patchState(store, { detailLoading: true, actionError: null });
      try {
        const detail = await firstValueFrom(api.getRole(id));
        patchState(store, { selectedRoleDetail: detail, detailLoading: false });
        return detail;
      } catch (err) {
        patchState(store, {
          detailLoading: false,
          actionError: extractErrorMessage(err, 'Failed to load role details.')
        });
        return null;
      }
    },

    async createRole(payload: CreateRoleRequest): Promise<boolean> {
      patchState(store, { saving: true, actionError: null });
      try {
        await firstValueFrom(api.createRole(payload));
        patchState(store, { saving: false });
        await this.loadAll();
        return true;
      } catch (err) {
        patchState(store, { saving: false, actionError: extractErrorMessage(err, 'Failed to create role.') });
        return false;
      }
    },

    async updateRole(id: string, payload: UpdateRoleRequest): Promise<boolean> {
      patchState(store, { saving: true, actionError: null });
      try {
        await firstValueFrom(api.updateRole(id, payload));
        patchState(store, { saving: false });
        await this.loadAll();
        return true;
      } catch (err) {
        patchState(store, { saving: false, actionError: extractErrorMessage(err, 'Failed to update role details.') });
        return false;
      }
    },

    async assignPermissions(id: string, payload: AssignRolePermissionsRequest): Promise<boolean> {
      patchState(store, { saving: true, actionError: null });
      try {
        await firstValueFrom(api.assignPermissions(id, payload));
        patchState(store, { saving: false });
        await this.loadAll();
        return true;
      } catch (err) {
        patchState(store, { saving: false, actionError: extractErrorMessage(err, 'Failed to update role permissions.') });
        return false;
      }
    },

    async archiveRole(id: string): Promise<boolean> {
      patchState(store, { saving: true, actionError: null });
      try {
        await firstValueFrom(api.archiveRole(id));
        patchState(store, { saving: false });
        await this.loadAll();
        return true;
      } catch (err) {
        patchState(store, { saving: false, actionError: extractErrorMessage(err, 'Failed to archive role.') });
        return false;
      }
    }
  }))
);
