import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MilestoneDetailPanelComponent } from './milestone-detail-panel.component';
import { ObjectiveDetail } from '../../models/milestone.model';

describe('MilestoneDetailPanelComponent', () => {
  let fixture: ComponentFixture<MilestoneDetailPanelComponent>;

  const detail: ObjectiveDetail = {
    id: 'o1', projectId: 'p1', parentObjectiveId: null, isDefault: false, title: 'Design Phase',
    description: 'Scope the design work', ownerId: 'u1', ownerName: 'Jane Doe',
    reportingManagerId: 'u2', reportingManagerName: 'John Smith', createdById: 'u1',
    startDate: '2026-01-01', endDate: '2026-03-01', progress: 40, actualHours: null,
    allocatedHours: 20, completedHours: 8, isActive: true, isAchieved: false,
    achievedAt: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: null, isOwner: true
  };

  function setup(value: ObjectiveDetail | null): void {
    fixture = TestBed.createComponent(MilestoneDetailPanelComponent);
    fixture.componentRef.setInput('milestone', value);
    fixture.detectChanges();
  }

  it('shows a placeholder when nothing is selected', () => {
    setup(null);
    expect(fixture.nativeElement.textContent).toContain('Select a milestone');
  });

  it('renders the milestone fields', () => {
    setup(detail);
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Design Phase');
    expect(text).toContain('Jane Doe');
    expect(text).toContain('John Smith');
    expect(text).toContain('8 / 20h');
    expect(text).toContain('40%');
    expect(text).toContain('Not achieved');
  });

  it('shows the gear button only when isOwner is true', () => {
    setup(detail);
    expect(fixture.nativeElement.querySelector('[data-testid="settings-button"]')).not.toBeNull();
  });

  it('hides the gear button when isOwner is false', () => {
    setup({ ...detail, isOwner: false });
    expect(fixture.nativeElement.querySelector('[data-testid="settings-button"]')).toBeNull();
  });

  it('emits settingsRequested when the gear is clicked', () => {
    setup(detail);
    let emitted = false;
    fixture.componentInstance.settingsRequested.subscribe(() => (emitted = true));
    (fixture.nativeElement.querySelector('[data-testid="settings-button"]') as HTMLButtonElement).click();
    expect(emitted).toBe(true);
  });
});
