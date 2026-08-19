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
    expect((rows[0] as HTMLElement).className).toContain('grid-cols-[1fr_112px_40px_88px_32px]');
    expect((rows[1] as HTMLElement).className).toContain('grid-cols-[1fr_112px_40px_88px_32px]');

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

  it('fills the selected row with the accent background instead of a ring', () => {
    setup(root, 'o1', true);
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="tree-row"]');
    expect((rows[0] as HTMLElement).className).toContain('bg-[var(--color-accent)]');
    expect((rows[0] as HTMLElement).className).not.toContain('ring-2');
    expect((rows[1] as HTMLElement).className).not.toContain('bg-[var(--color-accent)]');
  });

  it('turns the title white when selected, keeps the default color otherwise', () => {
    setup(root, 'o1', true);
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="tree-row"]');
    const selectedTitle = rows[0].querySelector('[data-testid="title-text"]') as HTMLElement;
    const unselectedTitle = rows[1].querySelector('[data-testid="title-text"]') as HTMLElement;
    expect(selectedTitle.className).toContain('text-white');
    expect(unselectedTitle.className).toContain('text-[var(--color-text-primary)]');
  });

  it('turns the folder icon white when selected, keeps accent color otherwise', () => {
    setup(root, 'o1', true);
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="tree-row"]');
    const selectedIcon = rows[0].querySelector('[data-testid="folder-icon"]') as HTMLElement;
    const unselectedIcon = rows[1].querySelector('[data-testid="folder-icon"]') as HTMLElement;
    expect(selectedIcon.getAttribute('class')).toContain('text-white');
    expect(unselectedIcon.getAttribute('class')).toContain('text-[var(--color-accent)]');
  });

  it('turns the progress bar fill white when selected, accent otherwise', () => {
    setup(root, 'o1', true);
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="tree-row"]');
    const selectedFill = rows[0].querySelector('[data-testid="progress-fill"]') as HTMLElement;
    const unselectedFill = rows[1].querySelector('[data-testid="progress-fill"]') as HTMLElement;
    expect(selectedFill.className).toContain('bg-white');
    expect(unselectedFill.className).toContain('bg-[var(--color-accent)]');
  });

  it('turns the due date text white when selected', () => {
    setup(root, 'o1', true);
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="tree-row"]');
    const selectedDate = rows[0].querySelector('[data-testid="due-date-cell"]') as HTMLElement;
    expect(selectedDate.className).toContain('text-white');
  });

  it('renders owner avatar with theme background, white text, and white border outline', () => {
    setup(root, 'o1', true);
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="tree-row"]');
    const ownerCell = rows[0].querySelector('[data-testid="owner-cell"]') as HTMLElement;
    expect(ownerCell.getAttribute('style')).toContain('--color-profile-bg: var(--color-accent)');
    expect(ownerCell.getAttribute('style')).toContain('--color-profile-text: #ffffff');
    expect(ownerCell.getAttribute('style')).toContain('--color-border: #ffffff');
  });

  it('shows the Achieved badge in white-on-translucent styling when its row is selected', () => {
    const achievedRoot: MilestoneTreeNode = { ...root, isAchieved: true };
    setup(achievedRoot, 'o1', true);
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="tree-row"]');
    const badge = rows[0].querySelector('[data-testid="achieved-badge"]') as HTMLElement;
    expect(badge.className).toContain('text-white');
    expect(badge.className).toContain('bg-white/15');
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
