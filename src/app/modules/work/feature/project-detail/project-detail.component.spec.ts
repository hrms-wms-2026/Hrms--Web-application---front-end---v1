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
    isOwner: false
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
      clearSelectedSubtree: vi.fn()
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

  it('renders project name and milestone rows', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Website Revamp');
    expect(fixture.nativeElement.textContent).toContain('Default');
  });

  it('loads a milestone subtree on click', () => {
    fixture.detectChanges();
    fixture.componentInstance.onMilestoneClicked(milestone);
    expect(storeStub.loadMilestoneSubtree).toHaveBeenCalledWith('o1');
  });

  it('renders the milestone tree when a subtree is selected', async () => {
    storeStub.selectedSubtree = () => ({ id: 'o1', title: 'Default', startDate: '2026-08-01', endDate: '2026-12-01', progress: 0, allocatedHours: 40, completedHours: 0, isActive: true, children: [] });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-milestone-tree-node')).not.toBeNull();
  });

  it('shows a muted tag for a milestone the caller is no longer a member of', async () => {
    storeStub.milestones = () => [{ ...milestone, membershipIsActive: false }];
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('no longer a member');
  });
});
