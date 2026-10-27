/**
 * Flat list item model matching backend PositionListItemResponse DTO
 * (HRMS-Backend-v1 PositionListItemResponse.cs).
 */
export type PositionTypeKind = 'unique' | 'pooled' | 'Unique' | 'Pooled';

/**
 * Single occupant preview item from backend PositionOccupantPreviewResponse.
 * `avatarFileId` is resolved through FileApiService/buildFileUrl before use as an img src.
 * `avatarUrl` remains only as a temporary compatibility fallback.
 */
export interface OccupantPreviewItem {
  readonly employeeId: string;
  readonly displayName: string;
  readonly initials: string;
  /** Raw file storage UUID. DO NOT use as an image URL. */
  readonly avatarFileId: string | null;
  /** Tenant-authenticated URL. Currently always null (no file-serving endpoint yet). */
  readonly avatarUrl: string | null;
}

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
  readonly currentOccupancy?: number | null;
  readonly currentOccupancyCheckSupported?: boolean;
  /** Total active PrimaryEmployment assignments. New backend field (optional for stale compat). */
  readonly assignedCount?: number;
  /** First occupants (backend-capped at 4). New backend field (optional for stale compat). */
  readonly occupantPreview?: readonly OccupantPreviewItem[];
  /** assignedCount - occupantPreview.length (employees beyond preview). */
  readonly remainingAssignedCount?: number;
  /** When true, changing into this position requires an access-grant approval. */
  readonly requiresApproval?: boolean;
  /** Seats held by pending onboarding invites (not occupants yet, but no longer free). */
  readonly reservedCount?: number;
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
  readonly currentOccupancy?: number | null;
  /** Total active PrimaryEmployment assignments. New backend field (optional for stale compat). */
  readonly assignedCount?: number;
  /** First occupants (backend-capped at 4). New backend field (optional for stale compat). */
  readonly occupantPreview?: readonly OccupantPreviewItem[];
  /** assignedCount - occupantPreview.length (employees beyond preview). */
  readonly remainingAssignedCount?: number;
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
  readonly responsibleEmployeeId: string | null;
  readonly responsibleEmployeeName: string | null;
}

export interface AddCoverageRecordRequest {
  coveredTargetType: 'Position' | 'Department';
  coveredPositionId?: string | null;
  coveredDepartmentId?: string | null;
  ownerOrder: number;
  responsibleEmployeeId?: string | null;
}

export interface UpdateCoverageRecordRequest {
  ownerOrder: number;
  responsibleEmployeeId?: string | null;
}

export interface ActiveHolder {
  employeeId: string;
  firstName: string;
  lastName: string;
  workEmail: string;
  avatarFileId: string | null;
}

export interface CoverageResolutionLevel {
  ownerOrder: number;
  ownerPositionId: string;
  ownerPositionName: string | null;
  status: 'Resolved' | 'Incomplete';
  employeeId: string | null;
  employeeName: string | null;
}

export type CoverageResolutionStatus = 'Resolved' | 'Unresolved';

export interface CoverageVisualizationRule {
  readonly coverageId: string;
  readonly coveredTargetType: 'Position' | 'Department' | 'Company';
  readonly coveredPositionId: string | null;
  readonly coveredDepartmentId: string | null;
  readonly ownerOrder: number;
  readonly source: 'ReportingStructure' | 'Manual';
  readonly isLocked: boolean;
  readonly resolutionStatus: CoverageResolutionStatus;
  readonly resolutionReason: string | null;
  readonly resolvedEmployeeId: string | null;
  readonly coveredPositionIds: readonly string[];
  readonly coveredEmployeeIds: readonly string[];
}

export interface CoverageVisualizationResponse {
  readonly ownerPositionId: string;
  readonly coveredPositionCount: number;
  readonly coveredEmployeeCount: number;
  readonly unresolvedRuleCount: number;
  readonly rules: readonly CoverageVisualizationRule[];
}

export type CoverageCardState = 'default' | 'selected' | 'resolved' | 'unresolved' | 'outside';

export interface CoverageCardVisual {
  readonly state: CoverageCardState;
  readonly levels: readonly string[];
  readonly accessibleLabel: string | null;
}

