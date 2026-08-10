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

  function setup(milestone: Milestone): void {
    TestBed.configureTestingModule({ imports: [MilestoneCardComponent] });
    fixture = TestBed.createComponent(MilestoneCardComponent);
    fixture.componentRef.setInput('milestone', milestone);
    fixture.detectChanges();
  }

  it('shows View but not Edit/Achieve when the caller is not the owner', () => {
    setup(baseMilestone);
    expect(fixture.nativeElement.querySelector('[data-testid="view-button"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="edit-button"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="achieve-button"]')).toBeNull();
  });

  it('shows Edit and Achieve when the caller is the owner', () => {
    setup({ ...baseMilestone, isOwner: true });
    expect(fixture.nativeElement.querySelector('[data-testid="edit-button"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="achieve-button"]')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Achieve');
  });

  it('shows Unachieve instead of Achieve when already achieved', () => {
    setup({ ...baseMilestone, isOwner: true, isAchieved: true });
    expect(fixture.nativeElement.textContent).toContain('Unachieve');
  });

  it('emits viewed/editRequested/achieveToggled on button press', () => {
    setup({ ...baseMilestone, isOwner: true });
    let viewed = false, edited = false, achieved = false;
    fixture.componentInstance.viewed.subscribe(() => (viewed = true));
    fixture.componentInstance.editRequested.subscribe(() => (edited = true));
    fixture.componentInstance.achieveToggled.subscribe(() => (achieved = true));

    (fixture.nativeElement.querySelector('[data-testid="view-button"] button') as HTMLButtonElement).click();
    (fixture.nativeElement.querySelector('[data-testid="edit-button"] button') as HTMLButtonElement).click();
    (fixture.nativeElement.querySelector('[data-testid="achieve-button"] button') as HTMLButtonElement).click();

    expect(viewed).toBe(true);
    expect(edited).toBe(true);
    expect(achieved).toBe(true);
  });
});
