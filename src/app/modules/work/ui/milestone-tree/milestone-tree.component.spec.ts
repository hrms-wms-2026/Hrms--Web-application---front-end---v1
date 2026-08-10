import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MilestoneTreeComponent } from './milestone-tree.component';
import { MilestoneTreeNode } from '../../models/milestone.model';

describe('MilestoneTreeComponent', () => {
  let fixture: ComponentFixture<MilestoneTreeComponent>;

  const root: MilestoneTreeNode = {
    id: 'o1', title: 'Root', startDate: '2026-01-01', endDate: '2026-03-01',
    progress: 0, allocatedHours: 20, completedHours: 0, isActive: true, children: []
  };

  function setup(parent: { id: string; title: string } | null = null): void {
    fixture = TestBed.createComponent(MilestoneTreeComponent);
    fixture.componentRef.setInput('root', root);
    fixture.componentRef.setInput('parent', parent);
    fixture.detectChanges();
  }

  it('does not render a parent row when parent is null', () => {
    setup(null);
    expect(fixture.nativeElement.querySelector('[data-testid="tree-parent-row"]')).toBeNull();
  });

  it('renders a parent context row when parent is set', () => {
    setup({ id: 'p1', title: 'Parent Milestone' });
    const row = fixture.nativeElement.querySelector('[data-testid="tree-parent-row"]');
    expect(row.textContent).toContain('Parent Milestone');
  });

  it('emits nodeSelected with the parent id when the parent row is clicked', () => {
    setup({ id: 'p1', title: 'Parent Milestone' });
    let emitted: string | null = null;
    fixture.componentInstance.nodeSelected.subscribe((id: string) => (emitted = id));
    (fixture.nativeElement.querySelector('[data-testid="tree-parent-row"]') as HTMLElement).click();
    expect(emitted).toBe('p1');
  });

  it('emits nodeSelected with the root id when the root row is clicked', () => {
    setup(null);
    let emitted: string | null = null;
    fixture.componentInstance.nodeSelected.subscribe((id: string) => (emitted = id));
    (fixture.nativeElement.querySelector('[data-testid="tree-row"]') as HTMLElement).click();
    expect(emitted).toBe('o1');
  });
});
