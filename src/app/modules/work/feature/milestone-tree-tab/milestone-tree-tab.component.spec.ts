import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { MilestoneTreeTabComponent } from './milestone-tree-tab.component';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { MilestoneTreeNode } from '../../models/milestone.model';
import { PeopleApiService } from '../../../people/data-access/people-api.service';

describe('MilestoneTreeTabComponent', () => {
  let fixture: ComponentFixture<MilestoneTreeTabComponent>;
  let storeStub: any;
  let routeStub: any;

  const child: MilestoneTreeNode = {
    id: 'o2', title: 'Child', description: null, startDate: '2026-01-10', endDate: '2026-02-01',
    progress: 40, allocatedHours: 5, completedHours: 2, isActive: true, isAchieved: false,
    ownerName: 'Diya', isOwner: false, children: []
  };

  const tree: MilestoneTreeNode = {
    id: 'o1', title: 'Root', description: null, startDate: '2026-01-01', endDate: '2026-12-01',
    progress: 72, allocatedHours: 40, completedHours: 29, isActive: true, isAchieved: false,
    ownerName: 'Arun Kumar', isOwner: true, children: [child]
  };

  function setup(milestoneId: string | null): void {
    routeStub = { paramMap: of({ get: (key: string) => (key === 'milestoneId' ? milestoneId : null) }) };

    TestBed.configureTestingModule({
      imports: [MilestoneTreeTabComponent],
      providers: [
        { provide: ProjectDetailStore, useValue: storeStub },
        { provide: ActivatedRoute, useValue: routeStub },
        { provide: PeopleApiService, useValue: { listEmployees: vi.fn().mockReturnValue(of({ items: [], totalCount: 0, page: 1, pageSize: 20 })) } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(MilestoneTreeTabComponent);
  }

  beforeEach(() => {
    storeStub = {
      selectedSubtree: () => tree,
      subtreeLoading: () => false,
      subtreeError: () => null,
      milestoneActionError: () => null,
      loadMilestoneSubtree: vi.fn().mockResolvedValue(undefined),
      getMilestoneDetail: vi.fn().mockResolvedValue(null),
      editMilestone: vi.fn().mockResolvedValue({ success: true, pending: false }),
      achieveMilestone: vi.fn().mockResolvedValue({ success: true, pending: false }),
      unachieveMilestone: vi.fn().mockResolvedValue({ success: true, pending: false }),
      createSubModule: vi.fn().mockResolvedValue({ success: true }),
      loadObjectiveMembers: vi.fn().mockResolvedValue(undefined),
      addObjectiveMember: vi.fn().mockResolvedValue({ success: true, alreadyMember: false }),
      removeObjectiveMember: vi.fn().mockResolvedValue({ success: true }),
      transferObjectiveHead: vi.fn().mockResolvedValue({ success: true, applied: false, viaInvitation: true }),
      objectiveMembers: () => [],
      objectiveMembersLoading: () => false
    };
  });

  it('loads the subtree for the routed milestone id', () => {
    setup('o1');
    fixture.detectChanges();
    expect(storeStub.loadMilestoneSubtree).toHaveBeenCalledWith('o1');
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

  it('selecting a node shows its detail via findTreeNode, with no extra store call', () => {
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
      parentObjectiveId: 'o1', title: 'Design Phase', description: null,
      startDate: '2026-01-15', endDate: '2026-03-01', allocatedHours: 20
    });

    expect(storeStub.createSubModule).toHaveBeenCalled();
    expect(fixture.componentInstance.createModalOpen()).toBe(false);
    expect(storeStub.loadMilestoneSubtree).toHaveBeenCalledTimes(2);
  });

  it('calls achieveMilestone when the selected node is not yet achieved, then reloads the tree', async () => {
    setup('o1');
    fixture.detectChanges();
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="tree-row"]');
    (rows[0] as HTMLElement).click();
    fixture.detectChanges();

    await fixture.componentInstance.onAchieveToggleRequested();

    expect(storeStub.achieveMilestone).toHaveBeenCalledWith('o1');
    expect(storeStub.unachieveMilestone).not.toHaveBeenCalled();
    expect(storeStub.loadMilestoneSubtree).toHaveBeenCalledTimes(2);
  });

  it('calls unachieveMilestone when the selected node is already achieved', async () => {
    const achievedTree = { ...tree, isAchieved: true };
    storeStub.selectedSubtree = () => achievedTree;
    setup('o1');
    fixture.detectChanges();
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="tree-row"]');
    (rows[0] as HTMLElement).click();
    fixture.detectChanges();

    await fixture.componentInstance.onAchieveToggleRequested();

    expect(storeStub.unachieveMilestone).toHaveBeenCalledWith('o1');
    expect(storeStub.achieveMilestone).not.toHaveBeenCalled();
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

  it('opens the members popup when the detail panel requests it', () => {
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
});
