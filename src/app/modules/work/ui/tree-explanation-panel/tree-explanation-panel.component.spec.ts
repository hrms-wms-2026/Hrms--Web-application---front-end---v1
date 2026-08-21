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
      taskType: 'task', statusId: 'st-1', priority: 'medium', storyPoints: null,
      dueDate: null, estimatedHours: 3, completedHours: 0, progressPercent: 0,
      sprintId: 'spr-1', assigneeEmployeeIds: ['e1']
    }
  };

  function setup(node: MilestoneTreeNode): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [TreeExplanationPanelComponent],
      providers: [
        { provide: PeopleApiService, useValue: { getEmployee: vi.fn().mockReturnValue(of({ id: 'e1', fullName: 'Ada Lovelace' })) } }
      ]
    });
    fixture = TestBed.createComponent(TreeExplanationPanelComponent);
    fixture.componentRef.setInput('node', node);
    fixture.detectChanges();
  }

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
});
