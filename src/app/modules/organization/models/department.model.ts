/**
 * Flat list item model matching backend DepartmentListItemResponse DTO
 * (HRMS-Backend-v1 DepartmentListItemResponse.cs).
 */
export interface DepartmentListItemResponse {
  readonly id: string;
  readonly legalEntityId: string;
  readonly name: string;
  readonly code: string;
  readonly parentDepartmentId: string | null;
  readonly headPositionId: string | null;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly updatedAt: string | null;
  // UI enrichment counts (where available or computed)
  readonly positionCount?: number;
  readonly employeeCount?: number;
  readonly headPositionTitle?: string | null;
  readonly parentDepartmentName?: string | null;
}

/**
 * Tree node model matching backend DepartmentTreeNodeResponse DTO
 * (HRMS-Backend-v1 DepartmentTreeNodeResponse.cs).
 */
export interface DepartmentTreeNodeResponse {
  readonly id: string;
  readonly legalEntityId: string;
  readonly name: string;
  readonly code: string;
  readonly parentDepartmentId: string | null;
  readonly headPositionId: string | null;
  readonly isActive: boolean;
  readonly children: readonly DepartmentTreeNodeResponse[];
  // UI enrichment counts
  readonly positionCount?: number;
  readonly employeeCount?: number;
  readonly headPositionTitle?: string | null;
}

/**
 * Flat paginated list response shape.
 */
export interface DepartmentListPageResponse {
  readonly items: readonly DepartmentListItemResponse[];
  readonly page: number;
  readonly pageSize: number;
  readonly totalCount: number;
  readonly totalPages: number;
}

/**
 * Tree hierarchy response shape.
 */
export interface DepartmentTreeResponse {
  readonly treeItems: readonly DepartmentTreeNodeResponse[];
}

/**
 * Single department detail response shape matching DepartmentResponse.cs.
 */
export interface DepartmentResponse {
  readonly id: string;
  readonly legalEntityId: string;
  readonly name: string;
  readonly code: string;
  readonly parentDepartmentId: string | null;
  readonly headPositionId: string | null;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly updatedAt: string | null;
}

/**
 * Create department request payload matching CreateDepartmentRequest.cs.
 * Note: a headPositionId on Create moves that existing position into the new department.
 */
export interface CreateDepartmentRequest {
  name: string;
  code: string;
  parentDepartmentId?: string | null;
  headPositionId?: string | null;
}

/**
 * Update department request payload matching UpdateDepartmentRequest.cs.
 */
export interface UpdateDepartmentRequest {
  name: string;
  code: string;
  parentDepartmentId?: string | null;
  headPositionId?: string | null;
}

/**
 * Department archive blocker counts matching DepartmentArchiveBlockers.cs.
 */
export interface DepartmentArchiveBlockers {
  readonly activeChildCount: number;
  readonly activeEmployeeCount: number;
  readonly activePositionCount: number;
  readonly isHeadPositionOfDepartment: boolean;
}

/**
 * Pre-archive dependency check response matching DepartmentArchiveDependencyResponse.cs.
 */
export interface DepartmentArchiveDependencyResponse {
  readonly departmentId: string;
  readonly legalEntityId: string;
  readonly canArchive: boolean;
  readonly blockers: DepartmentArchiveBlockers;
  readonly blockerMessages: readonly string[];
}

/**
 * Department list query parameters.
 */
export interface ListDepartmentsQueryParams {
  view?: 'flat' | 'tree';
  search?: string;
  includeInactive?: boolean;
  parentDepartmentId?: string;
  sortBy?: 'name' | 'code' | 'createdAt' | 'updatedAt';
  sortDirection?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}
