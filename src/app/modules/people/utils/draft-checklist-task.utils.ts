import { ChecklistTemplateTaskResponse, DraftChecklistTask } from '../models/checklist-template.model';

interface IsoDateParts {
  readonly y: number;
  readonly m: number;
  readonly d: number;
}

function parseIsoDateParts(iso: string): IsoDateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) {
    return null;
  }
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

/** Adds `days` to an ISO (YYYY-MM-DD) date using UTC arithmetic so the result never shifts a
 *  calendar day for users west of UTC (which local-Date arithmetic would do). */
export function addDaysToIsoDate(startDateIso: string, days: number): string {
  const parts = parseIsoDateParts(startDateIso);
  if (!parts) {
    return startDateIso;
  }
  const ms = Date.UTC(parts.y, parts.m - 1, parts.d) + days * 86_400_000;
  const dt = new Date(ms);
  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Inverse of addDaysToIsoDate - clamped to 0 so a draft whose start date moved later than a
 *  previously-saved task's due date never hydrates a negative/invalid offset. */
export function diffDaysBetweenIsoDates(startDateIso: string, targetDateIso: string): number {
  const startParts = parseIsoDateParts(startDateIso);
  const targetParts = parseIsoDateParts(targetDateIso);
  if (!startParts || !targetParts) {
    return 0;
  }
  const startMs = Date.UTC(startParts.y, startParts.m - 1, startParts.d);
  const targetMs = Date.UTC(targetParts.y, targetParts.m - 1, targetParts.d);
  const diff = Math.round((targetMs - startMs) / 86_400_000);
  return diff > 0 ? diff : 0;
}

export function createEmptyDraftTask(): DraftChecklistTask {
  return {
    clientId: crypto.randomUUID(),
    title: '',
    assignee: 'employee',
    preservedOwnerType: null,
    preservedAssignedToId: null,
    dueDays: 0,
    isRequired: true
  };
}

function draftTaskFromTemplateTask(task: ChecklistTemplateTaskResponse): DraftChecklistTask {
  const isEmployee = task.ownerType === 'employee';
  return {
    clientId: crypto.randomUUID(),
    title: task.title,
    assignee: isEmployee ? 'employee' : 'another',
    preservedOwnerType: isEmployee ? null : task.ownerType,
    preservedAssignedToId: isEmployee ? null : task.assignedToId,
    dueDays: task.dueOffsetDays,
    isRequired: task.isRequired
  };
}

/** Deep, independent copy - the returned tasks share no object references with the source
 *  template tasks (or its cache entry), so editing them can never mutate the loaded template. */
export function createDraftTasksFromTemplate(tasks: readonly ChecklistTemplateTaskResponse[]): DraftChecklistTask[] {
  return [...tasks].sort((a, b) => a.sequence - b.sequence).map(draftTaskFromTemplateTask);
}

/**
 * Serializes draft-local tasks into the backend's EditedTasksJson contract
 * (ChecklistTaskJsonContract.Parse, ChecklistTaskDueRuleMode.AbsoluteDate):
 * an array of { title, ownerType, assignedToId?, dueDate, sequence, isRequired }.
 * dueDate is computed from each task's dueDays offset against the wizard's own start date -
 * the wizard UI collects a relative "due after N days" value, but the draft's edited-task JSON
 * mode requires a concrete date once HR has reviewed it against a real start date.
 */
export function serializeDraftTasksToEditedTasksJson(tasks: readonly DraftChecklistTask[], startDateIso: string): string {
  const payload = tasks.map((task, index) => {
    const base = {
      title: task.title.trim(),
      dueDate: addDaysToIsoDate(startDateIso, task.dueDays),
      sequence: index + 1,
      isRequired: task.isRequired
    };
    if (task.assignee === 'employee') {
      return { ...base, ownerType: 'employee' };
    }
    return {
      ...base,
      ownerType: task.preservedOwnerType ?? 'custom_user',
      assignedToId: task.preservedAssignedToId
    };
  });
  return JSON.stringify(payload);
}

/** Inverse of serializeDraftTasksToEditedTasksJson. Returns null on any malformed input so the
 *  caller can fall back to seeding from the template detail instead of crashing on a resume. */
export function parseEditedTasksJsonToDraftTasks(json: string, startDateIso: string): DraftChecklistTask[] | null {
  try {
    const raw: unknown = JSON.parse(json);
    if (!Array.isArray(raw)) {
      return null;
    }
    return raw.map((item: Record<string, unknown>) => {
      const ownerType = typeof item['ownerType'] === 'string' ? (item['ownerType'] as string) : 'employee';
      const isEmployee = ownerType === 'employee';
      const dueDate = typeof item['dueDate'] === 'string' ? (item['dueDate'] as string) : startDateIso;
      const assignedToId = typeof item['assignedToId'] === 'string' ? (item['assignedToId'] as string) : null;
      return {
        clientId: crypto.randomUUID(),
        title: typeof item['title'] === 'string' ? (item['title'] as string) : '',
        assignee: isEmployee ? 'employee' : 'another',
        preservedOwnerType: isEmployee ? null : ownerType,
        preservedAssignedToId: isEmployee ? null : assignedToId,
        dueDays: diffDaysBetweenIsoDates(startDateIso, dueDate),
        isRequired: item['isRequired'] === true
      };
    });
  } catch {
    return null;
  }
}

/** Friendly, UI-facing validation messages - never references raw backend field names. */
export function validateDraftTasks(tasks: readonly DraftChecklistTask[]): string[] {
  const errors: string[] = [];
  tasks.forEach((task, index) => {
    const label = `Task ${index + 1}`;
    if (!task.title.trim()) {
      errors.push(`${label}: a title is required.`);
    }
    if (!Number.isInteger(task.dueDays) || task.dueDays < 0) {
      errors.push(`${label}: due timing must be a whole number of days, 0 or more.`);
    }
    if (task.assignee === 'another' && !task.preservedAssignedToId) {
      errors.push(`${label}: this task's assignee could not be carried over - switch it to Employee.`);
    }
  });
  return errors;
}
