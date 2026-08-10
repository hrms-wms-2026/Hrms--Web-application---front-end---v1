import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MilestoneCardComponent } from './milestone-card.component';
import { Milestone } from '../../models/milestone.model';

describe('MilestoneCardComponent', () => {
  let fixture: ComponentFixture<MilestoneCardComponent>;

  const baseMilestone: Milestone = {
    objectiveId: 'o1', projectId: 'p1', parentObjectiveId: null, isDefault: false, title: 'Design Phase',
    ownerId: 'u1', ownerName: 'Jane Doe', reportingManagerId: null, reportingManagerName: null,
    startDate: '2026-01-01', endDate: '2026-03-01', allocatedHours: 20, completedHours: 5,
    objectiveIsActive: true, isAchieved: false, achievedAt: null,
    membershipIsActive: true, membershipRemovedAt: null, isOwner: false
  };

  function setup(milestone: Milestone, selected = false): void {
    TestBed.configureTestingModule({ imports: [MilestoneCardComponent] });
    fixture = TestBed.createComponent(MilestoneCardComponent);
    fixture.componentRef.setInput('milestone', milestone);
    fixture.componentRef.setInput('selected', selected);
    fixture.detectChanges();
  }

  it('has no View button', () => {
    setup(baseMilestone);
    expect(fixture.nativeElement.querySelector('[data-testid="view-button"]')).toBeNull();
  });

  it('does not render Start/End date rows', () => {
    setup(baseMilestone);
    expect(fixture.nativeElement.textContent).not.toContain('2026-01-01');
  });

  it('emits viewed when the card itself is clicked', () => {
    setup(baseMilestone);
    let viewed = false;
    fixture.componentInstance.viewed.subscribe(() => (viewed = true));
    (fixture.nativeElement.querySelector('[data-testid="milestone-card"]') as HTMLElement).click();
    expect(viewed).toBe(true);
  });

  it('shows the Settings button when the caller is the owner, and clicking it does not also emit viewed', () => {
    setup({ ...baseMilestone, isOwner: true });
    let viewed = false, settings = false;
    fixture.componentInstance.viewed.subscribe(() => (viewed = true));
    fixture.componentInstance.settingsRequested.subscribe(() => (settings = true));

    (fixture.nativeElement.querySelector('[data-testid="settings-button"] button') as HTMLButtonElement).click();

    expect(settings).toBe(true);
    expect(viewed).toBe(false);
  });

  it('hides the Settings button when the caller is not the owner', () => {
    setup(baseMilestone);
    expect(fixture.nativeElement.querySelector('[data-testid="settings-button"]')).toBeNull();
  });

  it('applies a highlight class when selected', () => {
    setup(baseMilestone, true);
    const card: HTMLElement = fixture.nativeElement.querySelector('[data-testid="milestone-card"]');
    expect(card.className).toContain('ring-2');
  });

  it('fills the height of its container (host + section both claim h-full)', () => {
    setup(baseMilestone);
    const hostElement: HTMLElement = fixture.nativeElement;
    expect(hostElement.className).toContain('h-full');
    const section = fixture.nativeElement.querySelector('app-card section');
    expect(section?.className).toContain('h-full');
  });
});
