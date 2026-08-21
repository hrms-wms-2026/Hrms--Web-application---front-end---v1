import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { TaskTreeRowComponent } from './task-tree-row.component';
import { MilestoneTreeNode } from '../../models/milestone.model';
import { PeopleApiService } from '../../../people/data-access/people-api.service';

describe('TaskTreeRowComponent', () => {
  let fixture: ComponentFixture<TaskTreeRowComponent>;

  const task: MilestoneTreeNode = {
    id: 't1', title: 'Do it', description: null, startDate: '2026-08-01', endDate: '2026-08-14',
    progress: 0, allocatedHours: 3, completedHours: 0, isActive: true, isAchieved: false,
    ownerName: null, isOwner: false, children: [], kind: 'task', status: 'To Do',
    taskSource: {
      id: 't1', objectiveId: 'o1', shortId: 'WEB-9', title: 'Do it', description: null,
      taskType: 'task', statusId: 'st-1', priority: 'medium', storyPoints: null,
      dueDate: null, estimatedHours: 3, completedHours: 0, progressPercent: 0,
      sprintId: 'spr-1', assigneeEmployeeIds: ['e1']
    }
  };

  function setup(node: MilestoneTreeNode): void {
    TestBed.configureTestingModule({
      imports: [TaskTreeRowComponent],
      providers: [
        { provide: PeopleApiService, useValue: { getEmployee: vi.fn().mockReturnValue(of({ id: 'e1', fullName: 'Ada Lovelace' })) } }
      ]
    });
    fixture = TestBed.createComponent(TaskTreeRowComponent);
    fixture.componentRef.setInput('node', node);
    fixture.detectChanges();
  }

  it('shows edit even when the caller is not the owner, and hides delete', () => {
    setup(task);
    expect(fixture.nativeElement.querySelector('[data-testid="edit-button"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="delete-task-button"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="status-badge"]')?.textContent).toContain('To Do');
    expect(fixture.nativeElement.querySelector('[data-testid="assignee-cell"]')).not.toBeNull();
  });

  it('shows delete only when the caller owns the parent module', () => {
    setup({ ...task, isOwner: true });
    expect(fixture.nativeElement.querySelector('[data-testid="delete-task-button"]')).not.toBeNull();
  });

  it('emits deleteRequested with the node and does not make an HTTP call', () => {
    setup({ ...task, isOwner: true });
    const deleted: MilestoneTreeNode[] = [];
    fixture.componentInstance.deleteRequested.subscribe((n) => deleted.push(n));

    (fixture.nativeElement.querySelector('[data-testid="delete-task-button"]') as HTMLElement).click();

    expect(deleted[0].id).toBe('t1');
  });
});
