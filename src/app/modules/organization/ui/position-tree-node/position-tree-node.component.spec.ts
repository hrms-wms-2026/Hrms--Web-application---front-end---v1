import { TestBed } from '@angular/core/testing';
import { PositionTreeNodeComponent } from './position-tree-node.component';
import { PositionListTableComponent } from '../position-list-table/position-list-table.component';
import { PositionListItemResponse, PositionTreeNodeResponse } from '../../models/position.model';

describe('PositionTreeNodeComponent', () => {
  function makeNode(overrides: Partial<PositionTreeNodeResponse>): PositionTreeNodeResponse {
    return {
      id: 'pos-1',
      legalEntityId: 'le-1',
      departmentId: null,
      name: 'Chief Executive Officer',
      code: 'CEO',
      positionType: 'unique',
      maxOccupancy: 1,
      reportsToPositionId: null,
      isActive: true,
      childCount: 0,
      children: [],
      ...overrides
    };
  }

  async function createComponent(node: PositionTreeNodeResponse) {
    await TestBed.configureTestingModule({ imports: [PositionTreeNodeComponent] }).compileComponents();
    const fixture = TestBed.createComponent(PositionTreeNodeComponent);
    fixture.componentRef.setInput('node', node);
    fixture.detectChanges();
    return fixture;
  }

  function cardText(fixture: ReturnType<typeof TestBed.createComponent>): string {
    return fixture.nativeElement.textContent as string;
  }

  it('shows an unassigned/unknown state, not 1/1 Occupied, when currentOccupancy is missing on a unique node', async () => {
    const fixture = await createComponent(makeNode({}));
    const text = cardText(fixture);

    expect(text).not.toContain('1/1');
    expect(text).not.toContain('Occupied');
    expect(text).toContain('—/1');
    expect(text).toMatch(/Unassigned/i);
  });

  it('shows 1/1 Occupied when the tree node does carry a known occupancy at capacity', async () => {
    const fixture = await createComponent(makeNode({ currentOccupancy: 1 } as Partial<PositionTreeNodeResponse>));
    const text = cardText(fixture);

    expect(text).toContain('1/1');
    expect(text).toContain('Occupied');
  });

  it('does not claim "Available capacity" for a pooled node with unknown occupancy', async () => {
    const fixture = await createComponent(makeNode({ positionType: 'pooled', maxOccupancy: 5 }));
    const text = cardText(fixture);

    expect(text).not.toContain('Available capacity');
    expect(text).not.toContain('0/5');
    expect(text).not.toContain('1/5');
    expect(text).toContain('—/5');
    expect(text).toMatch(/tracking unavailable/i);
  });

  it('gives Archived precedence and does not duplicate it as the occupancy status pill', async () => {
    const fixture = await createComponent(makeNode({ isActive: false }));
    const text = cardText(fixture);

    expect(text).toContain('Archived');
    expect(text).not.toContain('Unassigned');
    expect(text).not.toContain('Occupied');
  });

  it('renders the same occupancy status as the flat list table for equivalent unique-unknown input', async () => {
    const treeFixture = await createComponent(makeNode({ positionType: 'unique', maxOccupancy: 1, currentOccupancy: null } as Partial<PositionTreeNodeResponse>));
    const treeText = cardText(treeFixture);

    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [PositionListTableComponent] }).compileComponents();
    const listFixture = TestBed.createComponent(PositionListTableComponent);
    const listPosition: PositionListItemResponse = {
      id: 'pos-1',
      legalEntityId: 'le-1',
      departmentId: null,
      name: 'Chief Executive Officer',
      code: 'CEO',
      positionType: 'unique',
      maxOccupancy: 1,
      reportsToPositionId: null,
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: null,
      currentOccupancy: null
    };
    listFixture.componentRef.setInput('positions', [listPosition]);
    listFixture.detectChanges();
    const listText = listFixture.nativeElement.textContent as string;

    expect(treeText).toMatch(/Unassigned/i);
    expect(listText).toMatch(/Unassigned/i);
    expect(treeText).toContain('—/1');
    expect(listText).toContain('—/1');
  });
});
