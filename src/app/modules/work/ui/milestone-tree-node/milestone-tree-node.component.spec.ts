import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { MilestoneTreeNodeComponent } from './milestone-tree-node.component';
import { MilestoneTreeNode } from '../../models/milestone.model';
import { PeopleApiService } from '../../../people/data-access/people-api.service';

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
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [MilestoneTreeNodeComponent],
      providers: [
        { provide: PeopleApiService, useValue: { getEmployeeIdentity: vi.fn().mockReturnValue(of({ id: 'e1', name: 'Ada Lovelace', avatarFileId: null })) } }
      ]
    });
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
    expect((rows[0] as HTMLElement).className).toContain('grid-cols-[1fr_112px_40px_88px_140px]');
    expect((rows[1] as HTMLElement).className).toContain('grid-cols-[1fr_112px_40px_88px_140px]');

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

  it('renders a chevron for a leaf objective so it can be expanded', () => {
    setup(leaf);
    expect(fixture.nativeElement.querySelector('[data-testid="chevron"]')).not.toBeNull();
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

  it('shows a chevron on an unloaded sprint node', () => {
    const sprint: MilestoneTreeNode = { ...leaf, id: 's1', title: 'Sprint 1', kind: 'sprint', sprintTaskLoadState: 'unloaded' };
    setup(sprint);
    expect(fixture.nativeElement.querySelector('[data-testid="chevron"]')).not.toBeNull();
  });

  it('does not show a chevron on a task node', () => {
    const task: MilestoneTreeNode = { ...leaf, id: 't1', title: 'A task', kind: 'task' };
    setup(task);
    expect(fixture.nativeElement.querySelector('[data-testid="chevron"]')).toBeNull();
  });

  it('emits expandLeafRequested when a leaf objective chevron is clicked', () => {
    setup(leaf);
    const emitted: MilestoneTreeNode[] = [];
    fixture.componentInstance.expandLeafRequested.subscribe((n) => emitted.push(n));

    (fixture.nativeElement.querySelector('[data-testid="chevron"]') as HTMLElement).click();

    expect(emitted).toEqual([leaf]);
  });

  it('does not emit expandLeafRequested when expanding a non-leaf objective', () => {
    setup(root, null, true);
    const emitted: MilestoneTreeNode[] = [];
    fixture.componentInstance.expandLeafRequested.subscribe((n) => emitted.push(n));

    (fixture.nativeElement.querySelector('[data-testid="chevron"]') as HTMLElement).click();

    expect(emitted).toEqual([]);
  });

  it('does not emit expandLeafRequested when the leaf is already loaded', () => {
    const loadedLeaf: MilestoneTreeNode = { ...leaf, sprintTaskLoadState: 'loaded' };
    setup(loadedLeaf);
    const emitted: MilestoneTreeNode[] = [];
    fixture.componentInstance.expandLeafRequested.subscribe((n) => emitted.push(n));

    const chevron = fixture.nativeElement.querySelector('[data-testid="chevron"]') as HTMLElement | null;
    chevron?.click();

    expect(emitted).toEqual([]);
  });

  it('re-emits expandLeafRequested from a nested leaf through the parent', () => {
    setup(root, null, true);
    const emitted: MilestoneTreeNode[] = [];
    fixture.componentInstance.expandLeafRequested.subscribe((n) => emitted.push(n));

    const chevrons = fixture.nativeElement.querySelectorAll('[data-testid="chevron"]');
    (chevrons[chevrons.length - 1] as HTMLElement).click();

    expect(emitted).toEqual([leaf]);
  });

  it('shows a retry control when sprint/task load failed and emits expandLeafRequested on click', () => {
    const failed: MilestoneTreeNode = { ...leaf, sprintTaskLoadState: 'error' };
    setup(failed);
    const emitted: MilestoneTreeNode[] = [];
    fixture.componentInstance.expandLeafRequested.subscribe((n) => emitted.push(n));

    (fixture.nativeElement.querySelector('[data-testid="retry-sprint-task-load"]') as HTMLElement).click();

    expect(emitted).toEqual([failed]);
  });

  it('re-emits createSprintRequested, createTaskRequested, editRequested, and membersRequested from a nested node', () => {
    setup(root, null, true);
    const createdSprints: MilestoneTreeNode[] = [];
    const createdTasks: MilestoneTreeNode[] = [];
    const edits: MilestoneTreeNode[] = [];
    const members: MilestoneTreeNode[] = [];
    fixture.componentInstance.createSprintRequested.subscribe((n) => createdSprints.push(n));
    fixture.componentInstance.createTaskRequested.subscribe((n) => createdTasks.push(n));
    fixture.componentInstance.editRequested.subscribe((n) => edits.push(n));
    fixture.componentInstance.membersRequested.subscribe((n) => members.push(n));

    const child = fixture.debugElement.query(
      (de) => de.componentInstance instanceof MilestoneTreeNodeComponent && de.componentInstance !== fixture.componentInstance
    );
    child.componentInstance.createSprintRequested.emit(leaf);
    child.componentInstance.createTaskRequested.emit(leaf);
    child.componentInstance.editRequested.emit(leaf);
    child.componentInstance.membersRequested.emit(leaf);

    expect(createdSprints).toEqual([leaf]);
    expect(createdTasks).toEqual([leaf]);
    expect(edits).toEqual([leaf]);
    expect(members).toEqual([leaf]);
  });

  describe('row action icons', () => {
    const ownedLeaf: MilestoneTreeNode = { ...leaf, isOwner: true, kind: 'objective' };
    const ownedSprint: MilestoneTreeNode = {
      ...leaf, id: 'spr-1', title: 'Sprint 1', kind: 'sprint', isOwner: true, status: 'active', children: []
    };
    const taskNode: MilestoneTreeNode = {
      ...leaf, id: 't1', title: 'A task', kind: 'task', isOwner: false, status: 'To Do', children: []
    };

    it('shows create-sub, members, and edit on a non-leaf owned objective', () => {
      setup(root);
      expect(fixture.nativeElement.querySelector('[data-testid="create-sub-button"]')).not.toBeNull();
      (fixture.nativeElement.querySelector('[data-testid="shortcut-menu-button"]') as HTMLElement).click();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[data-testid="menu-members-button"]')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('[data-testid="menu-edit-button"]')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('[data-testid="menu-create-sprint-button"]')).toBeNull();
    });

    it('emits createSprintRequested from a leaf objective plus, not createRequested', () => {
      setup(ownedLeaf);
      const sprints: MilestoneTreeNode[] = [];
      const subs: MilestoneTreeNode[] = [];
      fixture.componentInstance.createSprintRequested.subscribe((n) => sprints.push(n));
      fixture.componentInstance.createRequested.subscribe((n) => subs.push(n));

      expect(fixture.nativeElement.querySelector('[data-testid="create-sub-button"]')).not.toBeNull();
      (fixture.nativeElement.querySelector('[data-testid="shortcut-menu-button"]') as HTMLElement).click();
      fixture.detectChanges();
      (fixture.nativeElement.querySelector('[data-testid="menu-create-sprint-button"]') as HTMLElement).click();

      expect(sprints).toEqual([ownedLeaf]);
      expect(subs).toEqual([]);
    });

    it('hides owner-gated icons on a leaf that the caller does not own', () => {
      setup({ ...ownedLeaf, isOwner: false });
      expect(fixture.nativeElement.querySelector('[data-testid="create-sub-button"]')).toBeNull();
      expect(fixture.nativeElement.querySelector('[data-testid="shortcut-menu-button"]')).toBeNull();
    });

    it('emits createTaskRequested and editRequested from an owned sprint, with no members icon', () => {
      setup(ownedSprint);
      const tasks: MilestoneTreeNode[] = [];
      const edits: MilestoneTreeNode[] = [];
      fixture.componentInstance.createTaskRequested.subscribe((n) => tasks.push(n));
      fixture.componentInstance.editRequested.subscribe((n) => edits.push(n));

      expect(fixture.nativeElement.querySelector('[data-testid="members-button"]')).toBeNull();
      (fixture.nativeElement.querySelector('[data-testid="create-task-button"]') as HTMLElement).click();
      (fixture.nativeElement.querySelector('[data-testid="edit-button"]') as HTMLElement).click();

      expect(tasks).toEqual([ownedSprint]);
      expect(edits).toEqual([ownedSprint]);
    });

    it('shows only an ungated edit icon on a task row and renders its status', () => {
      setup(taskNode);
      expect(fixture.nativeElement.querySelector('[data-testid="create-task-button"]')).toBeNull();
      expect(fixture.nativeElement.querySelector('[data-testid="members-button"]')).toBeNull();
      expect(fixture.nativeElement.querySelector('[data-testid="edit-button"]')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('[data-testid="status-badge"]')?.textContent).toContain('To Do');

      const edits: MilestoneTreeNode[] = [];
      fixture.componentInstance.editRequested.subscribe((n) => edits.push(n));
      (fixture.nativeElement.querySelector('[data-testid="edit-button"]') as HTMLElement).click();
      expect(edits).toEqual([taskNode]);
    });

    it('re-emits deleteRequested from a nested task row', () => {
      const ownedTask: MilestoneTreeNode = { ...taskNode, isOwner: true };
      const parent: MilestoneTreeNode = { ...root, children: [ownedTask] };
      setup(parent, null, true);
      const deleted: MilestoneTreeNode[] = [];
      fixture.componentInstance.deleteRequested.subscribe((n) => deleted.push(n));
      (fixture.nativeElement.querySelector('[data-testid="delete-task-button"]') as HTMLElement).click();
      expect(deleted[0].id).toBe('t1');
    });

    it('renders sprint status with the achieved-badge styling', () => {
      setup(ownedSprint);
      const badge = fixture.nativeElement.querySelector('[data-testid="status-badge"]') as HTMLElement;
      expect(badge.textContent).toContain('active');
    });
  });
});

