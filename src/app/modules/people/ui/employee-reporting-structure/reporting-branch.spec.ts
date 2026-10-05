import { PositionTreeNodeResponse } from '../../../organization/models/position.model';
import { buildReportingBranch } from './reporting-branch';

function node(id: string, children: PositionTreeNodeResponse[] = []): PositionTreeNodeResponse {
  return {
    id,
    legalEntityId: 'le-1',
    departmentId: null,
    name: id,
    code: null,
    positionType: 'unique',
    maxOccupancy: 1,
    reportsToPositionId: null,
    isActive: true,
    childCount: children.length,
    children
  };
}

describe('buildReportingBranch', () => {
  // ceo -> gm -> (lead -> (me -> (dev -> intern), qa), marketing), ops
  const tree = [
    node('ceo', [
      node('gm', [
        node('lead', [node('me', [node('dev', [node('intern')]), node('qa')]), node('lead-sibling')]),
        node('marketing')
      ]),
      node('ops')
    ])
  ];

  it('keeps only the chain above the position and the whole sub-tree below it', () => {
    const branch = buildReportingBranch(tree, 'me')!;

    expect(branch.id).toBe('ceo');
    expect(branch.children.map((c) => c.id)).toEqual(['gm']);
    expect(branch.children[0]!.children.map((c) => c.id)).toEqual(['lead']);
    const me = branch.children[0]!.children[0]!.children[0]!;
    expect(me.id).toBe('me');
    expect(me.children.map((c) => c.id)).toEqual(['dev', 'qa']);
    expect(me.children[0]!.children.map((c) => c.id)).toEqual(['intern']);
  });

  it('returns the position itself when it is a root', () => {
    expect(buildReportingBranch(tree, 'ceo')).toBe(tree[0]);
  });

  it('returns null for a position not in the tree', () => {
    expect(buildReportingBranch(tree, 'missing')).toBeNull();
  });
});
