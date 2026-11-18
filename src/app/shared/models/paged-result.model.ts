/**
 * The backend's paged list shape (ONEVO PagedResult<T>). Some endpoints add totalPages / hasNext /
 * hasPrevious; extend this interface in the module model for those instead of redefining items/totalCount.
 */
export interface PagedResult<T> {
  readonly items: readonly T[];
  readonly pageNumber: number;
  readonly pageSize: number;
  readonly totalCount: number;
}
