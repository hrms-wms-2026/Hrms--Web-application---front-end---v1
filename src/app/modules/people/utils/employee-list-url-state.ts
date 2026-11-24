import { ParamMap } from '@angular/router';
import { EmployeeListParams, EmployeeSortKey, SortDirection } from '../models/employee.model';

/** Every filter is a multi-select (match any); an empty list means "not filtering". */
export interface EmployeeListFilters {
  readonly departmentIds: readonly string[];
  readonly positionIds: readonly string[];
  readonly employmentTypes: readonly string[];
  readonly managerIds: readonly string[];
}

export const EMPTY_EMPLOYEE_FILTERS: EmployeeListFilters = { departmentIds: [], positionIds: [], employmentTypes: [], managerIds: [] };

/** URL lists are comma-separated (a single id - the old link format - still parses). */
function parseList(value: string | null): string[] {
  return value ? value.split(',').filter(Boolean) : [];
}

function joinList(values: readonly string[]): string | null {
  return values.length ? values.join(',') : null;
}
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
  return {
    search: params.get('search') ?? '',
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: EMPLOYEE_PAGE_SIZES.includes(pageSize) ? pageSize : DEFAULT_PAGE_SIZE,
    sortBy: sortBy && SORT_KEYS.includes(sortBy) ? sortBy : null,
    sortDir: params.get('sortDir') === 'desc' ? 'desc' : 'asc',
    filters: {
      departmentIds: parseList(params.get('departmentId')),
      positionIds: parseList(params.get('positionId')),
      employmentTypes: parseList(params.get('employmentType')),
      managerIds: parseList(params.get('managerId'))
    }
  };
}

export function toEmployeeListParams(state: EmployeeListUrlState): EmployeeListParams {
  return {
    search: state.search || undefined,
    page: state.page,
    pageSize: state.pageSize,
    departmentId: state.filters.departmentIds.length ? [...state.filters.departmentIds] : undefined,
    positionId: state.filters.positionIds.length ? [...state.filters.positionIds] : undefined,
    employmentType: state.filters.employmentTypes.length ? [...state.filters.employmentTypes] : undefined,
    managerId: state.filters.managerIds.length ? [...state.filters.managerIds] : undefined,
    sortBy: state.sortBy ?? undefined,
    sortDir: state.sortBy ? state.sortDir : undefined
  };
}

export function filtersToQueryParams(filters: EmployeeListFilters): Record<string, string | null> {
  return {
    departmentId: joinList(filters.departmentIds),
    positionId: joinList(filters.positionIds),
    employmentType: joinList(filters.employmentTypes),
    managerId: joinList(filters.managerIds)
  };
}

export function countActiveFilters(filters: EmployeeListFilters): number {
  return [filters.departmentIds, filters.positionIds, filters.employmentTypes, filters.managerIds].filter((l) => l.length > 0).length;
}

/** Selection survives paging but not a change to what the list contains or how it's ordered. */
export function selectionScopeKey(state: EmployeeListUrlState): string {
  const { page: _page, ...rest } = state;
  return JSON.stringify(rest);
}
