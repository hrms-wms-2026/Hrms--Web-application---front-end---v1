/**
 * Role summary model matching backend RoleSummaryDto.cs
 */
export interface RoleSummaryResponse {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly isSystem: boolean;
  readonly permissionCount: number;
  readonly createdAt: string;
  readonly updatedAt: string | null;
  readonly sourceTemplateId: string | null;
}

/**
 * Role permission item matching backend RolePermissionDto.cs
 */
export interface RolePermissionItem {
  readonly id: string;
  readonly code: string;
  readonly description: string;
  readonly module: string;
}

/**
 * Detailed role response matching backend RoleDetailDto.cs
 */
export interface RoleDetailResponse {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly isSystem: boolean;
  readonly permissions: readonly RolePermissionItem[];
  readonly universalPermissions: readonly RolePermissionItem[];
  readonly createdAt: string;
  readonly updatedAt: string | null;
}

/**
 * Single permission item in the permission catalog matching PermissionCatalogItemDto.cs
 */
export interface PermissionCatalogItem {
  readonly id: string | null;
  readonly code: string;
  readonly description: string;
  readonly module: string;
  readonly isAssignable: boolean;
  readonly isUniversal: boolean;
}

/**
 * Permission catalog response matching backend PermissionCatalogDto.cs
 */
export interface PermissionCatalogResponse {
  readonly assignablePermissions: readonly PermissionCatalogItem[];
  readonly universalPermissions: readonly PermissionCatalogItem[];
}

/**
 * Grouped permission module shape for UI matrix rendering
 */
export interface ModulePermissionGroup {
  readonly module: string;
  readonly moduleTitle: string;
  readonly permissions: readonly PermissionCatalogItem[];
}

/**
 * Request payload for creating a role matching CreateRoleRequest.cs
 */
export interface CreateRoleRequest {
  name: string;
  description?: string | null;
  permissionIds?: string[] | null;
}

/**
 * Request payload for updating role name/description matching UpdateRoleRequest.cs
 */
export interface UpdateRoleRequest {
  name: string;
  description?: string | null;
}

/**
 * Request payload for assigning permissions to a role matching AssignRolePermissionsRequest.cs
 */
export interface AssignRolePermissionsRequest {
  permissionIds: string[];
}