describe('MilestoneTreeNodeComponent - meetings', () => {
  const meeting = {
    taskId: 'm1', shortId: 'P-M1', seriesId: 's1', originalStart: '2026-11-02T03:30:00Z', startAt: '2026-11-02T03:30:00Z',
    endAt: '2026-11-02T04:00:00Z', isAllDay: false, title: 'Standup', status: 'scheduled' as const, isPrivate: false,
    projectId: 'p1', objectiveId: 'o2', myRole: 'attendee' as const, myResponse: 'accepted' as const
  };
  const child: MilestoneTreeNode = {
    id: 'o2', title: 'Child', description: null, startDate: null, endDate: null, progress: 0, allocatedHours: 0, completedHours: 0,
    isActive: true, isAchieved: false, ownerName: null, isOwner: false, children: []
  };
  const parent: MilestoneTreeNode = { ...child, id: 'o1', title: 'Root', isOwner: true, children: [child] };

  it('lists a module\'s meetings under it with the M badge, at any depth, and opens them by key', () => {
    TestBed.configureTestingModule({
      imports: [MilestoneTreeNodeComponent],
      providers: [{ provide: PeopleApiService, useValue: { getEmployeeIdentity: vi.fn().mockReturnValue(of({ id: 'e1', name: 'A', avatarFileId: null })) } }]
    });
    const fixture = TestBed.createComponent(MilestoneTreeNodeComponent);
    fixture.componentRef.setInput('node', parent);
    fixture.componentRef.setInput('expandedByDefault', true);
    fixture.componentRef.setInput('meetingsByModule', new Map([['o2', [meeting]]]));
    fixture.detectChanges();
    // The child module starts collapsed; expand it.
    const childNode = fixture.debugElement.queryAll((d) => d.componentInstance instanceof MilestoneTreeNodeComponent)
      .map((d) => d.componentInstance as MilestoneTreeNodeComponent).find((c) => c.node().id === 'o2')!;
    childNode.expanded.set(true);
    fixture.detectChanges();

    const rows: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('[data-testid="tree-meeting-row"]'));
    expect(rows.length).toBe(1);
    expect(rows[0].querySelector('[data-testid="meeting-card-badge"]')?.textContent?.trim()).toBe('M');
    // A row one level below its module, laid out like the task rows there (the module "Child" is at depth 1).
    expect((rows[0].querySelector('[data-testid="meeting-card-name-cell"]') as HTMLElement).style.paddingLeft).toBe('40px');

    let opened: unknown;
    fixture.componentInstance.meetingOpened.subscribe((key) => (opened = key));
    (rows[0].querySelector('[data-testid="meeting-card"]') as HTMLElement).click();
    expect(opened).toEqual({ seriesId: 's1', originalStart: '2026-11-02T03:30:00Z' });
  });

  it('puts a module\'s meetings with its own tasks: after them, before its sprints and sub-modules', () => {
    const task = (id: string): MilestoneTreeNode => ({ ...child, id, title: `Task ${id}`, kind: 'task' });
    const sprint: MilestoneTreeNode = { ...child, id: 'sp1', title: 'Sprint 1', kind: 'sprint' };
    const sub: MilestoneTreeNode = { ...child, id: 'o3', title: 'Sub module' };
    const module: MilestoneTreeNode = { ...child, id: 'o2', children: [task('t1'), task('t2'), sprint, sub] };
    TestBed.configureTestingModule({
      imports: [MilestoneTreeNodeComponent],
      providers: [{ provide: PeopleApiService, useValue: { getEmployeeIdentity: vi.fn().mockReturnValue(of({ id: 'e1', name: 'A', avatarFileId: null })) } }]
    });
    const fixture = TestBed.createComponent(MilestoneTreeNodeComponent);
    fixture.componentRef.setInput('node', module);
    fixture.componentRef.setInput('meetingsByModule', new Map([['o2', [meeting]]]));
    fixture.detectChanges();

    const order = Array.from(fixture.nativeElement.querySelectorAll('[data-testid="title-text"], [data-testid="meeting-card-title"]'))
      .map((el) => (el as HTMLElement).textContent?.trim());
    expect(order.indexOf('Standup')).toBe(order.indexOf('Task t2') + 1);
    expect(order.indexOf('Standup')).toBeLessThan(order.indexOf('Sprint 1'));
    expect(order.indexOf('Standup')).toBeLessThan(order.indexOf('Sub module'));
  });

  it('lists the meetings of a module with no tasks before its sub-modules', () => {
    const sub: MilestoneTreeNode = { ...child, id: 'o3', title: 'Sub module' };
    const module: MilestoneTreeNode = { ...child, id: 'o2', children: [sub] };
    TestBed.configureTestingModule({
      imports: [MilestoneTreeNodeComponent],
      providers: [{ provide: PeopleApiService, useValue: { getEmployeeIdentity: vi.fn().mockReturnValue(of({ id: 'e1', name: 'A', avatarFileId: null })) } }]
    });
    const fixture = TestBed.createComponent(MilestoneTreeNodeComponent);
    fixture.componentRef.setInput('node', module);
    fixture.componentRef.setInput('meetingsByModule', new Map([['o2', [meeting]]]));
    fixture.detectChanges();

    const order = Array.from(fixture.nativeElement.querySelectorAll('[data-testid="title-text"], [data-testid="meeting-card-title"]'))
      .map((el) => (el as HTMLElement).textContent?.trim());
    expect(order.indexOf('Standup')).toBeLessThan(order.indexOf('Sub module'));
  });
});
