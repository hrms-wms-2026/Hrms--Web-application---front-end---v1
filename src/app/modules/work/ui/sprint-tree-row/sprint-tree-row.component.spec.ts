import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SprintTreeRowComponent } from './sprint-tree-row.component';
import { MilestoneTreeNode } from '../../models/milestone.model';

describe('SprintTreeRowComponent', () => {
  let fixture: ComponentFixture<SprintTreeRowComponent>;

  const sprint: MilestoneTreeNode = {
    id: 'spr-1', title: 'Sprint 1', description: null, startDate: '2026-08-01', endDate: '2026-08-14',
    progress: 40, allocatedHours: 10, completedHours: 4, isActive: true, isAchieved: false,
    ownerName: null, isOwner: true, children: [], kind: 'sprint', status: 'active'
  };

  function setup(node: MilestoneTreeNode): void {
    fixture = TestBed.createComponent(SprintTreeRowComponent);
    fixture.componentRef.setInput('node', node);
    fixture.detectChanges();
  }

  it('renders the sprint icon, status badge, and completion bar', () => {
    setup(sprint);
    expect(fixture.nativeElement.querySelector('[data-testid="sprint-icon"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="status-badge"]')?.textContent).toContain('active');
    expect(fixture.nativeElement.querySelector('[data-testid="progress-fill"]').style.width).toBe('40%');
  });

  it('shows all four icons when the caller owns the parent module', () => {
    setup(sprint);
    expect(fixture.nativeElement.querySelector('[data-testid="create-task-button"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="edit-button"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="achieve-sprint-button"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="complete-sprint-button"]')).not.toBeNull();
  });

  it('hides every action icon when the caller is not the owner', () => {
    setup({ ...sprint, isOwner: false });
    expect(fixture.nativeElement.querySelector('[data-testid="row-actions"]')?.querySelectorAll('button').length).toBe(0);
  });
});
