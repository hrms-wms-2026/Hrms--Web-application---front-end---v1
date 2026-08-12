import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { ProjectDetailComponent } from './project-detail.component';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { ProjectDetail } from '../../models/project.model';
import { MilestoneTreeNode } from '../../models/milestone.model';

describe('ProjectDetailComponent', () => {
  let fixture: ComponentFixture<ProjectDetailComponent>;
  let storeStub: any;
  let routeStub: any;

  const project: ProjectDetail = {
    id: 'p1', name: 'Website Revamp', identifier: 'WEB', categoryId: 'cat1', leadId: 'u1',
    startDate: '2026-08-01', targetDate: '2026-12-01', color: null, isActive: true,
    allocatedHours: 40, completedHours: 0, isLead: true, isAchieved: false, achievedAt: null,
    description: 'Rebuild the site', actualHours: 0, createdAt: '2026-08-01T00:00:00Z', updatedAt: null
  };

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

  function setup(): void {
    routeStub = { paramMap: of({ get: (key: string) => (key === 'id' ? 'p1' : null) }) };

    TestBed.configureTestingModule({
      imports: [ProjectDetailComponent],
      providers: [
        { provide: ProjectDetailStore, useValue: storeStub },
        { provide: ActivatedRoute, useValue: routeStub }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectDetailComponent);
  }

  beforeEach(() => {
    storeStub = {
      project: () => project,
      projectLoading: () => false,
      projectError: () => null,
      selectedSubtree: () => tree,
      subtreeLoading: () => false,
      subtreeError: () => null,
      milestoneActionError: () => null,
      loadProject: vi.fn().mockResolvedValue(undefined),
      loadProjectTree: vi.fn().mockResolvedValue(undefined),
      getMilestoneDetail: vi.fn().mockResolvedValue(null),
      editMilestone: vi.fn().mockResolvedValue({ success: true, pending: false }),
      achieveMilestone: vi.fn().mockResolvedValue({ success: true, pending: false }),
      unachieveMilestone: vi.fn().mockResolvedValue({ success: true, pending: false }),
      createSubModule: vi.fn().mockResolvedValue({ success: true })
    };
  });

  it('loads the project and the unified tree on init', async () => {
    setup();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(storeStub.loadProject).toHaveBeenCalledWith('p1');
    expect(storeStub.loadProjectTree).toHaveBeenCalledWith('p1');
  });

  it('renders the root tree node', async () => {
    setup();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Root');
  });

  it('selecting a node shows its detail via findTreeNode, with no extra store call', async () => {
    setup();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('[data-testid="tree-row"]');
    (rows[1] as HTMLElement).click();
    fixture.detectChanges();

    expect(fixture.componentInstance.selectedNode()?.id).toBe('o2');
    expect(storeStub.getMilestoneDetail).not.toHaveBeenCalled();
  });

  it('clicking create-sub-module on a node opens the create modal with that node as parent', async () => {
    setup();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const createButtons = fixture.nativeElement.querySelectorAll('[data-testid="create-sub-button"]');
    (createButtons[0] as HTMLElement).click();
    fixture.detectChanges();

    expect(fixture.componentInstance.createModalOpen()).toBe(true);
    expect(fixture.componentInstance.createModalParentId()).toBe('o1');
  });

  it('reloads the tree and closes the modal after a successful create', async () => {
    setup();
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.createModalParentId.set('o1');
    fixture.componentInstance.createModalOpen.set(true);
    await fixture.componentInstance.onCreateModalCreated({
      parentObjectiveId: 'o1', title: 'Design Phase', description: null,
      startDate: '2026-01-15', endDate: '2026-03-01', allocatedHours: 20
    });

    expect(storeStub.createSubModule).toHaveBeenCalled();
    expect(fixture.componentInstance.createModalOpen()).toBe(false);
    expect(storeStub.loadProjectTree).toHaveBeenCalledTimes(2);
  });

  it('opens the settings modal and fetches full detail when Edit is requested', async () => {
    const detail = { id: 'o1', title: 'Root', description: 'Full scope', startDate: '2026-01-01', endDate: '2026-12-01', allocatedHours: 40, isAchieved: false, isDefault: true };
    storeStub.getMilestoneDetail = vi.fn().mockResolvedValue(detail);
    setup();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('[data-testid="tree-row"]');
    (rows[0] as HTMLElement).click();
    fixture.detectChanges();
    await fixture.componentInstance.onEditRequested();

    expect(fixture.componentInstance.milestoneSettingsOpen()).toBe(true);
    expect(storeStub.getMilestoneDetail).toHaveBeenCalledWith('o1');
    expect((fixture.componentInstance.milestoneSettingsInitialValue() as any)?.description).toBe('Full scope');
  });

  it('edits then achieves, in that order, when the toggle is turned on', async () => {
    const calls: string[] = [];
    storeStub.editMilestone = vi.fn().mockImplementation(async () => { calls.push('edit'); return { success: true, pending: false }; });
    storeStub.achieveMilestone = vi.fn().mockImplementation(async () => { calls.push('achieve'); return { success: true, pending: false }; });
    setup();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="tree-row"]');
    (rows[0] as HTMLElement).click();
    fixture.detectChanges();

    await fixture.componentInstance.onMilestoneSettingsSaved({
      fields: { title: 'Root', description: '', startDate: '2026-01-01', endDate: '2026-12-01', allocatedHours: 40 },
      achievedChanged: true, achieved: true
    });

    expect(calls).toEqual(['edit', 'achieve']);
  });
});
