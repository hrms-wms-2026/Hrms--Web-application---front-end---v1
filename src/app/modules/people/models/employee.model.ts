/**
 * Matches backend EmployeeListItemResponse DTO
 * (HRMS-Backend-v1 src/ONEVO.Application/Features/CoreHr/Employee/DTOs/Responses/EmployeeListItemResponse.cs).
 * Also used for the employee detail view (GET /api/v1/employees/{id}) in this slice -
 * the detail route is a minimal read-only view, not the full section-by-section detail UI.
 */
export interface EmployeeListItemResponse {
  readonly id: string;
  readonly employeeNumber: string;
  readonly fullName: string;
  readonly email: string;
  readonly departmentId: string | null;
  readonly departmentName: string | null;
  readonly positionId: string | null;
  readonly positionName: string | null;
  readonly legalEntityId: string | null;
  readonly legalEntityName: string | null;
  readonly employmentTypeLabel: string;
  readonly status: string;
  readonly reportingManagerId: string | null;
  readonly reportingManagerName: string | null;
}

export interface EmployeeListPageResponse {
  readonly items: readonly EmployeeListItemResponse[];
  readonly totalCount: number;
  readonly page: number;
  readonly pageSize: number;
}

export interface EmployeeListParams {
  search?: string;
  departmentId?: string;
  legalEntityId?: string;
  page?: number;
  pageSize?: number;
}
