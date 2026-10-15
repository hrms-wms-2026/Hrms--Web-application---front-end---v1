import { FilterFieldConfig, FilterFieldIcon } from '../../../shared/ui/filter-bar/filter-bar.component';
import { MenuItem } from '../../../shared/ui/dropdown-menu/dropdown-menu.component';
import { InboxFilterFieldDto, InboxItemDto, InboxKindDescriptorDto } from '../models/inbox.dto';

export type InboxTone = 'accent' | 'success' | 'warning' | 'danger' | 'neutral';

export interface InboxTypeMeta {
  label: string;
  tone: InboxTone;
  /** An InboxTypeIconComponent name. */
  icon: string;
}

const REQUEST_TYPE_META: Record<string, InboxTypeMeta> = {
  task_creation: { label: 'Task Creation', tone: 'accent', icon: 'task-plus' },
  task_update: { label: 'Task Update', tone: 'accent', icon: 'task' },
  task_deletion: { label: 'Task Deletion', tone: 'neutral', icon: 'trash' },
  allocation: { label: 'Allocation', tone: 'accent', icon: 'clock' },
  module_update: { label: 'Module Update', tone: 'accent', icon: 'module' },
  invitation: { label: 'Module Invitation', tone: 'accent', icon: 'user-plus' },
  sprint: { label: 'Sprint', tone: 'neutral', icon: 'sprint' },
  status_template: { label: 'Status Template', tone: 'neutral', icon: 'status' },
  other: { label: 'Request', tone: 'neutral', icon: 'task' }
};

function requestTypeKey(actionType: string): string {
  if (actionType === 'task.create') return 'task_creation';
  if (actionType === 'task.delete') return 'task_deletion';
  if (actionType.startsWith('task.')) return 'task_update';
  if (actionType === 'module.allocation_extend') return 'allocation';
  if (actionType === 'module.invitation') return 'invitation';
  if (actionType.startsWith('module.')) return 'module_update';
  if (actionType.startsWith('sprint.')) return 'sprint';
  if (actionType.startsWith('project.')) return 'status_template';
  return 'other';
}

const ACTION_TITLES: Record<string, string> = {
  'task.create': 'Add new task', 'task.edit': 'Update task details', 'task.delete': 'Delete task',
  'task.status_change': 'Change task status',
  'module.edit': 'Change module details', 'module.delete': 'Delete module', 'module.transfer': 'Transfer module owner',
  'module.achieve': 'Achieve module', 'module.unachieve': 'Reopen module', 'module.allocation_extend': 'Change allocated hours',
  'module.member_add': 'Add module member', 'module.member_remove': 'Remove module member',
  'module.invitation': 'Add member to module',
  'sprint.create': 'Create sprint', 'sprint.edit': 'Update sprint', 'sprint.start': 'Start sprint',
  'sprint.complete': 'Complete sprint', 'sprint.achieve': 'Achieve sprint', 'sprint.delete': 'Delete sprint',
  'project.status_template_change': 'Change task statuses'
};

const ALERT_TITLES: Record<string, string> = {
  'monitor.module_over_capacity': 'Module over capacity',
  'monitor.module_capacity_shortfall': 'Module cannot finish in time',
  'monitor.employee_deadline_overload': 'Assignee overloaded before the deadline',
  'monitor.task_clocked_over_estimate': 'Clocked hours exceed the estimate',
  'monitor.module_clocked_over_allocated': 'Clocked hours exceed the allocation',
  'monitor.sprint_overdue': 'Sprint past its end date',
  'monitor.task_overdue': 'Task past its due date',
  'monitor.module_overdue': 'Module past its end date'
};

export function isAlert(item: InboxItemDto): boolean {
  return item.category === 'alert';
}

/** Work Management items are titled by their action type (the item title is the target's name); every other
 *  source sends a ready title. */
export function isWorkActionType(item: InboxItemDto): boolean {
  return isAlert(item) ? item.actionType.startsWith('monitor.') : requestTypeKey(item.actionType) !== 'other';
}

