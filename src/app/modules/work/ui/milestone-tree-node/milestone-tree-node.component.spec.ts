import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MilestoneTreeNodeComponent } from './milestone-tree-node.component';
import { MilestoneTreeNode } from '../../models/milestone.model';

describe('MilestoneTreeNodeComponent', () => {
  let fixture: ComponentFixture<MilestoneTreeNodeComponent>;

  it('renders a node with no children', () => {
    const node: MilestoneTreeNode = {
      id: 'o1', title: 'Design Phase', startDate: '2026-01-15', endDate: '2026-03-01',
      progress: 40, allocatedHours: 20, completedHours: 8, isActive: true, children: []
    };
    fixture = TestBed.createComponent(MilestoneTreeNodeComponent);
    fixture.componentRef.setInput('node', node);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Design Phase');
    expect(fixture.nativeElement.textContent).toContain('40');
  });

  it('renders nested children recursively', () => {
    const node: MilestoneTreeNode = {
      id: 'o1', title: 'Root', startDate: '2026-01-15', endDate: '2026-03-01', progress: 0,
      allocatedHours: 20, completedHours: 0, isActive: true,
      children: [{
        id: 'o2', title: 'Child', startDate: '2026-01-20', endDate: '2026-02-01', progress: 0,
        allocatedHours: 5, completedHours: 0, isActive: true, children: []
      }]
    };
    fixture = TestBed.createComponent(MilestoneTreeNodeComponent);
    fixture.componentRef.setInput('node', node);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Root');
    expect(fixture.nativeElement.textContent).toContain('Child');
  });
});
