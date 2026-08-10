import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { ProjectDetailComponent } from './project-detail.component';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { ProjectDetail } from '../../models/project.model';
import { Milestone, MilestoneTreeNode, ObjectiveDetail } from '../../models/milestone.model';

describe('ProjectDetailComponent', () => {
  let fixture: ComponentFixture<ProjectDetailComponent>;
  let storeStub: any;

  const project: ProjectDetail = {
    id: 'p1', name: 'Website Revamp', identifier: 'WEB', categoryId: 'cat1', leadId: 'u1',
    startDate: '2026-08-01', targetDate: '2026-12-01', color: null, isActive: true,
    allocatedHours: 40, completedHours: 0, isLead: true, isAchieved: false, achievedAt: null,
    description: 'Rebuild the site', actualHours: 0, createdAt: '2026-08-01T00:00:00Z', updatedAt: null
  };

  const milestone: Milestone = {
    objectiveId: 'o1', projectId: 'p1', parentObjectiveId: null, isDefault: true, title: 'Default',
    ownerId: 'u1', ownerName: 'Jane Doe', reportingManagerId: null, reportingManagerName: null,
    startDate: '2026-08-01', endDate: '2026-12-01', allocatedHours: 40, completedHours: 0,
    objectiveIsActive: true, isAchieved: false, achievedAt: null, membershipIsActive: true, membershipRemovedAt: null,
    isOwner: true
  };

  const treeNode: MilestoneTreeNode = {
    id: 'o1', title: 'Default', startDate: '2026-08-01', endDate: '2026-12-01',
    progress: 0, allocatedHours: 40, completedHours: 0, isActive: true, children: []
  };

  const detail: ObjectiveDetail = {
    id: 'o1', projectId: 'p1', parentObjectiveId: null, isDefault: true, title: 'Default',
    description: null, ownerId: 'u1', ownerName: 'Jane Doe', reportingManagerId: null, reportingManagerName: null,
    createdById: 'u1', startDate: '2026-08-01', endDate: '2026-12-01', progress: 0, actualHours: null,
    allocatedHours: 40, completedHours: 0, isActive: true, isAchieved: false, achievedAt: null,
    createdAt: '2026-08-01T00:00:00Z', updatedAt: null, isOwner: true
  };

  beforeEach(async () => {
    storeStub = {
      project: () => project,
      projectLoading: () => false,
      projectError: () => null,
      milestones: () => [milestone],
      milestonesLoading: () => false,
      milestonesError: () => null,
      selectedSubtree: () => treeNode,
      selectedSubtreeParent: () => null,
      selectedMilestoneDetail: () => detail,
      subtreeLoading: () => false,
      subtreeError: () => null,
      loadProject: vi.fn().mockResolvedValue(undefined),
      loadMyMilestones: vi.fn().mockResolvedValue(undefined),
      loadMilestoneSubtree: vi.fn().mockResolvedValue(undefined),
      clearSelectedSubtree: vi.fn(),
      getMilestoneDetail: vi.fn().mockResolvedValue(null),
      editMilestone: vi.fn().mockResolvedValue({ success: true, pending: false }),
      achieveMilestone: vi.fn().mockResolvedValue({ success: true, pending: false }),
      unachieveMilestone: vi.fn().mockResolvedValue({ success: true, pending: false }),
      milestoneActionError: () => null
    };

    await TestBed.configureTestingModule({
      imports: [ProjectDetailComponent],
      providers: [
        { provide: ProjectDetailStore, useValue: storeStub },
        { provide: ActivatedRoute, useValue: { paramMap: of({ get: (key: string) => (key === 'id' ? 'p1' : null) }) } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectDetailComponent);
  });

  it('loads the project and its milestones for the routed id', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    expect(storeStub.loadProject).toHaveBeenCalledWith('p1');
    expect(storeStub.loadMyMilestones).toHaveBeenCalledWith('p1');
  });

  it('renders the compact project header, without a milestone card row', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Website Revamp');
    expect(fixture.nativeElement.querySelector('app-milestone-card')).toBeNull();
  });

  it('auto-selects the first milestone once milestones load, via the subtree API', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    await Promise.resolve();
    await Promise.resolve();

    expect(storeStub.loadMilestoneSubtree).toHaveBeenCalledWith('o1');
  });

  it('does not attempt to select anything when there are no milestones', async () => {
    storeStub.milestones = () => [];
    fixture.detectChanges();
    await fixture.whenStable();
    await Promise.resolve();
    await Promise.resolve();

    expect(storeStub.loadMilestoneSubtree).not.toHaveBeenCalled();
  });

  it('re-centers the tree when a tree node is selected', () => {
    fixture.detectChanges();
    fixture.componentInstance.onTreeNodeSelected('o2');
    expect(storeStub.loadMilestoneSubtree).toHaveBeenCalledWith('o2');
  });

  it('renders the milestone tree once selectedSubtree resolves', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-milestone-tree')).not.toBeNull();
  });

  it('renders the detail panel with the focused milestone', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-milestone-detail-panel')).not.toBeNull();
  });

  it('resets stale subtree state on init', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    expect(storeStub.clearSelectedSubtree).toHaveBeenCalled();
  });

  it('opens the settings modal and fetches the full detail for the currently focused milestone', async () => {
    storeStub.getMilestoneDetail = vi.fn().mockResolvedValue({ ...detail, description: 'Full scope' });
    fixture.detectChanges();

    fixture.componentInstance.onMilestoneSettingsRequested();

    expect(fixture.componentInstance.milestoneSettingsOpen()).toBe(true);
    expect(storeStub.getMilestoneDetail).toHaveBeenCalledWith('o1');

    await Promise.resolve();
    await Promise.resolve();

    expect((fixture.componentInstance.milestoneSettingsInitialValue() as any)?.description).toBe('Full scope');
  });

  it('does nothing when settings are requested with no focused milestone', () => {
    storeStub.selectedMilestoneDetail = () => null;
    fixture.detectChanges();

    fixture.componentInstance.onMilestoneSettingsRequested();

    expect(fixture.componentInstance.milestoneSettingsOpen()).toBe(false);
  });

  it('saves fields only when the Achieved toggle is untouched', async () => {
    fixture.detectChanges();
    fixture.componentInstance.onMilestoneSettingsRequested();

    await fixture.componentInstance.onMilestoneSettingsSaved({
      fields: { title: 'Default v2', description: 'Full scope', startDate: '2026-08-01', endDate: '2026-12-01', allocatedHours: 40 },
      achievedChanged: false, achieved: false
    });

    expect(storeStub.editMilestone).toHaveBeenCalledWith('o1', {
      title: 'Default v2', description: 'Full scope', startDate: '2026-08-01', endDate: '2026-12-01', allocatedHours: 40
    });
    expect(storeStub.achieveMilestone).not.toHaveBeenCalled();
    expect(storeStub.unachieveMilestone).not.toHaveBeenCalled();
    expect(fixture.componentInstance.milestoneSettingsOpen()).toBe(false);
  });

  it('edits then achieves, in that order, when the toggle is turned on', async () => {
    const calls: string[] = [];
    storeStub.editMilestone = vi.fn().mockImplementation(async () => { calls.push('edit'); return { success: true, pending: false }; });
    storeStub.achieveMilestone = vi.fn().mockImplementation(async () => { calls.push('achieve'); return { success: true, pending: false }; });
    fixture.detectChanges();
    fixture.componentInstance.onMilestoneSettingsRequested();

    await fixture.componentInstance.onMilestoneSettingsSaved({
      fields: { title: 'Default', description: '', startDate: '2026-08-01', endDate: '2026-12-01', allocatedHours: 40 },
      achievedChanged: true, achieved: true
    });

    expect(calls).toEqual(['edit', 'achieve']);
  });

  it('unachieves then edits, in that order, when the toggle is turned off', async () => {
    const calls: string[] = [];
    storeStub.unachieveMilestone = vi.fn().mockImplementation(async () => { calls.push('unachieve'); return { success: true, pending: false }; });
    storeStub.editMilestone = vi.fn().mockImplementation(async () => { calls.push('edit'); return { success: true, pending: false }; });
    fixture.detectChanges();
    fixture.componentInstance.onMilestoneSettingsRequested();

    await fixture.componentInstance.onMilestoneSettingsSaved({
      fields: { title: 'Default', description: '', startDate: '2026-08-01', endDate: '2026-12-01', allocatedHours: 40 },
      achievedChanged: true, achieved: false
    });

    expect(calls).toEqual(['unachieve', 'edit']);
  });

  it('stops the sequence and keeps the modal open if the first step fails', async () => {
    storeStub.unachieveMilestone = vi.fn().mockResolvedValue({ success: false, pending: false });
    const editSpy = vi.fn();
    storeStub.editMilestone = editSpy;
    fixture.detectChanges();
    fixture.componentInstance.onMilestoneSettingsRequested();

    await fixture.componentInstance.onMilestoneSettingsSaved({
      fields: { title: 'Default', description: '', startDate: '2026-08-01', endDate: '2026-12-01', allocatedHours: 40 },
      achievedChanged: true, achieved: false
    });

    expect(editSpy).not.toHaveBeenCalled();
    expect(fixture.componentInstance.milestoneSettingsOpen()).toBe(true);
  });

  it('reloads the current subtree after a successful save', async () => {
    fixture.detectChanges();
    fixture.componentInstance.onMilestoneSettingsRequested();
    storeStub.loadMilestoneSubtree.mockClear();

    await fixture.componentInstance.onMilestoneSettingsSaved({
      fields: { title: 'Default', description: '', startDate: '2026-08-01', endDate: '2026-12-01', allocatedHours: 40 },
      achievedChanged: false, achieved: false
    });

    expect(storeStub.loadMilestoneSubtree).toHaveBeenCalledWith('o1');
  });
});
