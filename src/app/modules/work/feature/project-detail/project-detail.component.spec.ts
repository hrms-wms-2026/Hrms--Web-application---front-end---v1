import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { ProjectDetailComponent } from './project-detail.component';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { ProjectDetail } from '../../models/project.model';
import { Milestone } from '../../models/milestone.model';

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

  beforeEach(async () => {
    storeStub = {
      project: () => project,
      projectLoading: () => false,
      projectError: () => null,
      milestones: () => [milestone],
      milestonesLoading: () => false,
      milestonesError: () => null,
      selectedSubtree: () => null,
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

  it('renders project name and milestone cards', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Website Revamp');
    expect(fixture.nativeElement.textContent).toContain('Default');
  });

  it('opens the settings modal and patches in the full detail once fetched', async () => {
    const detail = { id: 'o1', title: 'Default', description: 'Full scope', startDate: '2026-08-01', endDate: '2026-12-01', allocatedHours: 40, isAchieved: false, isDefault: true };
    storeStub.getMilestoneDetail = vi.fn().mockResolvedValue(detail);
    fixture.detectChanges();

    fixture.componentInstance.onMilestoneSettingsRequested(milestone);

    expect(fixture.componentInstance.milestoneSettingsOpen()).toBe(true);
    expect(storeStub.getMilestoneDetail).toHaveBeenCalledWith('o1');

    await Promise.resolve();
    await Promise.resolve();

    expect((fixture.componentInstance.milestoneSettingsInitialValue() as any)?.description).toBe('Full scope');
  });

  it('saves fields only when the Achieved toggle is untouched', async () => {
    fixture.detectChanges();
    fixture.componentInstance.onMilestoneSettingsRequested(milestone);

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
    fixture.componentInstance.onMilestoneSettingsRequested(milestone);

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
    fixture.componentInstance.onMilestoneSettingsRequested(milestone);

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
    fixture.componentInstance.onMilestoneSettingsRequested(milestone);

    await fixture.componentInstance.onMilestoneSettingsSaved({
      fields: { title: 'Default', description: '', startDate: '2026-08-01', endDate: '2026-12-01', allocatedHours: 40 },
      achievedChanged: true, achieved: false
    });

    expect(editSpy).not.toHaveBeenCalled();
    expect(fixture.componentInstance.milestoneSettingsOpen()).toBe(true);
  });

  it('loads the milestone subtree and marks the card selected when a milestone is clicked', async () => {
    fixture.detectChanges();
    fixture.componentInstance.onMilestoneSelected(milestone);
    expect(storeStub.loadMilestoneSubtree).toHaveBeenCalledWith('o1');
    expect(fixture.componentInstance.selectedMilestoneId()).toBe('o1');
  });

  it('renders the tree once selectedSubtree resolves', async () => {
    storeStub.selectedSubtree = () => ({ id: 'o1', title: 'Default', startDate: '2026-08-01', endDate: '2026-12-01', progress: 0, allocatedHours: 40, completedHours: 0, isActive: true, children: [] });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-milestone-tree-node')).not.toBeNull();
  });

  it('shows a prompt when no milestone is selected yet', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Select a milestone');
  });

  it('resets stale subtree state on init', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    expect(storeStub.clearSelectedSubtree).toHaveBeenCalled();
  });

  it('auto-selects the first milestone once milestones load', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    await Promise.resolve();
    await Promise.resolve();

    expect(fixture.componentInstance.selectedMilestoneId()).toBe('o1');
    expect(storeStub.loadMilestoneSubtree).toHaveBeenCalledWith('o1');
  });

  it('does not attempt to select anything when there are no milestones', async () => {
    storeStub.milestones = () => [];
    fixture.detectChanges();
    await fixture.whenStable();
    await Promise.resolve();
    await Promise.resolve();

    expect(fixture.componentInstance.selectedMilestoneId()).toBeNull();
    expect(storeStub.loadMilestoneSubtree).not.toHaveBeenCalled();
  });
});
