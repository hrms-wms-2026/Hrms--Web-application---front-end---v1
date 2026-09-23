import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { MilestoneTreeTabComponent } from './milestone-tree-tab.component';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { MilestoneTreeNode } from '../../models/milestone.model';
import { PeopleApiService } from '../../../people/data-access/people-api.service';
import { SprintListStore } from '../../state/sprint-list.store';
import { TaskBoardStore } from '../../state/task-board.store';
import { TaskApiService } from '../../data-access/task-api.service';

describe('MilestoneTreeTabComponent', () => {
  let fixture: ComponentFixture<MilestoneTreeTabComponent>;
  let storeStub: any;
  let routeStub: any;
  let routerStub: { navigate: ReturnType<typeof vi.fn> };

  const child: MilestoneTreeNode = {
    id: 'o2', title: 'Child', description: null, startDate: '2026-01-10', endDate: '2026-02-01',
    progress: 40, allocatedHours: 5, completedHours: 2, isActive: true, isAchieved: false,
    ownerName: 'Diya', isOwner: false, children: []
  };

  const sibling: MilestoneTreeNode = {
    id: 'o3', title: 'Other', description: null, startDate: '2026-03-01', endDate: '2026-04-01',
    progress: 10, allocatedHours: 8, completedHours: 1, isActive: true, isAchieved: false,
    ownerName: 'Sam', isOwner: true, children: []
  };

  const inactiveSibling: MilestoneTreeNode = {
    id: 'o4', title: 'Retired Module', description: null, startDate: '2026-02-01', endDate: '2026-03-01',
    progress: 100, allocatedHours: 6, completedHours: 6, isActive: false, isAchieved: false,
    ownerName: 'Sam', isOwner: true, children: []
  };

  const tree: MilestoneTreeNode = {
    id: 'o1', title: 'Root', description: null, startDate: '2026-01-01', endDate: '2026-12-01',
    progress: 72, allocatedHours: 40, completedHours: 29, isActive: true, isAchieved: false,
    ownerName: 'Arun Kumar', isOwner: true, children: [child, sibling, inactiveSibling]
  };

  function setup(milestoneId: string | null): void {
    const paramGet = (key: string) => {
      if (key === 'milestoneId') return milestoneId;
      if (key === 'id') return 'p1';
      return null;
    };
    routeStub = {
      paramMap: of({ get: paramGet }),
      snapshot: { paramMap: { get: paramGet } },
      parent: null
    };
    routerStub = { navigate: vi.fn().mockResolvedValue(true) };

    TestBed.configureTestingModule({
      imports: [MilestoneTreeTabComponent],
      providers: [
        { provide: ProjectDetailStore, useValue: storeStub },
        { provide: ActivatedRoute, useValue: routeStub },
        { provide: PeopleApiService, useValue: { listEmployees: vi.fn().mockReturnValue(of({ items: [], totalCount: 0, page: 1, pageSize: 20 })) } },
        { provide: SprintListStore, useValue: { error: () => null, create: vi.fn(), edit: vi.fn() } },
        { provide: TaskBoardStore, useValue: { error: () => null, createTask: vi.fn(), statuses: () => [] } },
        { provide: TaskApiService, useValue: {} },
        { provide: Router, useValue: routerStub }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(MilestoneTreeTabComponent);
  }

  beforeEach(() => {
    storeStub = {
      project: () => ({ id: 'p1' }),
      selectedSubtree: () => tree,
      subtreeLoading: () => false,
      subtreeError: () => null,
      milestoneActionError: () => null,
      loadProjectTree: vi.fn().mockResolvedValue(undefined),
      loadSprintsAndTasksForLeaf: vi.fn().mockResolvedValue(undefined),
      loadTasksForSprint: vi.fn().mockResolvedValue(undefined),
      achieveSprint: vi.fn().mockResolvedValue({ success: true }),
      completeSprint: vi.fn().mockResolvedValue({ success: true }),
      deleteTask: vi.fn().mockResolvedValue({ success: true }),
      getMilestoneDetail: vi.fn().mockResolvedValue(null),
      editMilestone: vi.fn().mockResolvedValue({ success: true, pending: false }),
      achieveMilestone: vi.fn().mockResolvedValue({ success: true, pending: false }),
      unachieveMilestone: vi.fn().mockResolvedValue({ success: true, pending: false }),
      createSubModule: vi.fn().mockResolvedValue({ success: true, objectiveId: 'o1' }),
      uploadMilestoneAsset: vi.fn().mockResolvedValue({ success: true }),
      setMilestoneActionError: vi.fn(),
      loadObjectiveMembers: vi.fn().mockResolvedValue(undefined),
      addObjectiveMember: vi.fn().mockResolvedValue({ success: true, alreadyMember: false }),
      removeObjectiveMember: vi.fn().mockResolvedValue({ success: true }),
      transferObjectiveHead: vi.fn().mockResolvedValue({ success: true, applied: false, viaInvitation: true }),
      objectiveMembers: () => [],
      objectiveMembersLoading: () => false
    };
  });

  it('loads the project-wide tree for the routed project id', () => {
    setup('o1');
    fixture.detectChanges();
    expect(storeStub.loadProjectTree).toHaveBeenCalledWith('p1');
  });

  it('defaults the module filter to all so every member sees the full tree, regardless of the routed milestone', async () => {
    setup('o2');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.componentInstance.selectedModuleFilter()).toBe('all');
    const trigger = fixture.nativeElement.querySelector('[data-testid="module-filter-dropdown"] .work-dropdown__trigger') as HTMLElement;
    expect(trigger.textContent).toContain('All modules');
    expect(fixture.componentInstance.moduleDropdownOptions()[0]).toEqual({ value: 'all', label: 'All modules' });
  });

  it('keeps sibling branches visible and highlights the routed node when a member lands on their own non-root module', async () => {
    setup('o2');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const rendered = fixture.componentInstance.renderedTree();
    const ids = (node: MilestoneTreeNode): string[] => [node.id, ...node.children.flatMap(ids)];
    expect(ids(rendered!)).toEqual(expect.arrayContaining(['o1', 'o2', 'o3']));
    expect(fixture.componentInstance.selectedNode()?.id).toBe('o2');
  });

  it('prunes the rendered tree on filter change without refetching', () => {
    setup('o1');
    fixture.detectChanges();
    const titles = () =>
      Array.from(fixture.nativeElement.querySelectorAll('[data-testid="title-text"]') as NodeListOf<HTMLElement>)
        .map((el) => el.textContent?.trim());
    expect(titles()).toContain('Other');
    expect(storeStub.loadProjectTree).toHaveBeenCalledTimes(1);

    fixture.componentInstance.onModuleFilterChanged('o2');
    fixture.detectChanges();

    expect(titles()).toContain('Child');
    expect(titles()).not.toContain('Other');
    expect(storeStub.loadProjectTree).toHaveBeenCalledTimes(1);
  });

  describe('activity filter', () => {
    it('defaults selectedActivityFilter to all and leaves moduleFilterOptions/renderedTree provably unchanged', () => {
      setup('o1');
      fixture.detectChanges();

      expect(fixture.componentInstance.selectedActivityFilter()).toBe('all');
      expect(fixture.componentInstance.moduleFilterOptions().map((o) => o.id)).toEqual(['o1', 'o2', 'o3', 'o4']);
      expect(fixture.componentInstance.renderedTree()).toEqual(tree);
    });

    it('includes isActive on each moduleFilterOptions entry', () => {
      setup('o1');
      fixture.detectChanges();

      expect(fixture.componentInstance.moduleFilterOptions()).toEqual([
        { id: 'o1', title: 'Root', isActive: true },
        { id: 'o2', title: 'Child', isActive: true },
        { id: 'o3', title: 'Other', isActive: true },
        { id: 'o4', title: 'Retired Module', isActive: false }
      ]);
    });

    it('excludes the inactive module from moduleFilterOptions when the filter is active', () => {
      setup('o1');
      fixture.detectChanges();

      fixture.componentInstance.onActivityFilterChanged('active');
      fixture.detectChanges();

      const ids = fixture.componentInstance.moduleFilterOptions().map((o) => o.id);
      expect(ids).not.toContain('o4');
      expect(ids).toEqual(['o1', 'o2', 'o3']);
    });

    it('includes the inactive module in moduleFilterOptions when the filter is inactive', () => {
      setup('o1');
      fixture.detectChanges();

      fixture.componentInstance.onActivityFilterChanged('inactive');
      fixture.detectChanges();

      expect(fixture.componentInstance.moduleFilterOptions().map((o) => o.id)).toContain('o4');
    });

    it('includes the inactive module in moduleFilterOptions when the filter is all', () => {
      setup('o1');
      fixture.detectChanges();

      fixture.componentInstance.onActivityFilterChanged('all');
      fixture.detectChanges();

      expect(fixture.componentInstance.moduleFilterOptions().map((o) => o.id)).toContain('o4');
    });

    it('prunes renderedTree to only inactive modules when inactive is selected', () => {
      setup('o1');
      fixture.detectChanges();

      fixture.componentInstance.onActivityFilterChanged('inactive');
      fixture.detectChanges();

      const rendered = fixture.componentInstance.renderedTree();
      expect(rendered?.id).toBe('o1');
      expect(rendered?.children.map((c) => c.id)).toEqual(['o4']);
    });

    it('prunes renderedTree to only active modules when active is selected', () => {
      setup('o1');
      fixture.detectChanges();

      fixture.componentInstance.onActivityFilterChanged('active');
      fixture.detectChanges();

      const rendered = fixture.componentInstance.renderedTree();
      expect(rendered?.id).toBe('o1');
      expect(rendered?.children.map((c) => c.id)).toEqual(['o2', 'o3']);
    });

    it('wires the activity filter select to selectedActivityFilter and onActivityFilterChanged', async () => {
      setup('o1');
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const trigger = fixture.nativeElement.querySelector('[data-testid="module-activity-filter-dropdown"] .work-dropdown__trigger') as HTMLElement;
      expect(trigger.textContent).toContain('All');

      fixture.componentInstance.onActivityFilterChanged('inactive');
      fixture.detectChanges();

      expect(fixture.componentInstance.selectedActivityFilter()).toBe('inactive');
    });

    it('resets selectedModuleFilter to all when the activity filter evicts the currently selected module', () => {
      setup('o1');
      fixture.detectChanges();

      // o2 ("Child") is active with no inactive descendants, so it disappears from the
      // inactive-filtered option list entirely.
      fixture.componentInstance.onModuleFilterChanged('o2');
      fixture.detectChanges();
      expect(fixture.componentInstance.selectedModuleFilter()).toBe('o2');

      fixture.componentInstance.onActivityFilterChanged('inactive');
      fixture.detectChanges();

      expect(fixture.componentInstance.selectedModuleFilter()).toBe('all');
      const rendered = fixture.componentInstance.renderedTree();
      expect(rendered?.children.map((c) => c.id)).toEqual(['o4']);
    });

    it('keeps selectedModuleFilter unchanged when the newly selected activity filter still includes the selected module', () => {
      setup('o1');
      fixture.detectChanges();

      fixture.componentInstance.onModuleFilterChanged('o2');
      fixture.detectChanges();

      fixture.componentInstance.onActivityFilterChanged('active');
      fixture.detectChanges();

      expect(fixture.componentInstance.selectedModuleFilter()).toBe('o2');
    });
  });

  describe('moduleFilterOptions ancestor independence (Finding 3)', () => {
    const inactiveGrandchild: MilestoneTreeNode = {
      id: 'g1', title: 'Inactive Grandchild', description: null, startDate: '2026-01-10', endDate: '2026-02-01',
      progress: 0, allocatedHours: 0, completedHours: 0, isActive: false, isAchieved: false,
      ownerName: null, isOwner: true, children: [], kind: 'objective'
    };
    const activeRootWithInactiveDescendant: MilestoneTreeNode = {
      id: 'r1', title: 'Active Root', description: null, startDate: '2026-01-01', endDate: '2026-12-01',
      progress: 0, allocatedHours: 0, completedHours: 0, isActive: true, isAchieved: false,
      ownerName: null, isOwner: true, children: [inactiveGrandchild], kind: 'objective'
    };

    it('excludes an active ancestor from moduleFilterOptions under the inactive filter, even though it would remain visible in the tree for path preservation', () => {
      setup('r1');
      storeStub.selectedSubtree = () => activeRootWithInactiveDescendant;
      fixture.detectChanges();

      fixture.componentInstance.onActivityFilterChanged('inactive');
      fixture.detectChanges();

      const ids = fixture.componentInstance.moduleFilterOptions().map((o) => o.id);
      expect(ids).toEqual(['g1']);
      expect(ids).not.toContain('r1');

      // Meanwhile renderedTree legitimately keeps the active root visible as a path-preserving ancestor.
      const rendered = fixture.componentInstance.renderedTree();
      expect(rendered?.id).toBe('r1');
    });
  });

  it('renders the root tree node', () => {
    setup('o1');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Root');
  });

  it('defaults to selecting the root node once the tree loads', async () => {
    setup('o1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.selectedNode()?.id).toBe('o1');
  });

  it('re-defaults to the new root when retryTree reloads after a failure', async () => {
    setup('o1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.selectedNodeId.set(null);

    await fixture.componentInstance.retryTree();

    expect(fixture.componentInstance.selectedNode()?.id).toBe('o1');
  });

  it('selecting a node updates selectedNode via findTreeNode, with no extra store call', () => {
    setup('o1');
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('[data-testid="tree-row"]');
    (rows[1] as HTMLElement).click();
    fixture.detectChanges();

    expect(fixture.componentInstance.selectedNode()?.id).toBe('o2');
    expect(storeStub.getMilestoneDetail).not.toHaveBeenCalled();
  });

  it('clicking create-sub-module on a node opens the create modal with that node as parent', () => {
    setup('o1');
    fixture.detectChanges();

    const createButtons = fixture.nativeElement.querySelectorAll('[data-testid="create-sub-button"]');
    (createButtons[0] as HTMLElement).click();
    fixture.detectChanges();

    expect(fixture.componentInstance.createModalOpen()).toBe(true);
    expect(fixture.componentInstance.createModalParentId()).toBe('o1');
  });

  it('reloads the tree and closes the modal after a successful create', async () => {
    setup('o1');
    fixture.detectChanges();

    fixture.componentInstance.createModalParentId.set('o1');
    fixture.componentInstance.createModalOpen.set(true);
    await fixture.componentInstance.onCreateModalCreated({
      payload: { parentObjectiveId: 'o1', title: 'Design Phase', description: null, startDate: '2026-01-15', endDate: '2026-03-01', allocatedHours: 20 },
      assetFiles: []
    });

    expect(storeStub.createSubModule).toHaveBeenCalled();
    expect(storeStub.uploadMilestoneAsset).not.toHaveBeenCalled();
    expect(fixture.componentInstance.createModalOpen()).toBe(false);
    expect(storeStub.loadProjectTree).toHaveBeenCalledTimes(2);
  });

  it('uploads each staged asset file to the newly created objective before closing the modal', async () => {
    setup('o1');
    fixture.detectChanges();
    const fileA = new File(['a'], 'plan.pdf');
    const fileB = new File(['b'], 'notes.docx');

    await fixture.componentInstance.onCreateModalCreated({
      payload: { parentObjectiveId: 'o1', title: 'Design Phase', description: null, startDate: '2026-01-15', endDate: '2026-03-01', allocatedHours: 20 },
      assetFiles: [fileA, fileB]
    });

    expect(storeStub.uploadMilestoneAsset).toHaveBeenCalledWith('o1', fileA);
    expect(storeStub.uploadMilestoneAsset).toHaveBeenCalledWith('o1', fileB);
    expect(fixture.componentInstance.createModalOpen()).toBe(false);
  });

  it('surfaces a retry-via-Module-settings message in a non-modal banner when some staged files fail to upload, after the create modal has closed', async () => {
    setup('o1');
    fixture.detectChanges();
    storeStub.uploadMilestoneAsset = vi.fn()
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false });

    await fixture.componentInstance.onCreateModalCreated({
      payload: { parentObjectiveId: 'o1', title: 'Design Phase', description: null, startDate: '2026-01-15', endDate: '2026-03-01', allocatedHours: 20 },
      assetFiles: [new File(['a'], 'ok.pdf'), new File(['b'], 'bad.exe')]
    });
    fixture.detectChanges();

    // The store's modal-scoped error must NOT be used here — the create modal is already
    // closed by this point, so setMilestoneActionError would render nowhere.
    expect(storeStub.setMilestoneActionError).not.toHaveBeenCalled();
    expect(fixture.componentInstance.createModalOpen()).toBe(false);

    const banner = fixture.nativeElement.querySelector('[data-testid="create-asset-warning"]') as HTMLElement;
    expect(banner).toBeTruthy();
    expect(banner.textContent).toContain(
      '"Design Phase" was created, but 1 file(s) failed to upload — open Module settings on it to retry.'
    );
  });

  it('dismisses the create-asset warning banner when its close button is clicked', async () => {
    setup('o1');
    fixture.detectChanges();
    storeStub.uploadMilestoneAsset = vi.fn().mockResolvedValueOnce({ success: false });

    await fixture.componentInstance.onCreateModalCreated({
      payload: { parentObjectiveId: 'o1', title: 'Design Phase', description: null, startDate: '2026-01-15', endDate: '2026-03-01', allocatedHours: 20 },
      assetFiles: [new File(['a'], 'bad.exe')]
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="create-asset-warning"]')).toBeTruthy();

    (fixture.nativeElement.querySelector('[data-testid="dismiss-create-asset-warning"]') as HTMLElement).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="create-asset-warning"]')).toBeFalsy();
  });

  it('does not leak a stale create-asset warning into a freshly opened create dialog', async () => {
    setup('o1');
    fixture.detectChanges();
    storeStub.uploadMilestoneAsset = vi.fn().mockResolvedValueOnce({ success: false });

    await fixture.componentInstance.onCreateModalCreated({
      payload: { parentObjectiveId: 'o1', title: 'Design Phase', description: null, startDate: '2026-01-15', endDate: '2026-03-01', allocatedHours: 20 },
      assetFiles: [new File(['a'], 'bad.exe')]
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="create-asset-warning"]')).toBeTruthy();

    fixture.componentInstance.onCreateSubRequested(tree);
    fixture.detectChanges();

    expect(fixture.componentInstance.createModalOpen()).toBe(true);
    expect(fixture.nativeElement.querySelector('[data-testid="create-asset-warning"]')).toBeFalsy();
  });

  it('opens the settings modal and fetches full detail when Edit is requested', async () => {
    const detail = { id: 'o1', title: 'Root', description: 'Full scope', startDate: '2026-01-01', endDate: '2026-12-01', allocatedHours: 40, isAchieved: false, isDefault: true };
    storeStub.getMilestoneDetail = vi.fn().mockResolvedValue(detail);
    setup('o1');
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('[data-testid="tree-row"]');
    (rows[0] as HTMLElement).click();
    fixture.detectChanges();
    await fixture.componentInstance.onEditRequested();

    expect(fixture.componentInstance.settingsOpen()).toBe(true);
    expect(storeStub.getMilestoneDetail).toHaveBeenCalledWith('o1');
    expect((fixture.componentInstance.settingsInitialValue() as any)?.description).toBe('Full scope');
  });

  it('opens the members popup when a row requests it', () => {
    setup('o1');
    fixture.detectChanges();
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="tree-row"]');
    (rows[0] as HTMLElement).click();
    fixture.detectChanges();

    fixture.componentInstance.onMembersRequested();
    fixture.detectChanges();

    expect(fixture.componentInstance.membersPopupOpen()).toBe(true);
  });

  it('loads objective members when the popup opens', () => {
    setup('o1');
    fixture.detectChanges();
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="tree-row"]');
    (rows[0] as HTMLElement).click();
    fixture.detectChanges();

    fixture.componentInstance.onMembersRequested();

    expect(storeStub.loadObjectiveMembers).toHaveBeenCalledWith('o1');
  });

  it('calls store.addObjectiveMember when the popup requests adding a member', async () => {
    setup('o1');
    fixture.detectChanges();
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="tree-row"]');
    (rows[0] as HTMLElement).click();
    fixture.detectChanges();

    await fixture.componentInstance.onAddMemberRequested('e9');

    expect(storeStub.addObjectiveMember).toHaveBeenCalledWith('o1', 'e9');
  });

  it('calls store.removeObjectiveMember when the popup requests removing a member', async () => {
    setup('o1');
    fixture.detectChanges();
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="tree-row"]');
    (rows[0] as HTMLElement).click();
    fixture.detectChanges();

    await fixture.componentInstance.onRemoveMemberRequested('e9');

    expect(storeStub.removeObjectiveMember).toHaveBeenCalledWith('o1', 'e9');
  });

  it('calls store.transferObjectiveHead when the popup requests a leader transfer', async () => {
    setup('o1');
    fixture.detectChanges();
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="tree-row"]');
    (rows[0] as HTMLElement).click();
    fixture.detectChanges();

    await fixture.componentInstance.onTransferRequested('e9');

    expect(storeStub.transferObjectiveHead).toHaveBeenCalledWith('o1', 'e9');
  });

  it('opens the members popup from a row without relying on prior selection', () => {
    setup('o1');
    fixture.detectChanges();

    fixture.componentInstance.onMembersRequested(child);
    fixture.detectChanges();

    expect(fixture.componentInstance.membersPopupOpen()).toBe(true);
    expect(storeStub.loadObjectiveMembers).toHaveBeenCalledWith('o2');
  });

  it('loads sprints and tasks when a leaf expand is requested', () => {
    setup('o1');
    fixture.detectChanges();
    const leaf: MilestoneTreeNode = { ...child, kind: 'objective', children: [] };

    fixture.componentInstance.onExpandLeafRequested(leaf);

    expect(storeStub.loadSprintsAndTasksForLeaf).toHaveBeenCalledWith('o2');
  });

  it('loads sprint tasks when a sprint expand is requested', () => {
    setup('o1');
    fixture.detectChanges();
    const sprint: MilestoneTreeNode = { ...child, id: 'spr-1', title: 'Sprint 1', kind: 'sprint', children: [] };

    fixture.componentInstance.onExpandLeafRequested(sprint);

    expect(storeStub.loadTasksForSprint).toHaveBeenCalledWith('spr-1');
  });

  it('refreshes a leaf after creating a sprint from its row', async () => {
    setup('o1');
    fixture.detectChanges();
    const leaf: MilestoneTreeNode = { ...child, kind: 'objective', children: [] };

    fixture.componentInstance.onCreateSprintRequested(leaf);
    await fixture.componentInstance.onSprintCreated();

    expect(storeStub.loadSprintsAndTasksForLeaf).toHaveBeenCalledWith('o2', { force: true });
  });

  it('opens the task modal in create mode scoped to one sprint from a sprint row', () => {
    setup('o1');
    fixture.detectChanges();
    const sprint: MilestoneTreeNode = {
      ...child, id: 'spr-1', title: 'Sprint 1', kind: 'sprint', parentObjectiveId: 'o1', isOwner: true, children: []
    };

    fixture.componentInstance.onCreateTaskRequested(sprint);

    expect(fixture.componentInstance.taskModalOpen()).toBe(true);
    expect(fixture.componentInstance.taskModalMode()).toBe('create');
    expect(fixture.componentInstance.taskModalPrefillModule()).toBe('o1');
    expect(fixture.componentInstance.taskModalPrefillSprint()).toBe('spr-1');
  });

  it('opens the settings modal with fetched detail when an objective row is edited', async () => {
    const detail = { id: 'o1', title: 'Root', description: 'Full scope', startDate: '2026-01-01', endDate: '2026-12-01', allocatedHours: 40, isAchieved: false, isDefault: true };
    storeStub.getMilestoneDetail = vi.fn().mockResolvedValue(detail);
    setup('o1');
    fixture.detectChanges();

    await fixture.componentInstance.onEditRequested(tree);
    fixture.detectChanges();

    expect(fixture.componentInstance.settingsOpen()).toBe(true);
    expect(storeStub.getMilestoneDetail).toHaveBeenCalledWith('o1');
    expect((fixture.componentInstance.settingsInitialValue() as any)?.description).toBe('Full scope');
  });

  it('opens sprint edit with the row sprint and refreshes the leaf on save', async () => {
    setup('o1');
    fixture.detectChanges();
    const sprint: MilestoneTreeNode = {
      ...child, id: 'spr-1', title: 'Sprint 1', kind: 'sprint', parentObjectiveId: 'o1',
      isOwner: true, children: [], startDate: '2026-08-01', endDate: '2026-08-14', status: 'active'
    };

    await fixture.componentInstance.onEditRequested(sprint);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Edit sprint');
    expect(fixture.componentInstance.editSprintNode()?.title).toBe('Sprint 1');

    await fixture.componentInstance.onSprintSaved();
    expect(storeStub.loadSprintsAndTasksForLeaf).toHaveBeenCalledWith('o1', { force: true });
  });

  it('navigates to the task detail page when a task node is edited', async () => {
    setup('o1');
    fixture.detectChanges();
    const task: MilestoneTreeNode = {
      ...child, id: 't1', title: 'Do it', kind: 'task', parentObjectiveId: 'spr-1', isOwner: true, children: [],
      taskSource: {
        id: 't1', objectiveId: 'o1', shortId: 'WEB-9', title: 'Do it', description: null,
        categoryId: 'task', statusId: 'st-1', priority: 'medium', storyPoints: null,
        dueDate: null, estimatedHours: 3, completedHours: 0, progressPercent: 0,
        sprintId: 'spr-1', assigneeEmployeeIds: [], openClockSessionEmployeeId: null, openClockSessionClockInAt: null, totalLoggedMinutes: 0,
        attachments: [], assignees: [],
        parentTaskId: null, subtaskTotalCount: 0, subtaskCompletedCount: 0, subtaskAssigneeEmployeeIds: []
      }
    };

    await fixture.componentInstance.onEditRequested(task);

    expect(fixture.componentInstance.taskModalOpen()).toBe(true);
    expect(fixture.componentInstance.taskModalMode()).toBe('edit');
    expect(fixture.componentInstance.taskModalTaskId()).toBe('t1');
  });

  it('opens the task modal in edit mode when a task node View is requested', () => {
    setup('o1');
    fixture.detectChanges();
    const task = {
      ...child, id: 'node-1', kind: 'task' as const, children: [],
      taskSource: { id: 't1', objectiveId: 'o1' }
    } as unknown as MilestoneTreeNode;

    fixture.componentInstance.onViewRequested(task);

    expect(fixture.componentInstance.taskModalOpen()).toBe(true);
    expect(fixture.componentInstance.taskModalMode()).toBe('edit');
    expect(fixture.componentInstance.taskModalTaskId()).toBe('t1');
  });

  it('shows the explanation panel for the selected tree node', async () => {
    setup('o1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-tree-explanation-panel')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="tree-explanation-panel"]')?.textContent).toContain('Root');

    (fixture.nativeElement.querySelector('[data-testid="panel-edit"]') as HTMLElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.settingsOpen()).toBe(true);
    expect(storeStub.getMilestoneDetail).toHaveBeenCalledWith('o1');
  });

  it('achieves a module then reloads the project tree', async () => {
    setup('o1');
    fixture.detectChanges();
    await fixture.componentInstance.onAchieveRequested(tree);
    expect(storeStub.achieveMilestone).toHaveBeenCalledWith('o1');
    expect(storeStub.loadProjectTree).toHaveBeenCalledTimes(2);
  });

  it('unachieves a module that is already achieved', async () => {
    setup('o1');
    fixture.detectChanges();
    await fixture.componentInstance.onAchieveRequested({ ...tree, isAchieved: true });
    expect(storeStub.unachieveMilestone).toHaveBeenCalledWith('o1');
  });

  it('forwards sprint achieve to the store', async () => {
    setup('o1');
    fixture.detectChanges();
    const sprint: MilestoneTreeNode = { ...child, id: 'spr-1', kind: 'sprint' };
    await fixture.componentInstance.onAchieveSprintRequested(sprint);
    expect(storeStub.achieveSprint).toHaveBeenCalledWith('spr-1');
  });

  it('opens the complete-sprint dialog instead of completing directly, so a disposition is always confirmed', () => {
    setup('o1');
    fixture.detectChanges();
    const sprint: MilestoneTreeNode = { ...child, id: 'spr-1', kind: 'sprint' };

    fixture.componentInstance.onCompleteSprintRequested(sprint);
    fixture.detectChanges();

    expect(storeStub.completeSprint).not.toHaveBeenCalled();
    expect(fixture.componentInstance.completingSprintNode()?.id).toBe('spr-1');
    expect(fixture.nativeElement.querySelector('app-sprint-complete-dialog')).not.toBeNull();
  });

  it('closes the complete-sprint dialog on cancel', () => {
    setup('o1');
    fixture.detectChanges();
    const sprint: MilestoneTreeNode = { ...child, id: 'spr-1', kind: 'sprint' };

    fixture.componentInstance.onCompleteSprintRequested(sprint);
    fixture.componentInstance.onSprintCompleteDialogClosed();

    expect(fixture.componentInstance.completingSprintNode()).toBeNull();
  });

  it('closes the complete-sprint dialog and refreshes the tree once completion succeeds', async () => {
    setup('o1');
    fixture.detectChanges();
    const sprint: MilestoneTreeNode = { ...child, id: 'spr-1', kind: 'sprint' };
    fixture.componentInstance.onCompleteSprintRequested(sprint);

    await fixture.componentInstance.onSprintCompleteDialogCompleted();

    expect(fixture.componentInstance.completingSprintNode()).toBeNull();
    expect(storeStub.loadProjectTree).toHaveBeenCalledTimes(2);
  });

  it('opens a confirmation dialog then deletes the task on confirm', async () => {
    setup('o1');
    fixture.detectChanges();
    const task: MilestoneTreeNode = { ...child, id: 't1', kind: 'task' };

    fixture.componentInstance.onDeleteRequested(task);
    fixture.detectChanges();
    expect(fixture.componentInstance.deleteConfirmOpen()).toBe(true);
    expect(storeStub.deleteTask).not.toHaveBeenCalled();

    await fixture.componentInstance.onDeleteConfirmed();
    expect(storeStub.deleteTask).toHaveBeenCalledWith('t1');
    expect(fixture.componentInstance.deleteConfirmOpen()).toBe(false);
  });

  it('does not delete when the confirmation is cancelled', () => {
    setup('o1');
    fixture.detectChanges();
    fixture.componentInstance.onDeleteRequested({ ...child, id: 't1', kind: 'task' });
    fixture.componentInstance.onDeleteCancelled();
    expect(storeStub.deleteTask).not.toHaveBeenCalled();
    expect(fixture.componentInstance.deleteConfirmOpen()).toBe(false);
  });

  it('opens the task modal in create mode with just the module from a module row', () => {
    setup('o1');
    fixture.detectChanges();
    fixture.componentInstance.onCreateTaskRequested(tree);

    expect(fixture.componentInstance.taskModalOpen()).toBe(true);
    expect(fixture.componentInstance.taskModalMode()).toBe('create');
    expect(fixture.componentInstance.taskModalPrefillModule()).toBe('o1');
    expect(fixture.componentInstance.taskModalPrefillSprint()).toBe('');
  });
});
