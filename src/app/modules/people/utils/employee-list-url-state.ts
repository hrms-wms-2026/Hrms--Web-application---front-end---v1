import { ParamMap } from '@angular/router';
import { EmployeeListParams, EmployeeSortKey, SortDirection } from '../models/employee.model';

export interface EmployeeListFilters {
  readonly departmentId: string | null;
  readonly positionId: string | null;
  readonly employmentTypes: readonly string[];
  readonly managerId: string | null;
}

export const EMPTY_EMPLOYEE_FILTERS: EmployeeListFilters = { departmentId: null, positionId: null, employmentTypes: [], managerId: null };
export const EMPLOYEE_PAGE_SIZES: readonly number[] = [10, 25, 50];
const DEFAULT_PAGE_SIZE = 25;
const SORT_KEYS: readonly EmployeeSortKey[] = ['name', 'employeeNumber', 'position', 'department', 'employmentType', 'manager'];

export interface EmployeeListUrlState {
  readonly search: string;
  readonly page: number;
  readonly pageSize: number;
  readonly sortBy: EmployeeSortKey | null;
  readonly sortDir: SortDirection;
  readonly filters: EmployeeListFilters;
}

export function parseEmployeeListState(params: ParamMap): EmployeeListUrlState {
  const page = Number(params.get('page'));
  const pageSize = Number(params.get('pageSize'));
  const sortBy = params.get('sortBy') as EmployeeSortKey | null;
  const types = params.get('employmentType');
  return {
    search: params.get('search') ?? '',
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: EMPLOYEE_PAGE_SIZES.includes(pageSize) ? pageSize : DEFAULT_PAGE_SIZE,
    sortBy: sortBy && SORT_KEYS.includes(sortBy) ? sortBy : null,
    sortDir: params.get('sortDir') === 'desc' ? 'desc' : 'asc',
    filters: {
      departmentId: params.get('departmentId') || null,
      positionId: params.get('positionId') || null,
      employmentTypes: types ? types.split(',').filter(Boolean) : [],
      managerId: params.get('managerId') || null
    }
  };
}

export function toEmployeeListParams(state: EmployeeListUrlState): EmployeeListParams {
  return {
    search: state.search || undefined,
    page: state.page,
    pageSize: state.pageSize,
    departmentId: state.filters.departmentId ?? undefined,
    positionId: state.filters.positionId ?? undefined,
    employmentType: state.filters.employmentTypes.length ? [...state.filters.employmentTypes] : undefined,
    managerId: state.filters.managerId ?? undefined,
    sortBy: state.sortBy ?? undefined,
    sortDir: state.sortBy ? state.sortDir : undefined
  };
}

export function filtersToQueryParams(filters: EmployeeListFilters): Record<string, string | null> {
  return {
    departmentId: filters.departmentId,
    positionId: filters.positionId,
    employmentType: filters.employmentTypes.length ? filters.employmentTypes.join(',') : null,
    managerId: filters.managerId
  };
}

export function countActiveFilters(filters: EmployeeListFilters): number {
  return [filters.departmentId, filters.positionId, filters.managerId].filter(Boolean).length
    + (filters.employmentTypes.length ? 1 : 0);
}

/** Selection survives paging but not a change to what the list contains or how it's ordered. */
export function selectionScopeKey(state: EmployeeListUrlState): string {
  const { page: _page, ...rest } = state;
  return JSON.stringify(rest);
}
