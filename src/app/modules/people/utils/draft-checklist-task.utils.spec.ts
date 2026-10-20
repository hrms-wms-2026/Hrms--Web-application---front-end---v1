import { describe, expect, it } from 'vitest';
import {
  createDraftTasksFromTemplate,
  parseEditedTasksJsonToDraftTasks,
  serializeDraftTasksToEditedTasksJson,
  validateDraftTasks
} from './draft-checklist-task.utils';
import { ChecklistTemplateTaskResponse } from '../models/checklist-template.model';

function task(partial: Partial<ChecklistTemplateTaskResponse> & Pick<ChecklistTemplateTaskResponse, 'title' | 'ownerType'>): ChecklistTemplateTaskResponse {
  return {
    assignedToId: null,
    assigneePositionId: null,
    dueOffsetDays: 0,
    sequence: 1,
    isRequired: true,
    isBypassable: false,
    bypassPenaltyDescription: null,
    category: null,
    ...partial
  };
}

describe('draft-checklist-task.utils', () => {
  it('copies template tasks without sharing object identity', () => {
    const source = [task({ title: 'Sign paperwork', ownerType: 'employee', sequence: 1 })];
    const draft = createDraftTasksFromTemplate(source);
    draft[0] = { ...draft[0], title: 'Changed' };
    expect(source[0].title).toBe('Sign paperwork');
  });

  it('serializes employee tasks without assignedToId', () => {
    const draft = createDraftTasksFromTemplate([task({ title: 'Sign paperwork', ownerType: 'employee' })]);
    const payload = JSON.parse(serializeDraftTasksToEditedTasksJson(draft, '2026-08-10'));
    expect(payload).toEqual([
      { title: 'Sign paperwork', dueDate: '2026-08-10', sequence: 1, isRequired: true, ownerType: 'employee' }
    ]);
    expect(payload[0].assignedToId).toBeUndefined();
  });

  it('serializes another-person tasks with the selected user id', () => {
    const draft = createDraftTasksFromTemplate([
      task({ title: 'IT setup', ownerType: 'custom_user', assigneePositionId: 'pos-hr', assignedToId: null, sequence: 1 })
    ]);
    const withPerson = [{ ...draft[0], selectedAssigneeUserId: 'user-aaa' }];
    const payload = JSON.parse(serializeDraftTasksToEditedTasksJson(withPerson, '2026-08-10'));
    expect(payload[0].assignedToId).toBe('user-aaa');
    expect(payload[0].assigneePositionId).toBe('pos-hr');
    expect(payload[0].ownerType).toBe('custom_user');
  });

  it('blocks save validation until another-person tasks have a position and person', () => {
    const draft = createDraftTasksFromTemplate([
      task({ title: 'IT setup', ownerType: 'it', assigneePositionId: null, assignedToId: null })
    ]);
    expect(validateDraftTasks(draft).join(' ')).toContain('Select a position');
    const withPosition = [{ ...draft[0], assigneePositionId: 'pos-hr' }];
    expect(validateDraftTasks(withPosition).join(' ')).toContain('Select who should complete this task');
  });

  it('carries template task description, priority and attachments through EditedTasksJson', () => {
    const draft = createDraftTasksFromTemplate([
      task({
        title: 'Read handbook',
        ownerType: 'employee',
        description: '<p>Chapter 2</p>',
        priority: 'high',
        attachments: [{ fileId: 'file-1', fileName: 'handbook.pdf', fileSizeBytes: 100, contentType: 'application/pdf' }]
      })
    ]);

    const json = serializeDraftTasksToEditedTasksJson(draft, '2026-11-02');
    expect(JSON.parse(json)[0]).toMatchObject({
      description: '<p>Chapter 2</p>',
      priority: 'high',
      attachmentFileIds: ['file-1']
    });

    const resumed = parseEditedTasksJsonToDraftTasks(json, '2026-11-02');
    expect(resumed?.[0].details).toEqual({ description: '<p>Chapter 2</p>', priority: 'high', attachmentFileIds: ['file-1'] });
  });

  it('omits detail keys for template tasks without details', () => {
    const json = serializeDraftTasksToEditedTasksJson(
      createDraftTasksFromTemplate([task({ title: 'Sign NDA', ownerType: 'employee' })]),
      '2026-11-02'
    );
    expect(JSON.parse(json)[0]).not.toHaveProperty('description');
  });
});
