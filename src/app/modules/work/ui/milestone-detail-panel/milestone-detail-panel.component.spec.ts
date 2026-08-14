import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MilestoneDetailPanelComponent } from './milestone-detail-panel.component';
import { MilestoneTreeNode } from '../../models/milestone.model';
import { ProgressRingComponent } from '../../../../shared/ui/progress-ring/progress-ring.component';

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

  it('shows Edit, Achieve, and Create sub Module actions when isOwner is true', () => {
    setup({ detail });
    expect(fixture.nativeElement.querySelector('[data-testid="edit-button"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="achieve-button"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="create-sub-button"]')).not.toBeNull();
  });

  it('hides Edit, Achieve, and Create sub Module actions when isOwner is false', () => {
    setup({ detail: { ...detail, isOwner: false } });
    expect(fixture.nativeElement.querySelector('[data-testid="edit-button"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="achieve-button"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="create-sub-button"]')).toBeNull();
  });

  it('emits editRequested, achieveToggleRequested, and createSubRequested on their respective clicks', () => {
    setup({ detail });
    let edited = false;
    let achieveToggled = false;
    let createdSub = false;
    fixture.componentInstance.editRequested.subscribe(() => (edited = true));
    fixture.componentInstance.achieveToggleRequested.subscribe(() => (achieveToggled = true));
    fixture.componentInstance.createSubRequested.subscribe(() => (createdSub = true));

    (fixture.nativeElement.querySelector('[data-testid="edit-button"] button') as HTMLElement).click();
    (fixture.nativeElement.querySelector('[data-testid="achieve-button"] button') as HTMLElement).click();
    (fixture.nativeElement.querySelector('[data-testid="create-sub-button"] button') as HTMLElement).click();

    expect(edited).toBe(true);
    expect(achieveToggled).toBe(true);
    expect(createdSub).toBe(true);
  });

  it('emits membersRequested when the member button is clicked', () => {
    setup({ detail });
    const spy = vi.fn();
    fixture.componentInstance.membersRequested.subscribe(spy);

    (fixture.nativeElement.querySelector('[data-testid="member-button"]') as HTMLButtonElement).click();

    expect(spy).toHaveBeenCalled();
  });

  it('labels the achieve button "Achieve" when not achieved, "Unachieve" when achieved', () => {
    setup({ detail: { ...detail, isAchieved: false } });
    expect(fixture.nativeElement.querySelector('[data-testid="achieve-button"]').textContent).toContain('Achieve');

    setup({ detail: { ...detail, isAchieved: true } });
    expect(fixture.nativeElement.querySelector('[data-testid="achieve-button"]').textContent).toContain('Unachieve');
  });

  it('renders a progress chart reflecting the progress value', () => {
    setup({ detail: { ...detail, progress: 40 } });
    const chart = fixture.nativeElement.querySelector('[data-testid="progress-chart"]');
    expect(chart).not.toBeNull();
    expect(chart.textContent).toContain('40%');
  });

  it('uses a 96px gradient progress ring', () => {
    setup({ detail });
    const ring = fixture.debugElement.query(By.directive(ProgressRingComponent));
    expect(ring).not.toBeNull();
    const instance = ring.componentInstance as ProgressRingComponent;
    expect(instance.size()).toBe(96);
    expect(instance.gradient()).toBe(true);
  });

  it('shows a days-left deadline under the End date when not achieved and not overdue', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-25T00:00:00Z'));
    try {
      setup({ detail: { ...detail, isAchieved: false, endDate: '2026-02-01' } });
      const deadline = fixture.nativeElement.querySelector('[data-testid="deadline"]');
      expect(deadline).not.toBeNull();
      expect(deadline.textContent).toContain('7 days left');
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows an overdue deadline in the danger color when the end date has passed', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-10T00:00:00Z'));
    try {
      setup({ detail: { ...detail, isAchieved: false, endDate: '2026-02-01' } });
      const deadline = fixture.nativeElement.querySelector('[data-testid="deadline"]') as HTMLElement;
      expect(deadline).not.toBeNull();
      expect(deadline.textContent).toContain('9 days overdue');
      expect(deadline.className).toContain('color-danger-text');
    } finally {
      vi.useRealTimers();
    }
  });

  it('hides the deadline entirely when the milestone is achieved', () => {
    setup({ detail: { ...detail, isAchieved: true } });
    expect(fixture.nativeElement.querySelector('[data-testid="deadline"]')).toBeNull();
  });

  it('keeps the action button row on a single line with compact buttons', () => {
    setup({ detail });
    const row = fixture.nativeElement.querySelector('[data-testid="action-row"]') as HTMLElement;
    expect(row).not.toBeNull();
    expect(row.className).toContain('flex-nowrap');
    expect(row.className).not.toContain('flex-wrap');

    const editButton = fixture.nativeElement.querySelector('[data-testid="edit-button"] button') as HTMLElement;
    expect(editButton.className).toContain('text-xs');
  });
});
