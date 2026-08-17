import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { TaskDetailModalComponent } from './task-detail-modal.component';
import { WorkTask } from '../../models/task.model';

describe('TaskDetailModalComponent', () => {
  let fixture: ComponentFixture<TaskDetailModalComponent>;
  const task: WorkTask = {
    id: 't1', objectiveId: 'o1', shortId: 'EPOS-1', title: 'Do the thing', description: 'Details here',
    taskType: 'task', statusId: 's1', priority: 'high', storyPoints: 3, dueDate: new Date('2026-09-20'),
    estimatedHours: 8, completedHours: 0, progressPercent: 0, sprintId: null
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TaskDetailModalComponent] }).compileComponents();
    fixture = TestBed.createComponent(TaskDetailModalComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('task', task);
    fixture.detectChanges();
  });

  it('shows the task shortId, title, description, and priority', () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('EPOS-1');
    expect(text).toContain('Do the thing');
    expect(text).toContain('Details here');
    expect(text).toContain('high');
  });

  it('emits closed when the modal closes', () => {
    const spy = vi.fn();
    fixture.componentInstance.closed.subscribe(spy);
    fixture.componentInstance.onClose();
    expect(spy).toHaveBeenCalled();
  });
});
