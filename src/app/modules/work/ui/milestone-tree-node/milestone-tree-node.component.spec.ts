import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MilestoneTreeNodeComponent } from './milestone-tree-node.component';
import { MilestoneTreeNode } from '../../models/milestone.model';

describe('MilestoneTreeNodeComponent', () => {
  let fixture: ComponentFixture<MilestoneTreeNodeComponent>;

  const leaf: MilestoneTreeNode = {
    id: 'o1', title: 'Design Phase', startDate: '2026-01-15', endDate: '2026-03-01',
    progress: 40, allocatedHours: 20, completedHours: 8, isActive: true, children: []
  };

  const withChild: MilestoneTreeNode = {
    id: 'o1', title: 'Root', startDate: '2026-01-15', endDate: '2026-03-01', progress: 0,
    allocatedHours: 20, completedHours: 0, isActive: true,
    children: [{
      id: 'o2', title: 'Child', startDate: '2026-01-20', endDate: '2026-02-01', progress: 0,
      allocatedHours: 5, completedHours: 0, isActive: true, children: []
    }]
  };

  function setup(node: MilestoneTreeNode, selectedId: string | null = null): void {
    fixture = TestBed.createComponent(MilestoneTreeNodeComponent);
    fixture.componentRef.setInput('node', node);
    fixture.componentRef.setInput('selectedId', selectedId);
    fixture.detectChanges();
  }

  it('renders a node with no children, showing only its name and progress', () => {
    setup(leaf);
    expect(fixture.nativeElement.textContent).toContain('Design Phase');
    expect(fixture.nativeElement.textContent).toContain('40%');
    expect(fixture.nativeElement.textContent).not.toContain('2026-01-15');
  });

  it('renders nested children recursively', () => {
    setup(withChild);
    expect(fixture.nativeElement.textContent).toContain('Root');
    expect(fixture.nativeElement.textContent).toContain('Child');
  });

  it('does not render an expand toggle for a leaf node', () => {
    setup(leaf);
    expect(fixture.nativeElement.querySelector('[data-testid="expand-toggle"]')).toBeNull();
  });

  it('renders an expand toggle for a node with children', () => {
    setup(withChild);
    expect(fixture.nativeElement.querySelector('[data-testid="expand-toggle"]')).not.toBeNull();
  });

  it('emits selected with the row\'s own id when the row is clicked', () => {
    setup(leaf);
    let emitted: string | null = null;
    fixture.componentInstance.selected.subscribe((id: string) => (emitted = id));
    (fixture.nativeElement.querySelector('[data-testid="tree-row"]') as HTMLElement).click();
    expect(emitted).toBe('o1');
  });

  it('bubbles a child row\'s selected event up unchanged', () => {
    setup(withChild);
    let emitted: string | null = null;
    fixture.componentInstance.selected.subscribe((id: string) => (emitted = id));
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="tree-row"]');
    (rows[1] as HTMLElement).click();
    expect(emitted).toBe('o2');
  });

  it('collapses children when the expand toggle is clicked, without emitting selected', () => {
    setup(withChild);
    let emitted = false;
    fixture.componentInstance.selected.subscribe(() => (emitted = true));
    (fixture.nativeElement.querySelector('[data-testid="expand-toggle"]') as HTMLElement).click();
    fixture.detectChanges();
    expect(emitted).toBe(false);
    expect(fixture.nativeElement.textContent).not.toContain('Child');
  });

  it('applies a highlight to the row matching selectedId', () => {
    setup(leaf, 'o1');
    const row: HTMLElement = fixture.nativeElement.querySelector('[data-testid="tree-row"]');
    expect(row.className).toContain('bg-[var(--color-surface-secondary)]');
  });
});
