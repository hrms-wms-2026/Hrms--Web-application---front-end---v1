import { EmployeeListItemResponse } from '../../models/employee.model';
import { PersonTreeNode, buildPeopleBranch } from './people-branch';

function emp(id: string, managerId: string | null, status = 'active'): EmployeeListItemResponse {
  return {
    id,
    employeeNumber: id,
    fullName: id,
    email: `${id}@x.test`,
    departmentId: null,
    departmentName: 'Eng',
    positionId: null,
    positionName: `${id}-pos`,
    legalEntityId: null,
    legalEntityName: null,
    employmentTypeLabel: 'Full time',
    status,
    reportingManagerId: managerId,
    reportingManagerName: managerId
  };
}

const self = (id: string, managerId: string | null = null, managerName: string | null = null) => ({
  id, name: id, positionName: null, departmentName: null, managerId, managerName
});

const ids = (n: PersonTreeNode): unknown => (n.children.length ? { [n.id]: n.children.map(ids) } : n.id);

describe('buildPeopleBranch', () => {
  // ceo -> gm -> (lead -> (me -> (dev -> intern), qa), lead-sibling), ops
  const people = [
    emp('ceo', null),
    emp('gm', 'ceo'),
    emp('ops', 'ceo'),
    emp('lead', 'gm'),
    emp('lead-sibling', 'gm'),
    emp('me', 'lead'),
    emp('qa', 'me'),
    emp('dev', 'me'),
    emp('intern', 'dev')
  ];

  it('keeps one manager per level above and the whole team below', () => {
    expect(ids(buildPeopleBranch(people, self('me')))).toEqual({
      ceo: [{ gm: [{ lead: [{ me: [{ dev: ['intern'] }, 'qa'] }] }] }]
    });
  });

  it('starts at the employee when they have no manager', () => {
    expect(ids(buildPeopleBranch(people, self('ceo')))).toEqual({
      ceo: [{ gm: [{ lead: [{ me: [{ dev: ['intern'] }, 'qa'] }] }, 'lead-sibling'] }, 'ops']
    });
  });

  it('drops people who have left', () => {
    const withLeaver = [...people, emp('gone', 'me', 'Terminated')];
    expect(ids(buildPeopleBranch(withLeaver, self('me')))).toEqual({
      ceo: [{ gm: [{ lead: [{ me: [{ dev: ['intern'] }, 'qa'] }] }] }]
    });
  });

  it('ends the chain with a placeholder for a manager the viewer cannot see', () => {
    const visible = people.filter((p) => p.id !== 'gm');
    const root = buildPeopleBranch(visible, self('lead'));
    expect(root.id).toBe('gm');
    expect(root.placeholder).toBe(true);
    expect(root.children[0]!.id).toBe('lead');
  });

  it('falls back to what the page knows when the employee is not listed', () => {
    const root = buildPeopleBranch([emp('boss', null)], self('stranger', 'boss', 'boss'));
    expect(ids(root)).toEqual({ boss: ['stranger'] });
  });

  it('does not loop on a manager cycle', () => {
    const cyclic = [emp('a', 'b'), emp('b', 'a')];
    expect(ids(buildPeopleBranch(cyclic, self('a')))).toEqual({ a: ['b'] });
  });
});
