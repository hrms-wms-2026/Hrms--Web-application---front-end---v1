import { convertToParamMap } from '@angular/router';
import { countActiveFilters, filtersToQueryParams, parseEmployeeListState, selectionScopeKey, toEmployeeListParams } from './employee-list-url-state';

describe('employee list URL state', () => {
  it('parses defaults from an empty URL', () => {
    expect(parseEmployeeListState(convertToParamMap({}))).toEqual({
      search: '', page: 1, pageSize: 25, sortBy: null, sortDir: 'asc',
      filters: { departmentIds: [], positionIds: [], employmentTypes: [], managerIds: [] }
    });
  });

  it('parses every param and rejects invalid page size / sort key', () => {
    const state = parseEmployeeListState(convertToParamMap({
      search: 'ab', page: '3', pageSize: '50', sortBy: 'department', sortDir: 'desc',
      departmentId: 'd1,d2', positionId: 'p1', employmentType: 'full_time,intern', managerId: 'm1'
    }));
    expect(state).toEqual({
      search: 'ab', page: 3, pageSize: 50, sortBy: 'department', sortDir: 'desc',
      filters: { departmentIds: ['d1', 'd2'], positionIds: ['p1'], employmentTypes: ['full_time', 'intern'], managerIds: ['m1'] }
    });
    const bad = parseEmployeeListState(convertToParamMap({ pageSize: '999', sortBy: 'salary', page: '-2' }));
    expect([bad.pageSize, bad.sortBy, bad.page]).toEqual([25, null, 1]);
  });

  it('maps state to API params, omitting empties', () => {
    const state = parseEmployeeListState(convertToParamMap({ sortBy: 'manager', sortDir: 'desc', employmentType: 'contract' }));
    expect(toEmployeeListParams(state)).toEqual({
      search: undefined, page: 1, pageSize: 25, departmentId: undefined, positionId: undefined,
      employmentType: ['contract'], managerId: undefined, sortBy: 'manager', sortDir: 'desc'
    });
  });

  it('filtersToQueryParams joins lists and writes null for empty filters so router merge removes them', () => {
    expect(filtersToQueryParams({ departmentIds: ['d1', 'd2'], positionIds: ['p'], employmentTypes: [], managerIds: [] }))
      .toEqual({ departmentId: 'd1,d2', positionId: 'p', employmentType: null, managerId: null });
  });

  it('sends several departments to the API as a list', () => {
    const state = parseEmployeeListState(convertToParamMap({ departmentId: 'd1,d2' }));
    expect(toEmployeeListParams(state).departmentId).toEqual(['d1', 'd2']);
  });

  it('counts active filters and builds a selection key that ignores page only', () => {
    const a = parseEmployeeListState(convertToParamMap({ page: '1', departmentId: 'd' }));
    const b = parseEmployeeListState(convertToParamMap({ page: '2', departmentId: 'd' }));
    const c = parseEmployeeListState(convertToParamMap({ page: '1', departmentId: 'd', pageSize: '10' }));
    expect(countActiveFilters(a.filters)).toBe(1);
    expect(selectionScopeKey(a)).toBe(selectionScopeKey(b));
    expect(selectionScopeKey(a)).not.toBe(selectionScopeKey(c));
  });
});
