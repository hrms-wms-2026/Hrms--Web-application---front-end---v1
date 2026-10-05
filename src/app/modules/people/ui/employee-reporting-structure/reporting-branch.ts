import { PositionTreeNodeResponse } from '../../../organization/models/position.model';

/**
 * The part of the position hierarchy that is an employee's reporting structure: the chain from the
 * top position down to theirs (one node per level, siblings dropped), then their position with its
 * whole sub-tree (reports, their reports, ...). Null when the position is not in the tree.
 */
export function buildReportingBranch(
  roots: readonly PositionTreeNodeResponse[],
  positionId: string
): PositionTreeNodeResponse | null {
  const path = findPath(roots, positionId);
  if (!path) return null;
  // Walk back up from the employee's own node, wrapping each ancestor around only that one child.
  let branch = path[path.length - 1]!;
  for (let i = path.length - 2; i >= 0; i--) {
    branch = { ...path[i]!, children: [branch], childCount: 1 };
  }
  return branch;
}

function findPath(
  nodes: readonly PositionTreeNodeResponse[],
  positionId: string
): PositionTreeNodeResponse[] | null {
  for (const node of nodes) {
    if (node.id === positionId) return [node];
    const rest = findPath(node.children ?? [], positionId);
    if (rest) return [node, ...rest];
  }
  return null;
}
