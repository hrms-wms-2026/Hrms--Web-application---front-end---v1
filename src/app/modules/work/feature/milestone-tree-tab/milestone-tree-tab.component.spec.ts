import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { MilestoneTreeTabComponent } from './milestone-tree-tab.component';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { MilestoneTreeNode } from '../../models/milestone.model';

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
        { provide: ActivatedRoute, useValue: routeStub }
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
      createSubModule: vi.fn().mockResolvedValue({ success: true })
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
});
