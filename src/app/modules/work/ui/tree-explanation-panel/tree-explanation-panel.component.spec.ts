import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { TreeExplanationPanelComponent } from './tree-explanation-panel.component';
import { MilestoneTreeNode } from '../../models/milestone.model';
import { PeopleApiService } from '../../../people/data-access/people-api.service';

describe('TreeExplanationPanelComponent', () => {
  let fixture: ComponentFixture<TreeExplanationPanelComponent>;

  const objective: MilestoneTreeNode = {
    id: 'o1', title: 'Design', description: 'Scope the work', startDate: '2026-01-01', endDate: '2026-03-01',
    progress: 50, allocatedHours: 20, completedHours: 10, isActive: true, isAchieved: false,
    ownerName: 'Arun', isOwner: true, children: [], kind: 'objective'
  };

  const sprint: MilestoneTreeNode = {
    ...objective, id: 'spr-1', title: 'Sprint 1', description: null, kind: 'sprint', status: 'active', children: []
  };

  const task: MilestoneTreeNode = {
    ...objective, id: 't1', title: 'Do it', description: 'Details', kind: 'task', status: 'To Do', isOwner: false,
    children: [],
    taskSource: {
      id: 't1', objectiveId: 'o1', shortId: 'WEB-9', title: 'Do it', description: 'Details',
      categoryId: 'task', statusId: 'st-1', priority: 'medium', storyPoints: null,
      dueDate: null, estimatedHours: 3, completedHours: 0, progressPercent: 0,
      sprintId: 'spr-1', assigneeEmployeeIds: ['e1'], openClockSessionEmployeeId: null, openClockSessionClockInAt: null, totalLoggedMinutes: 0,
      attachments: [], assignees: [],
      parentTaskId: null, subtaskTotalCount: 0, subtaskCompletedCount: 0, subtaskAssigneeEmployeeIds: [],
      createdAt: new Date('2026-01-01T00:00:00Z'), hasPendingApproval: false
    }
  };

  function setup(node: MilestoneTreeNode): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [TreeExplanationPanelComponent],
      providers: [
        { provide: PeopleApiService, useValue: { getEmployeeIdentity: vi.fn().mockReturnValue(of({ id: 'e1', name: 'Ada Lovelace', avatarFileId: null })) } }
      ]
    });
    fixture = TestBed.createComponent(TreeExplanationPanelComponent);
    fixture.componentRef.setInput('node', node);
    fixture.detectChanges();
  }

  it('explains each monitor alert on the node inside the card', () => {
    setup(objective);
    expect(fixture.nativeElement.querySelector('[data-testid="panel-alerts"]')).toBeNull();

    fixture.componentRef.setInput('alerts', [{
      id: 'a1', targetType: 'module', targetId: 'o1', targetTitle: 'Design', ruleCode: 'module_overload',
      subjectEmployeeId: null, message: 'Allocated 200h exceeds capacity of 24h.', firstDetectedAt: '2026-09-29T00:00:00Z'
    }]);
    fixture.detectChanges();

    const messages = fixture.nativeElement.querySelectorAll('[data-testid="panel-alert-message"]');
    expect(messages.length).toBe(1);
    expect(messages[0].textContent).toContain('Allocated 200h exceeds capacity of 24h.');
    expect(fixture.nativeElement.querySelector('[data-testid="panel-alerts-muted"]')).toBeNull();
  });

  it('fades an achieved module\'s alerts and says no action is needed', () => {
    setup({ ...objective, isAchieved: true });
    fixture.componentRef.setInput('alerts', [{
      id: 'a1', targetType: 'module', targetId: 'o1', targetTitle: 'Design', ruleCode: 'module_over_capacity',
      subjectEmployeeId: null, message: 'Over capacity.', firstDetectedAt: '2026-09-29T00:00:00Z', inAchievedModule: true
    }]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="panel-alerts"]').classList).toContain('opacity-50');
    expect(fixture.nativeElement.querySelector('[data-testid="panel-alerts-muted"]')).not.toBeNull();
  });

  it('renders objective fields and hides actions when the caller is not the owner', () => {
    setup({ ...objective, isOwner: false });
    expect(fixture.nativeElement.textContent).toContain('Design');
    expect(fixture.nativeElement.textContent).toContain('Scope the work');
    expect(fixture.nativeElement.textContent).toContain('Arun');
    expect(fixture.nativeElement.querySelector('[data-testid="panel-edit"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="panel-create-sub"]')).toBeNull();
  });

  it('shows the six module actions for an owned leaf', () => {
    setup(objective);
    expect(fixture.nativeElement.querySelector('[data-testid="panel-create-sub"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="panel-edit"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="panel-members"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="panel-create-task"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="panel-create-sprint"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="panel-achieve"]')).not.toBeNull();
  });

  it('renders sprint status and owner-gated sprint actions', () => {
    setup(sprint);
    expect(fixture.nativeElement.querySelector('[data-testid="panel-status"]')?.textContent).toContain('active');
    expect(fixture.nativeElement.querySelector('[data-testid="panel-achieve-sprint"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="panel-complete-sprint"]')).not.toBeNull();
    setup({ ...sprint, isOwner: false });
    expect(fixture.nativeElement.querySelector('[data-testid="panel-achieve-sprint"]')).toBeNull();
  });

  it('renders task assignee and keeps edit ungated while delete is owner-gated', () => {
    setup(task);
    expect(fixture.nativeElement.querySelector('[data-testid="panel-edit"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="panel-delete"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="panel-assignee"]')).not.toBeNull();
    setup({ ...task, isOwner: true });
    expect(fixture.nativeElement.querySelector('[data-testid="panel-delete"]')).not.toBeNull();
  });
  it('shows "Delete sprint" only for complete or achieved sprints and emits deleteSprintRequested', () => {
    setup(sprint);
    expect(fixture.nativeElement.querySelector('[data-testid="panel-delete-sprint"]')).toBeNull();

    setup({ ...sprint, status: 'complete' });
    const emitted: MilestoneTreeNode[] = [];
    fixture.componentInstance.deleteSprintRequested.subscribe((n) => emitted.push(n));
    (fixture.nativeElement.querySelector('[data-testid="panel-delete-sprint"]') as HTMLButtonElement).click();
    expect(emitted.map((n) => n.id)).toEqual(['spr-1']);

    setup({ ...sprint, status: 'achieved' });
    expect(fixture.nativeElement.querySelector('[data-testid="panel-delete-sprint"]')).not.toBeNull();
  });
});
