import { toWorkTask } from './task.mapper';
import { WorkTaskDto } from '../models/dto/task.dto';

const baseDto: WorkTaskDto = {
  id: 't1', objectiveId: 'o1', shortId: 'T-1', title: 'Task', description: null,
  categoryId: 'c1', statusId: 's1', priority: 'medium', storyPoints: null, dueDate: null,
  estimatedHours: null, completedHours: 0, progressPercent: 30, sprintId: null,
  assigneeEmployeeIds: [], openClockSessionEmployeeId: null, openClockSessionClockInAt: null,
  totalLoggedMinutes: 0
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
});
