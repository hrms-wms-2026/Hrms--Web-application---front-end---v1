import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { of, Subject } from 'rxjs';
import { ProjectDetailComponent } from './project-detail.component';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { ProjectDetail } from '../../models/project.model';
import { Milestone } from '../../models/milestone.model';
import { WorkApprovalsStore } from '../../state/work-approvals.store';

describe('ProjectDetailComponent', () => {
  let fixture: ComponentFixture<ProjectDetailComponent>;
  let storeStub: any;
  let routerStub: any;
  let routeStub: any;
  let routerEvents: Subject<unknown>;
  let approvalsStoreStub: any;

  const project: ProjectDetail = {
    id: 'p1', name: 'Website Revamp', identifier: 'WEB', categoryId: 'cat1', leadId: 'u1',
    startDate: '2026-08-01', targetDate: '2026-12-01', color: null, isActive: true,
    allocatedHours: 40, completedHours: 0, isLead: true, isAchieved: false, achievedAt: null,
    description: 'Rebuild the site', actualHours: 0, createdAt: '2026-08-01T00:00:00Z', updatedAt: null,
    logoFileId: null, labels: [], members: [], memberCount: 0
  };

  const milestone: Milestone = {
    objectiveId: 'o1', projectId: 'p1', parentObjectiveId: null, isDefault: true, title: 'Default',
    ownerId: 'u1', ownerName: 'Jane Doe', reportingManagerId: null, reportingManagerName: null,
    startDate: '2026-08-01', endDate: '2026-12-01', allocatedHours: 40, completedHours: 0,
    objectiveIsActive: true, isAchieved: false, achievedAt: null, membershipIsActive: true, membershipRemovedAt: null,
    isOwner: true, isEffectiveOwner: true
  };

  const milestone2: Milestone = { ...milestone, objectiveId: 'o2', title: 'Second', isDefault: false };

  function setup(firstChildMilestoneId: string | null): void {
    routerEvents = new Subject();
    routerStub = { navigate: vi.fn(), events: routerEvents.asObservable() };
    routeStub = {
      paramMap: of({ get: (key: string) => (key === 'id' ? 'p1' : null) }),
      snapshot: {
        firstChild: firstChildMilestoneId
          ? { paramMap: { get: (key: string) => (key === 'milestoneId' ? firstChildMilestoneId : null) } }
          : null
      }
    };

    TestBed.configureTestingModule({
      imports: [ProjectDetailComponent],
      providers: [
        { provide: ProjectDetailStore, useValue: storeStub },
        { provide: WorkApprovalsStore, useValue: approvalsStoreStub },
        { provide: ActivatedRoute, useValue: routeStub },
        { provide: Router, useValue: routerStub }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectDetailComponent);
  }

  beforeEach(() => {
    approvalsStoreStub = {
      taskCreationRequests: () => [],
      taskEditRequests: () => [],
      allocationRequests: () => [],
      objectiveChangeRequests: () => [],
      objectiveInvitations: () => [],
      loadAll: vi.fn().mockResolvedValue(undefined)
    };
    storeStub = {
      project: () => project,
      projectLoading: () => false,
      projectError: () => null,
      milestones: () => [milestone, milestone2],
      milestonesLoading: () => false,
      milestonesError: () => null,
      loadProject: vi.fn().mockResolvedValue(undefined),
      loadMyMilestones: vi.fn().mockResolvedValue(undefined),
      getMilestoneDetail: vi.fn().mockResolvedValue(null),
      editMilestone: vi.fn().mockResolvedValue({ success: true, pending: false }),
      achieveMilestone: vi.fn().mockResolvedValue({ success: true, pending: false }),
      unachieveMilestone: vi.fn().mockResolvedValue({ success: true, pending: false }),
      milestoneActionError: () => null
    };
  });

  it('loads the project and its milestones for the routed id', async () => {
    setup(null);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(storeStub.loadProject).toHaveBeenCalledWith('p1');
    expect(storeStub.loadMyMilestones).toHaveBeenCalledWith('p1');
    expect(approvalsStoreStub.loadAll).toHaveBeenCalledTimes(1);
  });

  it('renders the project name without the Modules carousel', async () => {
    setup('o1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Website Revamp');
    expect(fixture.nativeElement.textContent).not.toContain('Modules');
    expect(fixture.nativeElement.querySelector('app-milestone-card')).toBeNull();
  });

  it("navigates to the first milestone's tree route when landing with no milestone in the URL", async () => {
    setup(null);
    fixture.detectChanges();
    await fixture.whenStable();
    await Promise.resolve();
    await Promise.resolve();
    expect(routerStub.navigate).toHaveBeenCalledWith(
      ['milestones', 'o1', 'tree'],
      expect.objectContaining({ replaceUrl: true })
    );
  });

  it('does not override an already-deep-linked milestone', async () => {
    setup('o2');
    fixture.detectChanges();
    await fixture.whenStable();
    await Promise.resolve();
    await Promise.resolve();
    expect(routerStub.navigate).not.toHaveBeenCalled();
  });

  it('does not attempt to navigate when there are no milestones', async () => {
    storeStub.milestones = () => [];
    setup(null);
    fixture.detectChanges();
    await fixture.whenStable();
    await Promise.resolve();
    await Promise.resolve();
    expect(routerStub.navigate).not.toHaveBeenCalled();
  });

  it('renders the sub-menu and outlet once a milestone is active', () => {
    setup('o1');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-milestone-sub-menu')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('router-outlet')).not.toBeNull();
  });

  it('shows the Approvals indicator only for received requests in the current project', () => {
    approvalsStoreStub.allocationRequests = () => [
      { id: 'in-project', objectiveId: 'o1' },
      { id: 'other-project', objectiveId: 'other-objective' }
    ];
    setup('o1');
    fixture.detectChanges();

    const indicator = fixture.nativeElement.querySelector('[data-testid="approvals-pending-indicator"]');
    const approvalsLink = Array.from(fixture.nativeElement.querySelectorAll('[data-testid="sub-menu-tab"]'))
      .find((element: any) => element.textContent.includes('Approvals')) as HTMLAnchorElement;
    expect(indicator).not.toBeNull();
    expect(approvalsLink.getAttribute('aria-label')).toBe('Approvals, 1 pending');
  });

  it('reflects the active milestone id from the route on init, and updates it on NavigationEnd', () => {
    setup('o1');
    fixture.detectChanges();
    expect(fixture.componentInstance.activeMilestoneId()).toBe('o1');

    routeStub.snapshot.firstChild = { paramMap: { get: (key: string) => (key === 'milestoneId' ? 'o2' : null) } };
    routerEvents.next(new NavigationEnd(1, '/work/p1/milestones/o2/tree', '/work/p1/milestones/o2/tree'));

    expect(fixture.componentInstance.activeMilestoneId()).toBe('o2');
  });

  it('does not render the sub-menu when there is no active milestone', () => {
    storeStub.milestones = () => [];
    setup(null);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-milestone-sub-menu')).toBeNull();
  });

  it('shows "Loading modules…" while milestones are loading', () => {
    storeStub.milestonesLoading = () => true;
    setup(null);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Loading modules…');
  });

  it('shows "No modules yet" when there are no milestones', () => {
    storeStub.milestones = () => [];
    storeStub.milestonesLoading = () => false;
    setup(null);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No modules yet');
  });
});