export interface CreatePositionRequest {
  departmentId: string;
  name: string;
  code?: string | null;
  maxOccupancy: number;
  reportsToPositionId?: string | null;
}

export interface UpdatePositionRequest {
  departmentId: string;
  name: string;
  code?: string | null;
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

export interface SetPositionAccessRequest {
  roleId: string;
  requiresApproval: boolean;
}

export interface PositionAccessTemplateResponse {
  readonly positionId: string;
  readonly roleId: string | null;
  readonly roleName: string | null;
  readonly requiresApproval: boolean;
  readonly isActive: boolean;
}

export interface PositionTemplatePackListResponse {
  readonly items: readonly PositionTemplatePackResponse[];
}

export interface PositionTemplatePackResponse {
  readonly id: string;
  readonly templateKey: string;
  readonly name: string;
  readonly description: string | null;
  readonly industryProfileTag: string | null;
  readonly employeeCountRangeKey: string;
  readonly employeeCountMin: number;
  readonly employeeCountMax: number | null;
  readonly positions: readonly PositionTemplatePackPositionResponse[];
}

export interface PositionTemplatePackPositionResponse {
  readonly positionKey: string;
  readonly positionName: string;
  readonly departmentName: string;
  readonly reportsToPositionKey: string | null;
  readonly linkedRoleTemplateId: string | null;
}

/**
 * Internal DataTransfer MIME type used to carry a dragged template position's
 * payload through native HTML5 drag/drop. Kept distinct from 'text/plain' so
 * drop targets can tell a template drag apart from an existing-position
 * reparent drag (which uses 'text/plain' for the dragged position id).
 */
export const POSITION_TEMPLATE_DRAG_MIME_TYPE = 'application/x-onevo-position-template';

export type PositionTemplatePresetSource = 'template-click' | 'template-drop-root' | 'template-drop-under-position';

/**
 * Preset carried into the create-position modal when starting from a template,
 * whether via "Use template" click or via native drag/drop onto the canvas or
 * an existing position card. `source` records which path produced the preset so
 * the modal/report can describe the resulting behavior accurately.
 */
export interface PositionTemplatePreset {
  readonly source: PositionTemplatePresetSource;
  readonly positionName: string;
  readonly positionKey?: string;
  readonly departmentId?: string | null;
  readonly reportsToPositionId?: string | null;
  readonly reportsToPositionName?: string | null;
  readonly suggestedDepartmentName?: string | null;
  readonly departmentMessage?: string | null;
}

/**
 * One card of the Positions "People" view (backend PositionPeopleChartNodeResponse): a person
 * holding a position, or a vacant position. Ids are "e:{employeeId}" / "p:{positionId}".
 */
export interface PositionPeopleChartNode {
  readonly id: string;
  readonly parentId: string | null;
  readonly kind: 'person' | 'vacant';
  readonly positionId: string;
  readonly positionName: string;
  readonly departmentName: string | null;
  readonly employeeId: string | null;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly avatarFileId: string | null;
  /** "position" | "default" (several holders above, none picked) | "custom" (one-off manager) */
  readonly reportingLine: 'position' | 'default' | 'custom' | null;
  readonly maxOccupancy: number;
  readonly holderCount: number;
  /** Invited, hasn't accepted yet (planned seat) - shown, but never anyone's manager. */
  readonly isPending?: boolean;
  readonly workEmail?: string | null;
}

export interface PeopleChartTreeNode extends PositionPeopleChartNode {
  readonly children: readonly PeopleChartTreeNode[];
}

export interface ReportingLineMoveRequest {
  readonly selectedEmployeeIds: readonly string[];
  readonly newManagerEmployeeId: string;
  readonly reason?: string | null;
}

export interface ReportingLineMovePerson {
  readonly employeeId: string;
  readonly name: string;
  readonly positionName: string;
}

export interface ReportingLineMoveChange {
  readonly employee: ReportingLineMovePerson;
  readonly currentManager: ReportingLineMovePerson | null;
  readonly newManager: ReportingLineMovePerson;
}

export interface ReportingLineMoveImpact {
  readonly selectedCount: number;
  readonly directRelationshipsChanged: number;
  readonly preservedRelationships: number;
  readonly totalEmployeesAffected: number;
  readonly changes: readonly ReportingLineMoveChange[];
}
