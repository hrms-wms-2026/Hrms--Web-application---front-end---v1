import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MilestoneTreeNodeComponent } from './milestone-tree-node.component';
import { MilestoneTreeNode } from '../../models/milestone.model';

describe('MilestoneTreeNodeComponent', () => {
  let fixture: ComponentFixture<MilestoneTreeNodeComponent>;

  const leaf: MilestoneTreeNode = {
    id: 'o2', title: 'Child', description: null, startDate: '2026-01-20', endDate: '2026-02-01',
    progress: 40, allocatedHours: 5, completedHours: 2, isActive: true, isAchieved: false,
    ownerName: 'Diya Perera', isOwner: false, children: []
  };

  const root: MilestoneTreeNode = {
    id: 'o1', title: 'Root', description: null, startDate: '2026-01-15', endDate: '2026-03-01', progress: 0,
    allocatedHours: 20, completedHours: 0, isActive: true, isAchieved: false,
    ownerName: 'Arun Kumar', isOwner: true, children: [leaf]
  };

  function setup(node: MilestoneTreeNode, selectedId: string | null = null, expandedByDefault = true): void {
    fixture = TestBed.createComponent(MilestoneTreeNodeComponent);
    fixture.componentRef.setInput('node', node);
    fixture.componentRef.setInput('selectedId', selectedId);
    fixture.componentRef.setInput('expandedByDefault', expandedByDefault);
    fixture.detectChanges();
  }

  it('renders the node title, progress, owner initials, and due date', () => {
    setup(leaf);
    expect(fixture.nativeElement.textContent).toContain('Child');
    expect(fixture.nativeElement.textContent).toContain('40%');
    expect(fixture.nativeElement.textContent).toContain('2026-02-01');
    expect(fixture.nativeElement.querySelector('app-avatar')).not.toBeNull();
  });

  it('renders a folder icon before the title on every row, root and child alike', () => {
    setup(root, null, true);
    expect(fixture.nativeElement.querySelectorAll('[data-testid="folder-icon"]').length).toBe(2);
  });

  it('all rows share the same grid column template, only the title cell indents by depth', () => {
    setup(root, null, true);
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="tree-row"]');
    expect((rows[0] as HTMLElement).className).toContain('grid-cols-[1fr_auto_auto_auto_auto]');
    expect((rows[1] as HTMLElement).className).toContain('grid-cols-[1fr_auto_auto_auto_auto]');

    const rootTitleCell = rows[0].querySelector('span') as HTMLElement;
    const childTitleCell = rows[1].querySelector('span') as HTMLElement;
    expect(rootTitleCell.style.paddingLeft).toBe('0px');
    expect(childTitleCell.style.paddingLeft).toBe('20px');
  });

  it('shows children when expandedByDefault is true (root default)', () => {
    setup(root, null, true);
    expect(fixture.nativeElement.textContent).toContain('Child');
    expect(fixture.nativeElement.querySelectorAll('[data-testid="tree-row"]').length).toBe(2);
  });

  it('hides children when expandedByDefault is false (deeper-level default)', () => {
    setup(root, null, false);
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="tree-row"]');
    expect(rows.length).toBe(1);
    expect(fixture.nativeElement.textContent).not.toContain('Child');
  });

  it('does not render a chevron for a leaf node', () => {
    setup(leaf);
    expect(fixture.nativeElement.querySelector('[data-testid="chevron"]')).toBeNull();
  });

  it('chevron click toggles expansion without emitting selected', () => {
    setup(root, null, true);
    let selectedCount = 0;
    fixture.componentInstance.selected.subscribe(() => selectedCount++);

    (fixture.nativeElement.querySelector('[data-testid="chevron"]') as HTMLElement).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('[data-testid="tree-row"]').length).toBe(1);
    expect(selectedCount).toBe(0);
  });

  it('row click emits selected with the clicked node, without toggling expansion', () => {
    setup(root, null, true);
    const emitted: MilestoneTreeNode[] = [];
    fixture.componentInstance.selected.subscribe((n) => emitted.push(n));

    const rows = fixture.nativeElement.querySelectorAll('[data-testid="tree-row"]');
    (rows[1] as HTMLElement).click();

    expect(emitted).toEqual([leaf]);
  });

  it('applies a highlight to the row matching selectedId', () => {
    setup(root, 'o1', true);
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="tree-row"]');
    expect((rows[0] as HTMLElement).className).toContain('ring-2');
    expect((rows[1] as HTMLElement).className).not.toContain('ring-2');
  });

  it('shows a create-sub-module button only when the node is owned by the caller', () => {
    setup(root);
    expect(fixture.nativeElement.querySelector('[data-testid="create-sub-button"]')).not.toBeNull();
  });

  it('does not show a create-sub-module button when the node is not owned by the caller', () => {
    setup(leaf);
    expect(fixture.nativeElement.querySelector('[data-testid="create-sub-button"]')).toBeNull();
  });

  it('create-sub-module button click emits createRequested with the node, without emitting selected', () => {
    setup(root);
    const created: MilestoneTreeNode[] = [];
    let selectedCount = 0;
    fixture.componentInstance.createRequested.subscribe((n) => created.push(n));
    fixture.componentInstance.selected.subscribe(() => selectedCount++);

    (fixture.nativeElement.querySelector('[data-testid="create-sub-button"]') as HTMLElement).click();

    expect(created).toEqual([root]);
    expect(selectedCount).toBe(0);
  });
});