function humanize(value: string): string {
  const words = value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** `descriptor` (the kind registry) names kinds that are not Work Management action types. */
export function inboxTypeMeta(item: InboxItemDto, descriptor?: InboxKindDescriptorDto | null): InboxTypeMeta {
  if (isAlert(item)) {
    const tone: InboxTone = item.severity === 'high' || item.severity === 'critical' ? 'danger' : 'warning';
    return { label: isWorkActionType(item) ? 'Alert' : descriptor?.label ?? 'Alert', tone, icon: 'alert' };
  }
  const key = requestTypeKey(item.actionType);
  if (key !== 'other') return REQUEST_TYPE_META[key];
  return { ...REQUEST_TYPE_META['other'], label: descriptor?.label ?? REQUEST_TYPE_META['other'].label };
}

export function inboxTitle(item: InboxItemDto): string {
  if (!isWorkActionType(item)) return item.title || (isAlert(item) ? 'Alert' : 'Request');
  if (isAlert(item)) return ALERT_TITLES[item.actionType] ?? 'Project alert';
  return ACTION_TITLES[item.actionType] ?? 'Request';
}

export function inboxSubtitle(item: InboxItemDto): string {
  if (!isWorkActionType(item)) return item.subtitle ?? '';
  return item.subtitle ? `${item.title} · ${item.subtitle}` : item.title;
}

export function inboxStatusLabel(item: InboxItemDto): string {
  const work = isWorkActionType(item);
  if (isAlert(item)) return item.status === 'open' ? 'Open' : work ? 'Resolved' : humanize(item.status);
  const invitation = item.kind === 'invitation';
  switch (item.status) {
    case 'pending': return 'Pending';
    case 'approved': return invitation ? 'Accepted' : 'Approved';
    case 'rejected': return invitation ? 'Declined' : 'Rejected';
    case 'cancelled': return 'Cancelled';
    default: return !work ? humanize(item.status) : invitation ? 'Expired' : 'Outdated';
  }
}

/** Theme colour + gray only: anything still needing attention uses the accent, finished states are gray. */
export function inboxStatusTone(item: InboxItemDto): InboxTone {
  return item.isPending ? 'accent' : 'neutral';
}

/** Actions that need a dialog (a comment, an edited payload) or confirmation run from the card, not the row menu. */
const MENU_ACTIONS = new Set(['approve', 'cancel', 'accept_invitation']);

export function inboxMenuItems(item: InboxItemDto, canOpenTarget: boolean): MenuItem[] {
  const menu: MenuItem[] = [{ id: 'view', label: 'View details' }];
  for (const action of item.availableActions) {
    if (MENU_ACTIONS.has(action.key)) menu.push({ id: `action:${action.key}`, label: action.label, danger: action.tone === 'danger' });
  }
  if (canOpenTarget) menu.push({ id: 'open', label: isAlert(item) ? 'Open target' : 'Open' });
  menu.push({ id: 'copy', label: 'Copy link' });
  return menu;
}

const FIELD_ICONS: Record<string, FilterFieldIcon> = {
  project: 'category', source: 'category', type: 'type', status: 'status', requestedBy: 'people', module: 'module'
};

/** Category and direction are the page's tabs/segment, so they are not in the filter bar. */
const NOT_IN_BAR = new Set(['category', 'direction']);

export const REQUESTED_ON_FIELD: FilterFieldConfig = {
  key: 'requestedOn', label: 'Requested on', icon: 'calendar', kind: 'single', defaultValues: ['any'],
  options: [{ value: 'any', label: 'Any time' }, { value: '7', label: 'Last 7 days' }, { value: '30', label: 'Last 30 days' }, { value: '90', label: 'Last 90 days' }]
};

export function toFilterFields(fields: readonly InboxFilterFieldDto[]): FilterFieldConfig[] {
  const bar: FilterFieldConfig[] = fields
    .filter((f) => !NOT_IN_BAR.has(f.key) && f.options.length > 0)
    .map((f) => ({ key: f.key, label: f.label, icon: FIELD_ICONS[f.key] ?? 'type', kind: f.multi ? 'multi' : 'single', options: f.options }));
  return [...bar, REQUESTED_ON_FIELD];
}

/** ISO lower bound for a "last N days" choice ('any' → null). */
export function requestedOnFrom(value: string | undefined, now = new Date()): string | null {
  const days = Number(value);
  return days > 0 ? new Date(now.getTime() - days * 86_400_000).toISOString() : null;
}
