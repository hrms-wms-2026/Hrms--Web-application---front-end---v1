import { WorkDropdownOption } from '../ui/work-dropdown/work-dropdown.component';
import { TaskFilterFieldConfig } from '../ui/task-filter-bar/task-filter-bar.component';
import { ApprovalFeedItemDto } from '../models/dto/approval-feed.dto';

export type ApprovalTypeKey =
  | 'task_creation' | 'task_update' | 'task_deletion' | 'allocation' | 'module_update'
  | 'invitation' | 'sprint' | 'status_template';

export type ApprovalTone = 'accent' | 'success' | 'warning' | 'danger' | 'neutral';

/** tone picks a theme token; icon is an ApprovalTypeIconComponent name. */
export const APPROVAL_TYPE_META: Record<ApprovalTypeKey, { label: string; tone: ApprovalTone; icon: string }> = {
  task_creation:   { label: 'Task Creation',     tone: 'accent',  icon: 'task-plus' },
  task_update:     { label: 'Task Update',       tone: 'accent',  icon: 'task' },
  task_deletion:   { label: 'Task Deletion',     tone: 'neutral', icon: 'trash' },
  allocation:      { label: 'Allocation',        tone: 'accent',  icon: 'clock' },
  module_update:   { label: 'Module Update',     tone: 'accent',  icon: 'module' },
  invitation:      { label: 'Module Invitation', tone: 'accent',  icon: 'user-plus' },
  sprint:          { label: 'Sprint',            tone: 'neutral', icon: 'sprint' },
  status_template: { label: 'Status Template',   tone: 'neutral', icon: 'status' }
};

export function approvalTypeKey(actionType: string): ApprovalTypeKey {
  if (actionType === 'task.create') return 'task_creation';
  if (actionType === 'task.delete') return 'task_deletion';
  if (actionType.startsWith('task.')) return 'task_update';
  if (actionType === 'module.allocation_extend') return 'allocation';
  if (actionType === 'module.invitation') return 'invitation';
  if (actionType.startsWith('module.')) return 'module_update';
  if (actionType.startsWith('sprint.')) return 'sprint';
  return 'status_template';
}

const ACTION_TITLES: Record<string, string> = {
  'task.create': 'Add new task', 'task.edit': 'Update task details', 'task.delete': 'Delete task',
  'module.edit': 'Change module details', 'module.delete': 'Delete module', 'module.transfer': 'Transfer module owner',
  'module.achieve': 'Achieve module', 'module.unachieve': 'Reopen module', 'module.allocation_extend': 'Change allocated hours',
  'module.invitation': 'Add member to module',
  'sprint.create': 'Create sprint', 'sprint.edit': 'Update sprint', 'sprint.start': 'Start sprint',
  'sprint.complete': 'Complete sprint', 'sprint.achieve': 'Achieve sprint', 'sprint.delete': 'Delete sprint',
  'project.status_template_change': 'Change task statuses'
};

export function approvalTitle(item: ApprovalFeedItemDto): string {
  return ACTION_TITLES[item.actionType] ?? 'Request';
}

/** "Update task details" row subtitle: the target plus the summary line when there is one. */
export function approvalSubtitle(item: ApprovalFeedItemDto): string {
  return item.summary ? `${item.targetTitle} · ${item.summary}` : item.targetTitle;
}

export function statusLabel(item: ApprovalFeedItemDto): string {
  const invitation = item.source === 'invitation';
  switch (item.status) {
    case 'pending': return 'Pending';
    case 'approved': return invitation ? 'Accepted' : 'Approved';
    case 'rejected': return invitation ? 'Declined' : 'Rejected';
    case 'cancelled': return 'Cancelled';
    default: return invitation ? 'Expired' : 'Outdated';
  }
}

/** Theme colour + gray only: pending (needs attention) uses the accent, every decided state is gray. */
export function statusTone(item: ApprovalFeedItemDto): ApprovalTone {
  return item.status === 'pending' ? 'accent' : 'neutral';
}

export function sortFeed(items: readonly ApprovalFeedItemDto[]): ApprovalFeedItemDto[] {
  return [...items].sort((a, b) => {
    const pa = a.status === 'pending' ? 0 : 1;
    const pb = b.status === 'pending' ? 0 : 1;
    return pa !== pb ? pa - pb : Date.parse(b.createdAt) - Date.parse(a.createdAt);
  });
}

export type ApprovalFilterValues = Partial<Record<'direction' | 'type' | 'status' | 'module' | 'requestedBy' | 'requestedOn', readonly string[]>>;

export function matchesApprovalFilters(item: ApprovalFeedItemDto, f: ApprovalFilterValues, now = new Date()): boolean {
  const has = (vals: readonly string[] | undefined, v: string | null) => !vals?.length || (v !== null && vals.includes(v));
  const direction = f.direction?.[0];
  if (direction && direction !== 'all' && item.direction !== direction) return false;
  if (!has(f.type, approvalTypeKey(item.actionType))) return false;
  if (!has(f.status, item.status)) return false;
  if (!has(f.module, item.moduleId)) return false;
  if (!has(f.requestedBy, item.requestedById)) return false;
  const days = Number(f.requestedOn?.[0]);
  if (days > 0 && now.getTime() - Date.parse(item.createdAt) > days * 86_400_000) return false;
  return true;
}

function distinct(items: readonly ApprovalFeedItemDto[], key: (i: ApprovalFeedItemDto) => [string | null, string | null]): WorkDropdownOption[] {
  const map = new Map<string, string>();
  for (const i of items) {
    const [v, l] = key(i);
    if (v && l && !map.has(v)) map.set(v, l);
  }
  return [...map].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
}

export function buildApprovalFilterFields(items: readonly ApprovalFeedItemDto[]): TaskFilterFieldConfig[] {
  const typeKeys = [...new Set(items.map((i) => approvalTypeKey(i.actionType)))];
  return [
    { key: 'direction', label: 'Requests', icon: 'type', kind: 'single', defaultValues: ['all'],
      options: [{ value: 'all', label: 'All requests' }, { value: 'received', label: 'Received by me' }, { value: 'sent', label: 'Sent by me' }] },
    { key: 'type', label: 'Type', icon: 'type', kind: 'multi',
      options: typeKeys.map((k) => ({ value: k, label: APPROVAL_TYPE_META[k].label })) },
    { key: 'status', label: 'Status', icon: 'status', kind: 'multi',
      options: [{ value: 'pending', label: 'Pending' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' },
                { value: 'cancelled', label: 'Cancelled' }, { value: 'stale', label: 'Outdated' }] },
    { key: 'module', label: 'Module', icon: 'module', kind: 'multi', options: distinct(items, (i) => [i.moduleId, i.moduleTitle]) },
    { key: 'requestedBy', label: 'Requested by', icon: 'people', kind: 'multi', options: distinct(items, (i) => [i.requestedById, i.requestedByName]) },
    { key: 'requestedOn', label: 'Requested on', icon: 'calendar', kind: 'single', defaultValues: ['any'],
      options: [{ value: 'any', label: 'Any time' }, { value: '7', label: 'Last 7 days' }, { value: '30', label: 'Last 30 days' }, { value: '90', label: 'Last 90 days' }] }
  ];
}
