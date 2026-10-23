import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { By } from '@angular/platform-browser';
import { NotificationService } from '../../../../core/services/notification.service';
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
import { WorkApprovalsApiService } from '../../data-access/work-approvals-api.service';
import { EmployeeDirectoryStore } from '../../state/employee-directory.store';
import { WorkPageToolbarStore } from '../../state/work-page-toolbar.store';
import { FileApiService } from '../../../../shared/data-access/file-api.service';

describe('MilestoneTreeTabComponent', () => {
  let fixture: ComponentFixture<MilestoneTreeTabComponent>;
  let storeStub: any;
  let routeStub: any;
  let routerStub: { navigate: ReturnType<typeof vi.fn> };
  let approvalsApiStub: { acceptObjectiveInvitation: ReturnType<typeof vi.fn>; rejectObjectiveInvitation: ReturnType<typeof vi.fn> };
  let directoryStub: { ensureLoaded: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn> };

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

  function setup(milestoneId: string | null, queryParams: Record<string, string> = {}): void {
    const paramGet = (key: string) => {
      if (key === 'milestoneId') return milestoneId;
      if (key === 'id') return 'p1';
      return null;
    };
    const queryParamGet = (key: string) => queryParams[key] ?? null;
    routeStub = {
      paramMap: of({ get: paramGet }),
      snapshot: { paramMap: { get: paramGet }, queryParamMap: { get: queryParamGet } },
      parent: null
    };
    routerStub = { navigate: vi.fn().mockResolvedValue(true) };
    approvalsApiStub = {
      acceptObjectiveInvitation: vi.fn().mockReturnValue(of(undefined)),
      rejectObjectiveInvitation: vi.fn().mockReturnValue(of(undefined))
    };
    directoryStub = {
      ensureLoaded: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockReturnValue(undefined)
    };

    TestBed.configureTestingModule({
      imports: [MilestoneTreeTabComponent],
      providers: [
        { provide: ProjectDetailStore, useValue: storeStub },
        { provide: ActivatedRoute, useValue: routeStub },
        { provide: PeopleApiService, useValue: { listEmployees: vi.fn().mockReturnValue(of({ items: [], totalCount: 0, page: 1, pageSize: 20 })) } },
        { provide: SprintListStore, useValue: { error: () => null, create: vi.fn(), edit: vi.fn() } },
        { provide: TaskBoardStore, useValue: { error: () => null, createTask: vi.fn(), statuses: () => [] } },
        { provide: TaskApiService, useValue: { getStatuses: vi.fn().mockReturnValue(of([])), getCategories: vi.fn().mockReturnValue(of([])) } },
        { provide: WorkApprovalsApiService, useValue: approvalsApiStub },
        { provide: EmployeeDirectoryStore, useValue: directoryStub },
        { provide: FileApiService, useValue: { getFileUrl: (fileId: string) => `/cached/${fileId}` } },
        { provide: Router, useValue: routerStub },
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(MilestoneTreeTabComponent);
  }

  function renderToolbar() {
    const template = TestBed.inject(WorkPageToolbarStore).template();
    expect(template).not.toBeNull();
    const view = template!.createEmbeddedView(null);
    view.detectChanges();
    const host = document.createElement('div');
    view.rootNodes.forEach((node) => host.appendChild(node));
    return { host, view };
  }

  beforeEach(() => {
    storeStub = {
      project: () => ({
        id: 'p1',
        members: [
          { userId: 'e1', displayName: 'Arun Kumar', avatarFileId: 'avatar-1' },
          { userId: 'e2', displayName: 'Diya', avatarFileId: null }
        ]
      }),
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
      deleteSprint: vi.fn().mockResolvedValue({ success: true }),
      getMilestoneDetail: vi.fn().mockResolvedValue(null),
      editMilestone: vi.fn().mockResolvedValue({ success: true, pending: true }),
      achieveMilestone: vi.fn().mockResolvedValue({ success: true, pending: false }),
      unachieveMilestone: vi.fn().mockResolvedValue({ success: true, pending: false }),
      createSubModule: vi.fn().mockResolvedValue({ success: true, objectiveId: 'o1' }),
      uploadMilestoneAsset: vi.fn().mockResolvedValue({ success: true }),
      setMilestoneActionError: vi.fn(),
      loadObjectiveMembers: vi.fn().mockResolvedValue(undefined),
      addObjectiveMember: vi.fn().mockResolvedValue({ success: true, alreadyMember: false, applied: true, pending: false }),
      removeObjectiveMember: vi.fn().mockResolvedValue({ success: true, applied: true, pending: false }),
      transferObjectiveHead: vi.fn().mockResolvedValue({ success: true, applied: false, viaInvitation: true }),
      objectiveMembers: () => [],
      objectiveMembersLoading: () => false,
      loadProjectMembers: vi.fn().mockResolvedValue(undefined),
      projectMembers: () => [{ employeeId: 'e1', name: 'Arun Kumar' }, { employeeId: 'e2', name: 'Diya' }]
    };
  });

  it('loads the project-wide tree for the routed project id', () => {
    setup('o1');
    fixture.detectChanges();
    expect(storeStub.loadProjectTree).toHaveBeenCalledWith('p1');
  });

  it('pre-warms the employee directory with project members so task-assignee avatars resolve without the coverage-scoped lookup', async () => {
    setup('o1');
    fixture.detectChanges();
    await fixture.whenStable();
    await Promise.resolve();
    await Promise.resolve();

    expect(storeStub.loadProjectMembers).toHaveBeenCalledWith('p1');
    expect(directoryStub.ensureLoaded).toHaveBeenCalledWith(['e1', 'e2']);
  });

  it('registers collapsed search before the cached-avatar member filter and the remaining Tree actions', async () => {
    setup('o1');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('[data-testid="tree-search"]')).toBeNull();
    const toolbar = renderToolbar();
    const searchToggle = toolbar.host.querySelector('[data-testid="tree-search-toggle"]') as HTMLButtonElement;
    const memberFilter = toolbar.host.querySelector('app-task-assignee-avatar-filter') as HTMLElement;
    expect(searchToggle).not.toBeNull();
    expect(toolbar.host.querySelector('[data-testid="tree-search"]')).toBeNull();
    expect(memberFilter).not.toBeNull();
    expect(searchToggle.compareDocumentPosition(memberFilter) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(memberFilter.querySelector('img')?.getAttribute('src')).toBe('/cached/avatar-1');
    expect(toolbar.host.querySelector('app-filter-bar')).not.toBeNull();
    expect(toolbar.host.querySelector('[data-testid="expand-all-toggle"]')).not.toBeNull();

    (memberFilter.querySelector('.taaf__avatar') as HTMLButtonElement).click();
    expect(fixture.componentInstance.ownerFilter()).toEqual(['e1']);

    searchToggle.click();
    toolbar.view.detectChanges();
    expect(toolbar.host.querySelector('[data-testid="tree-search"] input')).not.toBeNull();

    const createButton = Array.from(toolbar.host.querySelectorAll('button'))
      .find((button) => button.textContent?.trim() === 'Create module') as HTMLButtonElement;
    expect(createButton).toBeTruthy();
    createButton.click();
    expect(fixture.componentInstance.createModalOpen()).toBe(true);
    expect(fixture.componentInstance.createModalParentId()).toBe('o1');
    toolbar.view.destroy();
  });

  it('offers New meeting in the toolbar, placed in the routed module', () => {
    setup('o1');
    fixture.detectChanges();

    const toolbar = renderToolbar();
    const button = Array.from(toolbar.host.querySelectorAll('button'))
      .find((b) => b.textContent?.trim() === 'New meeting') as HTMLButtonElement;
    expect(button).toBeTruthy();
    button.click();
    fixture.detectChanges();

    const form = fixture.debugElement.query(By.css('app-meeting-form-modal'));
    expect(form).not.toBeNull();
    expect(form.componentInstance.placement()).toEqual({ projectId: 'p1', objectiveId: 'o1' });
    toolbar.view.destroy();
  });

  it('does not show Create module in the toolbar when the root module is not owned', () => {
    storeStub.selectedSubtree = () => ({ ...tree, isOwner: false });
    setup('o1');
    fixture.detectChanges();

    const toolbar = renderToolbar();
    const createButton = Array.from(toolbar.host.querySelectorAll('button'))
      .find((button) => button.textContent?.trim() === 'Create module');
    expect(createButton).toBeUndefined();
    toolbar.view.destroy();
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

  describe('highlight filter + expand all', () => {
    const grandchild: MilestoneTreeNode = {
      id: 'g1', title: 'Grandchild', description: null, startDate: '2026-01-12', endDate: '2026-01-20',
      progress: 0, allocatedHours: 0, completedHours: 0, isActive: true, isAchieved: false,
      ownerName: null, ownerId: 'e9', isOwner: true, children: [], kind: 'objective'
    };
    const deepTree: MilestoneTreeNode = {
      ...tree,
      children: [{ ...child, ownerId: 'e2', kind: 'objective', children: [grandchild] }, sibling, inactiveSibling]
    };

    const titles = (): string[] =>
      Array.from(fixture.nativeElement.querySelectorAll('[data-testid="title-text"]') as NodeListOf<HTMLElement>)
        .map((el) => el.textContent?.trim() ?? '');
    const highlightedTitles = (): string[] =>
      Array.from(fixture.nativeElement.querySelectorAll('[data-highlighted] [data-testid="title-text"]') as NodeListOf<HTMLElement>)
        .map((el) => el.textContent?.trim() ?? '');

    it('replaces the old prune dropdowns with the highlight filter bar and an expand-all toggle', () => {
      setup('o1');
      fixture.detectChanges();
      const toolbar = renderToolbar();
      expect(fixture.nativeElement.querySelector('[data-testid="module-filter-dropdown"]')).toBeNull();
      expect(fixture.nativeElement.querySelector('[data-testid="module-activity-filter-dropdown"]')).toBeNull();
      expect(toolbar.host.querySelector('app-filter-bar')).not.toBeNull();
      expect(toolbar.host.querySelector('[data-testid="expand-all-toggle"]')).not.toBeNull();
      toolbar.view.destroy();
    });

    it('offers every approved highlight field', () => {
      setup('o1');
      fixture.detectChanges();
      expect(fixture.componentInstance.filterFields().map((f) => f.key)).toEqual([
        'module', 'owner', 'activeStatus', 'dueDate', 'duration', 'itemType',
        'sprint', 'taskStatus', 'priority', 'category', 'progress'
      ]);
    });

    it('never prunes: a filter keeps every row rendered and only marks the matches', () => {
      setup('o1');
      fixture.detectChanges();
      fixture.componentInstance.onFilterFieldChanged({ key: 'activeStatus', values: ['inactive'] });
      fixture.detectChanges();

      expect(titles()).toEqual(expect.arrayContaining(['Root', 'Child', 'Other', 'Retired Module']));
      expect(highlightedTitles()).toEqual(['Retired Module']);
      expect(fixture.nativeElement.querySelector('[data-testid="highlight-match-count"]').textContent.trim()).toBe('1 match');
    });

    it('clears all highlighting when the filter is removed', () => {
      setup('o1');
      fixture.detectChanges();
      fixture.componentInstance.onFilterFieldChanged({ key: 'activeStatus', values: ['inactive'] });
      fixture.componentInstance.onFilterFieldChanged({ key: 'activeStatus', values: [] });
      fixture.detectChanges();
      expect(highlightedTitles()).toEqual([]);
      expect(fixture.nativeElement.querySelector('[data-testid="highlight-match-count"]')).toBeNull();
    });

    it('paints matched rows with the chosen highlight color', () => {
      setup('o1');
      fixture.detectChanges();
      fixture.componentInstance.onFilterFieldChanged({ key: 'activeStatus', values: ['inactive'] });
      fixture.componentInstance.onHighlightColorChanged('#ef4444');
      fixture.detectChanges();
      const row = fixture.nativeElement.querySelector('[data-highlighted]') as HTMLElement;
      expect(row.style.getPropertyValue('--tree-highlight')).toBe('#ef4444');
    });

    it('searches module, sprint and task titles through the shared search input, highlighting (never hiding) matches', () => {
      storeStub.selectedSubtree = () => deepTree;
      setup('o1');
      fixture.detectChanges();
      const toolbar = renderToolbar();
      (toolbar.host.querySelector('[data-testid="tree-search-toggle"]') as HTMLButtonElement).click();
      toolbar.view.detectChanges();
      const input = toolbar.host.querySelector('[data-testid="tree-search"] input') as HTMLInputElement;
      expect(input.type).toBe('search');

      storeStub.loadSprintsAndTasksForLeaf.mockClear();
      input.value = 'grand';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      expect(titles()).toEqual(expect.arrayContaining(['Root', 'Child', 'Other', 'Grandchild']));
      expect(highlightedTitles()).toEqual(['Grandchild']);
      expect(storeStub.loadSprintsAndTasksForLeaf).toHaveBeenCalled();
      toolbar.view.destroy();
    });

    it('uses a border glow on hover instead of the gray background, tinted with the highlight color on matches', () => {
      setup('o1');
      fixture.detectChanges();
      fixture.componentInstance.onFilterFieldChanged({ key: 'activeStatus', values: ['inactive'] });
      fixture.componentInstance.onHighlightColorChanged('#22c55e');
      fixture.detectChanges();
      const rows = Array.from(fixture.nativeElement.querySelectorAll('[data-testid="tree-row"]') as NodeListOf<HTMLElement>);
      expect(rows.every((row) => row.classList.contains('tree-row'))).toBe(true);
      expect(rows.some((row) => row.className.includes('hover:bg-'))).toBe(false);
      const highlighted = fixture.nativeElement.querySelector('[data-highlighted]') as HTMLElement;
      expect(highlighted.style.getPropertyValue('--tree-row-glow')).toBe('#22c55e');
    });

    it('labels the first column "Module"', () => {
      setup('o1');
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[data-testid="tree-column-header"]').textContent).toContain('Module');
      expect(fixture.nativeElement.querySelector('[data-testid="tree-column-header"]').textContent).not.toContain('Work item');
    });

    it('counts every highlighted row, including a shared sprint rendered under two modules', () => {
      const sharedTask = (): MilestoneTreeNode => ({
        ...child, id: 't1', title: 'Shared Task', kind: 'task', children: [],
        taskSource: { id: 't1', priority: 'high', statusId: 's', categoryId: 'c', dueDate: null, assigneeEmployeeIds: [] } as any
      });
      const sharedSprint = (): MilestoneTreeNode => ({
        ...child, id: 'sp1', title: 'Shared Sprint', kind: 'sprint', sprintTaskLoadState: 'loaded', children: [sharedTask()]
      });
      storeStub.selectedSubtree = () => ({
        ...tree,
        children: [
          { ...child, kind: 'objective', sprintTaskLoadState: 'loaded', children: [sharedSprint()] },
          { ...sibling, kind: 'objective', sprintTaskLoadState: 'loaded', children: [sharedSprint()] }
        ]
      });
      setup('o1');
      fixture.detectChanges();

      fixture.componentInstance.onFilterFieldChanged({ key: 'priority', values: ['high'] });
      fixture.detectChanges();

      expect(highlightedTitles()).toEqual(['Shared Task', 'Shared Task']);
      expect(fixture.nativeElement.querySelector('[data-testid="highlight-match-count"]').textContent.trim()).toBe('2 matches');
    });

    it('loads every leaf module\'s sprints and tasks once a filter is active, so task-level fields can match', () => {
      setup('o1');
      fixture.detectChanges();
      storeStub.loadSprintsAndTasksForLeaf.mockClear();
      fixture.componentInstance.onFilterFieldChanged({ key: 'priority', values: ['high'] });
      const loaded = storeStub.loadSprintsAndTasksForLeaf.mock.calls.map((call: unknown[]) => call[0]).sort();
      expect(loaded).toEqual(['o2', 'o3', 'o4']);
    });

    it('auto-expands the ancestors of a match hidden in a collapsed branch', () => {
      storeStub.selectedSubtree = () => deepTree;
      setup('o1');
      fixture.detectChanges();
      expect(titles()).not.toContain('Grandchild');

      fixture.componentInstance.onFilterFieldChanged({ key: 'owner', values: ['e9'] });
      fixture.detectChanges();
      expect(titles()).toContain('Grandchild');
      expect(highlightedTitles()).toEqual(['Grandchild']);
    });

    it('expand all opens every branch and loads the whole tree; clicking again collapses it', async () => {
      storeStub.selectedSubtree = () => deepTree;
      setup('o1');
      fixture.detectChanges();
      storeStub.loadSprintsAndTasksForLeaf.mockClear();
      const toolbar = renderToolbar();
      const toggle = () => toolbar.host.querySelector('[data-testid="expand-all-toggle"]') as HTMLButtonElement;
      expect(toggle().textContent).toContain('Expand all');

      toggle().click();
      fixture.detectChanges();
      toolbar.view.detectChanges();
      expect(titles()).toContain('Grandchild');
      expect(storeStub.loadSprintsAndTasksForLeaf).toHaveBeenCalled();
      expect(toggle().textContent).toContain('Collapse all');

      toggle().click();
      fixture.detectChanges();
      toolbar.view.detectChanges();
      // The root stays open so the first level remains visible.
      expect(titles()).not.toContain('Grandchild');
      expect(titles()).toEqual(expect.arrayContaining(['Root', 'Child']));
      toolbar.view.destroy();
    });
  });

  it('always shows achieved modules in the tree', () => {
    const achieved: MilestoneTreeNode = { ...sibling, id: 'o5', title: 'Shipped Module', isAchieved: true };
    storeStub.selectedSubtree = () => ({ ...tree, children: [child, achieved] });
    setup('o1');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Shipped Module');
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

  it('"Request more hours" in the panel opens the allocation request for that module; sending it reloads the tree', async () => {
    setup('o1');
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('[data-testid="panel-request-hours"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.componentInstance.allocationNode()?.id).toBe('o1');
    expect(fixture.nativeElement.querySelector('[data-testid="allocation-request-modal"]')).not.toBeNull();

    const loadsBefore = storeStub.loadProjectTree.mock.calls.length;
    await fixture.componentInstance.onAllocationSubmitted();
    fixture.detectChanges();

    expect(fixture.componentInstance.allocationNode()).toBeNull();
    expect(storeStub.loadProjectTree.mock.calls.length).toBe(loadsBefore + 1);
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

  it('shows a "Request submitted." toast when an edit is submitted for approval', async () => {
    setup('o1');
    fixture.detectChanges();
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="tree-row"]');
    (rows[0] as HTMLElement).click();
    fixture.detectChanges();
    const info = vi.spyOn(TestBed.inject(NotificationService), 'info');

    await fixture.componentInstance.onSettingsSaved({
      fields: { title: 'Root', description: '', startDate: '2026-01-01', endDate: '2026-12-01', allocatedHours: 40 },
      achievedChanged: false,
      achieved: false
    });
    fixture.detectChanges();

    expect(info).toHaveBeenCalledWith('Request submitted.');
  });

  it('does not show a toast when the edit applied immediately', async () => {
    storeStub.editMilestone = vi.fn().mockResolvedValue({ success: true, pending: false });
    setup('o1');
    fixture.detectChanges();
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="tree-row"]');
    (rows[0] as HTMLElement).click();
    fixture.detectChanges();
    const info = vi.spyOn(TestBed.inject(NotificationService), 'info');

    await fixture.componentInstance.onSettingsSaved({
      fields: { title: 'Root', description: '', startDate: '2026-01-01', endDate: '2026-12-01', allocatedHours: 40 },
      achievedChanged: false,
      achieved: false
    });
    fixture.detectChanges();

    expect(info).not.toHaveBeenCalled();
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

  it('a member add sent for approval shows "Member add sent for approval."', async () => {
    setup('o1');
    fixture.detectChanges();
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="tree-row"]');
    (rows[0] as HTMLElement).click();
    fixture.detectChanges();
    storeStub.addObjectiveMember.mockResolvedValue({ success: true, alreadyMember: false, applied: false, pending: true });
    const info = vi.spyOn(TestBed.inject(NotificationService), 'info');

    await fixture.componentInstance.onAddMemberRequested('e9');

    expect(info).toHaveBeenCalledWith('Member add sent for approval.');
  });

  it('does not show a toast when a member add is applied immediately', async () => {
    setup('o1');
    fixture.detectChanges();
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="tree-row"]');
    (rows[0] as HTMLElement).click();
    fixture.detectChanges();
    const info = vi.spyOn(TestBed.inject(NotificationService), 'info');

    await fixture.componentInstance.onAddMemberRequested('e9');

    expect(info).not.toHaveBeenCalled();
  });

  it('a member removal sent for approval shows "Member removal sent for approval."', async () => {
    setup('o1');
    fixture.detectChanges();
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="tree-row"]');
    (rows[0] as HTMLElement).click();
    fixture.detectChanges();
    storeStub.removeObjectiveMember.mockResolvedValue({ success: true, applied: false, pending: true });
    const info = vi.spyOn(TestBed.inject(NotificationService), 'info');

    await fixture.componentInstance.onRemoveMemberRequested('e9');

    expect(info).toHaveBeenCalledWith('Member removal sent for approval.');
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

  it('calls acceptObjectiveInvitation and reloads members when the popup accepts my invitation', async () => {
    setup('o1');
    fixture.detectChanges();
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="tree-row"]');
    (rows[0] as HTMLElement).click();
    fixture.detectChanges();

    await fixture.componentInstance.onInvitationAcceptRequested('inv-1');

    expect(approvalsApiStub.acceptObjectiveInvitation).toHaveBeenCalledWith('inv-1');
    expect(storeStub.loadObjectiveMembers).toHaveBeenCalledWith('o1');
  });

  it('calls rejectObjectiveInvitation and reloads members when the popup declines my invitation', async () => {
    setup('o1');
    fixture.detectChanges();
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="tree-row"]');
    (rows[0] as HTMLElement).click();
    fixture.detectChanges();

    await fixture.componentInstance.onInvitationDeclineRequested('inv-1');

    expect(approvalsApiStub.rejectObjectiveInvitation).toHaveBeenCalledWith('inv-1');
    expect(storeStub.loadObjectiveMembers).toHaveBeenCalledWith('o1');
  });

  it('auto-opens the members popup when the route carries ?openMembers=1 (deep link from a notification)', async () => {
    setup('o1', { openMembers: '1' });
    fixture.detectChanges();
    await fixture.whenStable();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    expect(fixture.componentInstance.membersPopupOpen()).toBe(true);
    expect(storeStub.loadObjectiveMembers).toHaveBeenCalledWith('o1');
  });

  it('does not auto-open the members popup when ?openMembers is absent', async () => {
    setup('o1');
    fixture.detectChanges();
    await fixture.whenStable();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    expect(fixture.componentInstance.membersPopupOpen()).toBe(false);
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
        parentTaskId: null, subtaskTotalCount: 0, subtaskCompletedCount: 0, subtaskAssigneeEmployeeIds: [],
        createdAt: new Date('2026-01-01T00:00:00Z'), hasPendingApproval: false
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

  it('deleting a sprint uses the shared confirm, titled for a sprint, and calls store.deleteSprint (not deleteTask)', async () => {
    setup('o1');
    fixture.detectChanges();
    const sprint: MilestoneTreeNode = { ...child, id: 'spr-1', kind: 'sprint', status: 'complete' };

    fixture.componentInstance.onDeleteRequested(sprint);
    fixture.detectChanges();
    expect((fixture.componentInstance as any).deletingSprint()).toBe(true);
    await fixture.componentInstance.onDeleteConfirmed();

    expect(storeStub.deleteSprint).toHaveBeenCalledWith('spr-1');
    expect(storeStub.deleteTask).not.toHaveBeenCalled();
    expect(fixture.componentInstance.deleteConfirmOpen()).toBe(false);
  });

  it('a sprint deletion sent for approval shows "Sprint deletion sent for approval."', async () => {
    setup('o1');
    fixture.detectChanges();
    storeStub.deleteSprint.mockResolvedValue({ success: true, pending: true });
    const info = vi.spyOn(TestBed.inject(NotificationService), 'info');

    fixture.componentInstance.onDeleteRequested({ ...child, id: 'spr-1', kind: 'sprint', status: 'achieved' });
    await fixture.componentInstance.onDeleteConfirmed();

    expect(info).toHaveBeenCalledWith('Sprint deletion sent for approval.');
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

  describe('sprint form binding stability (Finding 1)', () => {
    const sprintNode: MilestoneTreeNode = {
      ...child, id: 'spr-1', title: 'Sprint 1', kind: 'sprint', parentObjectiveId: 'o1',
      isOwner: true, children: [], startDate: '2026-08-01', endDate: '2026-08-14', status: 'active'
    };

    it('keeps editSprintModel/editSprintModules referentially stable across repeated change-detection passes', async () => {
      setup('o1');
      fixture.detectChanges();

      await fixture.componentInstance.onEditRequested(sprintNode);
      fixture.detectChanges();

      const modelA = fixture.componentInstance.editSprintModel();
      const modulesA = fixture.componentInstance.editSprintModules();
      fixture.detectChanges();
      fixture.detectChanges();
      const modelB = fixture.componentInstance.editSprintModel();
      const modulesB = fixture.componentInstance.editSprintModules();

      expect(modelB).toBe(modelA);
      expect(modulesB).toBe(modulesA);
    });

    it('keeps createSprintModules referentially stable across repeated change-detection passes', () => {
      setup('o1');
      fixture.detectChanges();

      fixture.componentInstance.onCreateSprintRequested(tree);
      fixture.detectChanges();

      const modulesA = fixture.componentInstance.createSprintModules();
      fixture.detectChanges();
      fixture.detectChanges();
      const modulesB = fixture.componentInstance.createSprintModules();

      expect(modulesB).toBe(modulesA);
    });
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

  describe('view switch', () => {
    const el = () => fixture.nativeElement as HTMLElement;
    // The switch lives in the toolbar template, which the page shell renders, not this component.
    const toolbar = () => renderToolbar().host;
    const switchTo = (mode: 'tree' | 'network') => {
      toolbar().querySelector<HTMLButtonElement>(`[data-testid="tree-view-switch-${mode}"]`)!.click();
      fixture.detectChanges();
    };

    it('renders the tree list and not the network view by default', () => {
      setup('o1');
      fixture.detectChanges();

      expect(el().querySelector('app-milestone-tree-node')).not.toBeNull();
      expect(el().querySelector('app-project-network-view')).toBeNull();
    });

    it('renders the network view and not the tree list after the switch is clicked', () => {
      setup('o1');
      fixture.detectChanges();
      switchTo('network');

      expect(fixture.componentInstance.viewMode()).toBe('network');
      expect(el().querySelector('app-project-network-view')).not.toBeNull();
      expect(el().querySelector('app-milestone-tree-node')).toBeNull();
    });

    it('keeps tree search, the owner filter, the highlight filter bar and Expand all visible in network mode', () => {
      setup('o1');
      fixture.detectChanges();
      switchTo('network');
      const host = toolbar();

      // The header must not change when the view does (spec Revision 1).
      expect(host.querySelector('[data-testid="tree-search-toggle"]')).not.toBeNull();
      expect(host.querySelector('app-task-assignee-avatar-filter')).not.toBeNull();
      expect(host.querySelector('app-filter-bar')).not.toBeNull();
      expect(host.querySelector('[data-testid="expand-all-toggle"]')).not.toBeNull();
    });

    it('keeps Create module and the switch itself visible in network mode', () => {
      setup('o1');
      fixture.detectChanges();
      switchTo('network');
      const host = toolbar();

      expect(host.querySelector('[data-testid="tree-view-switch-tree"]')).not.toBeNull();
      expect(host.textContent).toContain('Create module');
    });

    it('paints the selected mode with the accent background and the other with the secondary text colour', () => {
      setup('o1');
      fixture.detectChanges();
      switchTo('network');
      const host = toolbar();
      const network = host.querySelector('[data-testid="tree-view-switch-network"]')!;
      const tree = host.querySelector('[data-testid="tree-view-switch-tree"]')!;

      // The exact Tailwind class names - a backslash-escaped binding adds a class no rule matches.
      expect(network.classList.contains('bg-[var(--color-accent)]')).toBe(true);
      expect(network.classList.contains('text-white')).toBe(true);
      expect(tree.classList.contains('text-[var(--color-text-secondary)]')).toBe(true);
      expect(tree.classList.contains('bg-[var(--color-accent)]')).toBe(false);
    });

    it('keeps the explanation card column mounted in tree mode', () => {
      setup('o1');
      fixture.detectChanges();

      expect(el().querySelector('app-tree-explanation-panel, app-empty-state')).not.toBeNull();
    });

    it('keeps the same explanation card beside the network in network mode', () => {
      setup('o1');
      fixture.detectChanges();
      switchTo('network');

      expect(el().querySelector('app-tree-explanation-panel')).not.toBeNull();
      expect(el().querySelector('[data-testid="tree-explanation-panel"]')?.textContent).toContain('Root');
    });

    it('shows a module clicked in the network in the explanation card, staying in network mode', async () => {
      setup('o1');
      fixture.detectChanges();
      switchTo('network');

      await fixture.componentInstance.onNetworkNodeSelected({ id: 'module:o3', kind: 'module', label: 'Other', objectiveId: 'o3' });
      fixture.detectChanges();

      expect(fixture.componentInstance.viewMode()).toBe('network');
      expect(fixture.componentInstance.selectedNodeId()).toBe('o3');
      expect(el().querySelector('[data-testid="tree-explanation-panel"]')?.textContent).toContain('Other');
    });
  });
});
