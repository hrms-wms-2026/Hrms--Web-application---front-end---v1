import { EmployeeListItemResponse } from '../../models/employee.model';

/** One person on the reporting-structure chart. */
export interface PersonTreeNode {
  readonly id: string;
  readonly name: string;
  readonly positionName: string | null;
  readonly departmentName: string | null;
  readonly avatarFileId: string | null;
  /** A manager the viewer cannot see in the employee list: only the name is known. */
  readonly placeholder: boolean;
  readonly children: readonly PersonTreeNode[];
}

/** What the page already knows about the employee, used when the list does not return them. */
export interface PersonBranchFallback {
  readonly id: string;
  readonly name: string;
  readonly positionName: string | null;
  readonly departmentName: string | null;
  readonly managerId: string | null;
  readonly managerName: string | null;
}

/** People who have left are not part of anyone's reporting structure. */
const LEFT_STATUSES = new Set(['terminated', 'resigned']);

export const personChildren = (node: PersonTreeNode): readonly PersonTreeNode[] => node.children;
export const personKey = (node: PersonTreeNode): string => node.id;

/**
 * An employee's reporting structure by people (reporting managers), not positions: their managers
 * up to the top, one per level, then the employee with everyone who reports to them (and their
 * reports, ...). A manager the list does not return ends the chain as a name-only placeholder.
 */
export function buildPeopleBranch(
  employees: readonly EmployeeListItemResponse[],
  self: PersonBranchFallback
): PersonTreeNode {
  const byId = new Map<string, EmployeeListItemResponse>();
  const reportsOf = new Map<string, EmployeeListItemResponse[]>();
  for (const e of employees) {
    if (LEFT_STATUSES.has(e.status.toLowerCase())) continue;
    byId.set(e.id, e);
  }
  for (const e of byId.values()) {
    if (!e.reportingManagerId) continue;
    const list = reportsOf.get(e.reportingManagerId) ?? [];
    list.push(e);
    reportsOf.set(e.reportingManagerId, list);
  }

  const seen = new Set<string>();
  const subtree = (id: string, own: PersonTreeNode): PersonTreeNode => {
    seen.add(id);
    const reports = (reportsOf.get(id) ?? [])
      .filter((r) => !seen.has(r.id))
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
      .map((r) => subtree(r.id, toNode(r)));
    return { ...own, children: reports };
  };

  const listed = byId.get(self.id);
  let branch = subtree(
    self.id,
    listed
      ? toNode(listed)
      : { id: self.id, name: self.name, positionName: self.positionName, departmentName: self.departmentName, avatarFileId: null, placeholder: false, children: [] }
  );

  let managerId = listed ? listed.reportingManagerId : self.managerId;
  let managerName = listed ? listed.reportingManagerName : self.managerName;
  while (managerId && !seen.has(managerId)) {
    seen.add(managerId);
    const manager = byId.get(managerId);
    if (!manager) {
      if (managerName) {
        branch = { id: managerId, name: managerName, positionName: null, departmentName: null, avatarFileId: null, placeholder: true, children: [branch] };
      }
      break;
    }
    branch = { ...toNode(manager), children: [branch] };
    managerId = manager.reportingManagerId;
    managerName = manager.reportingManagerName;
  }
  return branch;
}

function toNode(e: EmployeeListItemResponse): PersonTreeNode {
  return {
    id: e.id,
    name: e.fullName,
    positionName: e.positionName,
    departmentName: e.departmentName,
    avatarFileId: e.avatarFileId ?? null,
    placeholder: false,
    children: []
  };
}
