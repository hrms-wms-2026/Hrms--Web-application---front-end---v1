import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MilestoneDetailPanelComponent } from './milestone-detail-panel.component';
import { MilestoneTreeNode } from '../../models/milestone.model';

describe('MilestoneDetailPanelComponent', () => {
  let fixture: ComponentFixture<MilestoneDetailPanelComponent>;

  const detail: MilestoneTreeNode = {
    id: 'o2', title: 'Child', description: 'Child scope', startDate: '2026-01-20', endDate: '2026-02-01',
    progress: 40, allocatedHours: 5, completedHours: 2, isActive: true, isAchieved: true,
    ownerName: 'Arun Kumar', isOwner: true, children: []
  };

  function setup(overrides: Partial<{ detail: MilestoneTreeNode | null; loading: boolean; error: string | null }> = {}): void {
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

  it('renders full detail: title, description, dates, progress, hours, owner avatar, Achieved badge', () => {
    setup({ detail });
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Child');
    expect(text).toContain('Child scope');
    expect(text).toContain('2026-01-20');
    expect(text).toContain('2026-02-01');
    expect(text).toContain('40%');
    expect(text).toContain('2 / 5');
    expect(text).toContain('Achieved');
    expect(fixture.nativeElement.querySelector('app-avatar')).not.toBeNull();
  });

  it('omits the Achieved badge when the milestone is not achieved', () => {
    setup({ detail: { ...detail, isAchieved: false } });
    expect(fixture.nativeElement.textContent).not.toContain('Achieved');
  });

  it('never renders a View details button', () => {
    setup({ detail });
    expect(fixture.nativeElement.textContent).not.toContain('View details');
  });

  it('shows Edit and Create sub Module actions when isOwner is true', () => {
    setup({ detail });
    expect(fixture.nativeElement.querySelector('[data-testid="edit-button"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="create-sub-button"]')).not.toBeNull();
  });

  it('hides Edit and Create sub Module actions when isOwner is false', () => {
    setup({ detail: { ...detail, isOwner: false } });
    expect(fixture.nativeElement.querySelector('[data-testid="edit-button"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="create-sub-button"]')).toBeNull();
  });

  it('emits editRequested and createSubRequested on their respective clicks', () => {
    setup({ detail });
    let edited = false;
    let createdSub = false;
    fixture.componentInstance.editRequested.subscribe(() => (edited = true));
    fixture.componentInstance.createSubRequested.subscribe(() => (createdSub = true));

    (fixture.nativeElement.querySelector('[data-testid="edit-button"] button') as HTMLElement).click();
    (fixture.nativeElement.querySelector('[data-testid="create-sub-button"] button') as HTMLElement).click();

    expect(edited).toBe(true);
    expect(createdSub).toBe(true);
  });
});
