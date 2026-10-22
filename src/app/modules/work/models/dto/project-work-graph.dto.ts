import { WorkGraphLink, WorkGraphNode } from '../../../people/models/work-graph.model';

/**
 * Mirrors HRMS-Backend-v1 ProjectWorkGraphResponse (GET /work/projects/{id}/work-graph).
 *
 * Structurally identical to EmployeeWorkGraphResponse on purpose: the Work Network explorer in
 * `modules/people/ui/work-network-graph/explorer` is typed on that shape, and matching it is what
 * lets Work Management reuse the explorer rather than fork it.
 */
export interface ProjectWorkGraphDto {
  readonly nodes: readonly WorkGraphNode[];
  readonly links: readonly WorkGraphLink[];
  readonly hiddenTaskCount: number;
}
