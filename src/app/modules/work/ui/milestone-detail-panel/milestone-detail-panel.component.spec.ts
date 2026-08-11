import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MilestoneDetailPanelComponent } from './milestone-detail-panel.component';
import { ObjectiveDetail } from '../../models/milestone.model';

describe('MilestoneDetailPanelComponent', () => {
  let fixture: ComponentFixture<MilestoneDetailPanelComponent>;

  const detail: ObjectiveDetail = {
    id: 'o2', projectId: 'p1', parentObjectiveId: 'o1', isDefault: false, title: 'Child',
    description: 'Child scope', ownerId: 'u1', reportingManagerId: null, createdById: 'u1',
    startDate: '2026-01-20', endDate: '2026-02-01', progress: 40, actualHours: null,
    allocatedHours: 5, completedHours: 2, isActive: true, isAchieved: true,
    createdAt: '2026-01-01T00:00:00Z', updatedAt: null
  };

  function setup(overrides: Partial<{ detail: ObjectiveDetail | null; loading: boolean; error: string | null }> = {}): void {
    fixture = TestBed.createComponent(MilestoneDetailPanelComponent);
    fixture.componentRef.setInput('detail', overrides.detail ?? null);
    fixture.componentRef.setInput('loading', overrides.loading ?? false);
    fixture.componentRef.setInput('error', overrides.error ?? null);
    fixture.detectChanges();
  }

  it('shows the loading state', () => {
    setup({ loading: true });
    expect(fixture.nativeElement.querySelector('app-loader')).not.toBeNull();
  });

  it('shows the error state and emits retry on click', () => {
    setup({ error: 'Failed to load' });
    let retried = false;
    fixture.componentInstance.retry.subscribe(() => (retried = true));

    (fixture.nativeElement.querySelector('app-error-state button') as HTMLButtonElement).click();

    expect(retried).toBe(true);
  });

  it('shows a select-a-milestone prompt when nothing is selected', () => {
    setup();
    expect(fixture.nativeElement.textContent).toContain('Select a milestone');
  });

  it('renders full detail: title, description, dates, progress, hours, Achieved badge', () => {
    setup({ detail });
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Child');
    expect(text).toContain('Child scope');
    expect(text).toContain('2026-01-20');
    expect(text).toContain('2026-02-01');
    expect(text).toContain('40%');
    expect(text).toContain('2 / 5');
    expect(text).toContain('Achieved');
  });

  it('omits the Achieved badge when the milestone is not achieved', () => {
    setup({ detail: { ...detail, isAchieved: false } });
    expect(fixture.nativeElement.textContent).not.toContain('Achieved');
  });

  it('does not render Owner or Reporting Manager fields (not available from the API)', () => {
    setup({ detail });
    expect(fixture.nativeElement.textContent).not.toContain('Owner');
    expect(fixture.nativeElement.textContent).not.toContain('Reporting Manager');
  });
});
