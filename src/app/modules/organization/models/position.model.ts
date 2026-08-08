/**
 * Flat list item model matching backend PositionListItemResponse DTO
 * (HRMS-Backend-v1 PositionListItemResponse.cs).
 */
export type PositionTypeKind = 'unique' | 'pooled' | 'Unique' | 'Pooled';

export interface PositionListItemResponse {
  readonly id: string;
  readonly legalEntityId: string;
  readonly departmentId: string | null;
  readonly name: string;
  readonly code: string | null;
  readonly positionType: PositionTypeKind;
  readonly maxOccupancy: number;
  readonly reportsToPositionId: string | null;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly updatedAt: string | null;
  readonly departmentName?: string | null;
  readonly reportsToPositionName?: string | null;
  readonly currentOccupancy?: number;
}

export interface PositionTreeNodeResponse {
  readonly id: string;
  readonly legalEntityId: string;
  readonly departmentId: string | null;
  readonly name: string;
  readonly code: string | null;
  readonly positionType: PositionTypeKind;
  readonly maxOccupancy: number;
  readonly reportsToPositionId: string | null;
  readonly isActive: boolean;
  readonly childCount: number;
  readonly children: readonly PositionTreeNodeResponse[];
  readonly departmentName?: string | null;
  readonly reportsToPositionName?: string | null;
  readonly currentOccupancy?: number;
}

export interface PositionPageResponse {
  readonly items: readonly PositionListItemResponse[];
  readonly page: number;
  readonly pageSize: number;
  readonly totalCount: number;
  readonly totalPages: number;
}

export interface PositionResponse {
  readonly id: string;
  readonly legalEntityId: string;
  readonly departmentId: string | null;
  readonly name: string;
  readonly code: string | null;
  readonly positionType: PositionTypeKind;
  readonly maxOccupancy: number;
  readonly reportsToPositionId: string | null;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly updatedAt: string | null;
}

export interface PositionArchiveBlockers {
  readonly activeOccupants: number | null;
  readonly activeOccupantsCheckSupported: boolean;
  readonly headOfDepartments: number;
  readonly activeChildPositions: number;
  readonly canArchive: boolean;
}

export interface ManagementCoverageRecordResponse {
  readonly id: string;
  readonly ownerPositionId: string;
  readonly ownerPositionName: string | null;
  readonly coveredTargetType: 'Position' | 'Department';
  readonly coveredPositionId: string | null;
  readonly coveredPositionName: string | null;
  readonly coveredDepartmentId: string | null;
  readonly coveredDepartmentName: string | null;
  readonly ownerOrder: number;
  readonly source: 'ReportingStructure' | 'Manual';
  readonly isLocked: boolean;
  readonly status: 'active' | 'inactive';
}

export interface AddCoverageRecordRequest {
  coveredTargetType: 'Position' | 'Department';
  coveredPositionId?: string | null;
  coveredDepartmentId?: string | null;
  ownerOrder: number;
}

export interface UpdateCoverageRecordRequest {
  ownerOrder: number;
}

export interface CreatePositionRequest {
  departmentId: string;
  name: string;
  code?: string | null;
  positionType: 'unique' | 'pooled';
  maxOccupancy: number;
  reportsToPositionId?: string | null;
}

export interface UpdatePositionRequest {
  departmentId: string;
  name: string;
  code?: string | null;
  positionType: 'unique' | 'pooled';
  maxOccupancy: number;
  reportsToPositionId?: string | null;
}

/**
 * Query parameters for listing positions
 */
export interface ListPositionsQueryParams {
  departmentId?: string;
  search?: string;
  includeInactive?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: 'name' | 'code' | 'createdAt' | 'updatedAt';
  sortDirection?: 'asc' | 'desc';
}

