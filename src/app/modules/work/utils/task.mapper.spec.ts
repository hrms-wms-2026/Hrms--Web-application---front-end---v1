import { toEditTaskRequest, toWorkTask } from './task.mapper';
import { WorkTaskDto } from '../models/dto/task.dto';
import { WorkTask } from '../models/task.model';
import { environment } from '../../../../environments/environment';

const baseDto: WorkTaskDto = {
  id: 't1', objectiveId: 'o1', shortId: 'T-1', title: 'Task', description: null,
  categoryId: 'c1', statusId: 's1', priority: 'medium', storyPoints: null, dueDate: null,
  estimatedHours: null, completedHours: 0, progressPercent: 30, sprintId: null,
  assigneeEmployeeIds: [], openClockSessionEmployeeId: null, openClockSessionClockInAt: null,
  totalLoggedMinutes: 0, createdAt: '2026-08-26T10:30:00Z'
};

describe('toWorkTask', () => {
  it('maps openClockSessionEmployeeId through unchanged', () => {
    const dto: WorkTaskDto = { ...baseDto, openClockSessionEmployeeId: 'e7' };
    expect(toWorkTask(dto).openClockSessionEmployeeId).toBe('e7');
  });

  it('maps a null openClockSessionEmployeeId as null, not undefined', () => {
    const dto: WorkTaskDto = { ...baseDto, openClockSessionEmployeeId: null };
    expect(toWorkTask(dto).openClockSessionEmployeeId).toBeNull();
  });

  it('maps openClockSessionClockInAt to a Date', () => {
    const dto: WorkTaskDto = { ...baseDto, openClockSessionClockInAt: '2026-08-26T10:30:00Z' };
    const mapped = toWorkTask(dto).openClockSessionClockInAt;
    expect(mapped).toBeInstanceOf(Date);
    expect(mapped?.toISOString()).toBe('2026-08-26T10:30:00.000Z');
  });

  it('maps a null openClockSessionClockInAt as null, not undefined', () => {
    const dto: WorkTaskDto = { ...baseDto, openClockSessionClockInAt: null };
    expect(toWorkTask(dto).openClockSessionClockInAt).toBeNull();
  });

  it('maps totalLoggedMinutes through unchanged', () => {
    const dto: WorkTaskDto = { ...baseDto, totalLoggedMinutes: 145 };
    expect(toWorkTask(dto).totalLoggedMinutes).toBe(145);
  });

  it('maps attachments through, defaulting to an empty array when absent', () => {
    expect(toWorkTask(baseDto).attachments).toEqual([]);

    const withAttachments: WorkTaskDto = {
      ...baseDto,
      attachments: [{ fileId: 'f1', fileName: 'a.pdf', fileSizeBytes: 100, contentType: 'application/pdf' }]
    };
    expect(toWorkTask(withAttachments).attachments).toEqual([{ fileId: 'f1', name: 'a.pdf', sizeBytes: 100 }]);
  });

  it('maps assignees through, defaulting to an empty array when absent', () => {
    expect(toWorkTask(baseDto).assignees).toEqual([]);

    const withAssignees: WorkTaskDto = {
      ...baseDto,
      assignees: [{ employeeId: 'e1', name: 'Nevi Peiris', avatarUrl: 'https://files.example.test/nevi' }]
    };
    expect(toWorkTask(withAssignees).assignees).toEqual([
      { employeeId: 'e1', name: 'Nevi Peiris', avatarUrl: 'https://files.example.test/nevi' }
    ]);
  });

  it('maps avatarFileId to the canonical authenticated file URL', () => {
    const withAssignees: WorkTaskDto = {
      ...baseDto,
      assignees: [{ employeeId: 'e1', name: 'Nevi Peiris', avatarFileId: 'avatar-file-1' }]
    };

    expect(toWorkTask(withAssignees).assignees).toEqual([
      {
        employeeId: 'e1',
        name: 'Nevi Peiris',
        avatarUrl: `${environment.apiUrl}/files/avatar-file-1`
      }
    ]);
  });

  it('maps subtask fields through, defaulting counts to 0 and parentTaskId to null when absent', () => {
    const task = toWorkTask(baseDto);
    expect(task.parentTaskId).toBeNull();
    expect(task.subtaskTotalCount).toBe(0);
    expect(task.subtaskCompletedCount).toBe(0);

    const withSubtasks: WorkTaskDto = {
      ...baseDto,
      parentTaskId: 'p-1',
      subtaskTotalCount: 5,
      subtaskCompletedCount: 2
    };
    const mapped = toWorkTask(withSubtasks);
    expect(mapped.parentTaskId).toBe('p-1');
    expect(mapped.subtaskTotalCount).toBe(5);
    expect(mapped.subtaskCompletedCount).toBe(2);
  });

  it('maps createdAt to a Date', () => {
    const mapped = toWorkTask(baseDto).createdAt;
    expect(mapped).toBeInstanceOf(Date);
    expect(mapped.toISOString()).toBe('2026-08-26T10:30:00.000Z');
  });
});

describe('toEditTaskRequest', () => {
  const baseTask: WorkTask = {
    id: 't1', objectiveId: 'o1', shortId: 'T-1', title: 'Task', description: 'Desc',
    categoryId: 'c1', statusId: 's1', priority: 'high', storyPoints: 3,
    dueDate: new Date('2026-09-01T00:00:00.000Z'), estimatedHours: 5, completedHours: 0,
    progressPercent: 40, sprintId: 'sp-1', assigneeEmployeeIds: [], openClockSessionEmployeeId: null,
    openClockSessionClockInAt: null, totalLoggedMinutes: 0,
    attachments: [{ fileId: 'f1', name: 'a.pdf', sizeBytes: 100 }], assignees: [],
    parentTaskId: null, subtaskTotalCount: 0, subtaskCompletedCount: 0, subtaskAssigneeEmployeeIds: [],
    createdAt: new Date('2026-01-01T00:00:00Z')
  };

  it('reproduces every current field so nothing is silently cleared', () => {
    expect(toEditTaskRequest(baseTask)).toEqual({
      title: 'Task', description: 'Desc', priority: 'high', dueDate: '2026-09-01',
      estimatedHours: 5, storyPoints: 3, progressPercent: 40, sprintId: 'sp-1',
      attachmentFileIds: ['f1']
    });
  });

  it('applies an override without disturbing other fields', () => {
    const result = toEditTaskRequest(baseTask, { sprintId: 'sp-2' });
    expect(result.sprintId).toBe('sp-2');
    expect(result.title).toBe('Task');
    expect(result.attachmentFileIds).toEqual(['f1']);
  });

  it('omits description/dueDate/estimatedHours/storyPoints when null, instead of sending null', () => {
    const bare: WorkTask = { ...baseTask, description: null, dueDate: null, estimatedHours: null, storyPoints: null };
    const result = toEditTaskRequest(bare);
    expect(result.description).toBeUndefined();
    expect(result.dueDate).toBeUndefined();
    expect(result.estimatedHours).toBeUndefined();
    expect(result.storyPoints).toBeUndefined();
  });

  it('preserves an empty attachment list as an empty array, not omitted', () => {
    const noAttachments: WorkTask = { ...baseTask, attachments: [] };
    expect(toEditTaskRequest(noAttachments).attachmentFileIds).toEqual([]);
  });
});
