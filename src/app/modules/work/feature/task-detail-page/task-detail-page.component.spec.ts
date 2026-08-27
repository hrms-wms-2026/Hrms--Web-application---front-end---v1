import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { TaskDetailPageComponent } from './task-detail-page.component';
import { TaskApiService } from '../../data-access/task-api.service';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { CurrentEmployeeStore } from '../../state/current-employee.store';

const taskDto = {
  id: 't1', objectiveId: 'o1', shortId: 'P-1', title: 'First', description: 'desc',
  categoryId: 'c1', statusId: 's1', priority: 'high' as const, storyPoints: 2, dueDate: '2026-09-01',
  estimatedHours: 4, completedHours: 0, progressPercent: 0, sprintId: null, assigneeEmployeeIds: ['e1'],
  openClockSessionEmployeeId: null, openClockSessionClockInAt: null, totalLoggedMinutes: 0
};

describe('TaskDetailPageComponent', () => {
  let fixture: ComponentFixture<TaskDetailPageComponent>;
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let milestones: ReturnType<typeof signal<{ objectiveId: string; isOwner: boolean }[]>>;

  beforeEach(async () => {
    api = {
      getTaskById: vi.fn().mockReturnValue(of(taskDto)),
      getStatuses: vi.fn().mockReturnValue(of([
        { id: 's1', name: 'To Do', displayOrder: 0, requiresApproval: false, approverId: null, marksTaskComplete: false, visibility: 'public' },
        { id: 's2', name: 'Doing', displayOrder: 1, requiresApproval: false, approverId: null, marksTaskComplete: false, visibility: 'public' }
      ])),
      getCategories: vi.fn().mockReturnValue(of([{ id: 'c1', name: 'Feature', displayOrder: 0 }])),
      getTaskHistory: vi.fn().mockReturnValue(of([])),
      editTask: vi.fn().mockReturnValue(of(taskDto)),
      createTaskEditRequest: vi.fn().mockReturnValue(of({})),
      moveTaskStatus: vi.fn().mockReturnValue(of(undefined))
    };
    milestones = signal<{ objectiveId: string; isOwner: boolean }[]>([{ objectiveId: 'o1', isOwner: true }]);

    await TestBed.configureTestingModule({
      imports: [TaskDetailPageComponent],
      providers: [
        { provide: TaskApiService, useValue: api },
        { provide: ProjectDetailStore, useValue: { milestones } },
        { provide: CurrentEmployeeStore, useValue: { id: signal('e1'), ensureLoaded: vi.fn() } },
        { provide: ActivatedRoute, useValue: {
          snapshot: { paramMap: { get: (k: string) => (k === 'taskId' ? 't1' : null) } },
          parent: { snapshot: { paramMap: { get: () => 'p1' } } }
        } }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(TaskDetailPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();
  });

  it('loads the task by its route id and seeds the form', () => {
    expect(api['getTaskById']).toHaveBeenCalledWith('t1');
    expect(fixture.componentInstance.title()).toBe('First');
    expect(fixture.componentInstance.statusId()).toBe('s1');
  });

  it('does not persist anything until Save Changes is pressed', () => {
    fixture.componentInstance.title.set('Edited');
    fixture.componentInstance.statusId.set('s2');
    expect(api['editTask']).not.toHaveBeenCalled();
    expect(api['moveTaskStatus']).not.toHaveBeenCalled();
    expect(api['createTaskEditRequest']).not.toHaveBeenCalled();
  });

  it('on Save Changes: moves status if changed, then edits the task (owner path)', async () => {
    fixture.componentInstance.title.set('Edited');
    fixture.componentInstance.statusId.set('s2');
    await fixture.componentInstance.submit();
    expect(api['moveTaskStatus']).toHaveBeenCalledWith('t1', 's2');
    expect(api['editTask']).toHaveBeenCalledWith('t1', expect.objectContaining({ title: 'Edited' }));
  });

  it('does not move status on Save when it is unchanged', async () => {
    fixture.componentInstance.title.set('Edited');
    await fixture.componentInstance.submit();
    expect(api['moveTaskStatus']).not.toHaveBeenCalled();
    expect(api['editTask']).toHaveBeenCalled();
  });

  it('non-owner Save Changes routes through createTaskEditRequest', async () => {
    milestones.set([{ objectiveId: 'o1', isOwner: false }]);
    fixture.detectChanges();
    fixture.componentInstance.title.set('Edited');
    await fixture.componentInstance.submit();
    expect(api['createTaskEditRequest']).toHaveBeenCalledWith('t1', expect.objectContaining({ title: 'Edited' }));
    expect(api['editTask']).not.toHaveBeenCalled();
  });

  it('blocks Save when the title is emptied', async () => {
    fixture.componentInstance.title.set('   ');
    await fixture.componentInstance.submit();
    expect(api['editTask']).not.toHaveBeenCalled();
    expect(fixture.componentInstance.errors()['title']).toBeTruthy();
  });
});
