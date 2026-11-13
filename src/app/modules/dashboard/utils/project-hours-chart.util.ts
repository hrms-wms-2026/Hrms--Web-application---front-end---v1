import { LedHourTotals, LedOverdueProject, LedProjectProgress } from '../models/my-team-led-progress.model';
import { DashboardBar, DashboardBarSegment } from '../../../shared/ui/charts/dashboard-bar-chart/dashboard-bar-chart.component';
import { PROGRESS_STATUSES, ProgressStatusKey, formatHourValue, formatPercent } from './team-progress-format.util';

const HOURS: Record<ProgressStatusKey, (h: LedHourTotals) => number> = {
  completed: (h) => h.completedHours,
  inProgress: (h) => h.inProgressHours,
  notStarted: (h) => h.notStartedHours,
  untasked: (h) => h.untaskedHours
};

/** Hours already in tasks (any state). */
const taskedHours = (h: LedHourTotals): number => h.completedHours + h.inProgressHours + h.notStartedHours;

/** The led modules of a project with overdue work in their subtree ("At risk"). A child module's risk already
 * shows on its led (top) module, so only those are named; deeper ones only when no led module carries it. */
export function atRiskModuleNames(project: LedProjectProgress): string[] {
  const top = project.modules.filter((m) => m.atRisk && m.depth === 0).map((m) => m.title);
  return top.length > 0 ? top : project.modules.filter((m) => m.atRisk).map((m) => m.title);
}

/** Projects for the chart: at-risk ones first, then the largest allocation, then by name. */
export function orderProjectsForChart(projects: readonly LedProjectProgress[]): LedProjectProgress[] {
  return [...projects].sort(
    (a, b) =>
      Number(atRiskModuleNames(b).length > 0) - Number(atRiskModuleNames(a).length > 0) ||
      Math.max(b.hours.allocatedHours, taskedHours(b.hours)) - Math.max(a.hours.allocatedHours, taskedHours(a.hours)) ||
      a.projectName.localeCompare(b.projectName)
  );
}

/** Why a project's bar has a red border: which modules are at risk and, when known, how much is overdue. */
export function projectRiskText(project: LedProjectProgress, overdue?: LedOverdueProject): string | undefined {
  const modules = atRiskModuleNames(project);
  if (modules.length === 0) return undefined;
  const where = modules.join(', ');
  if (overdue && overdue.taskCount > 0) {
    const tasks = `${overdue.taskCount} overdue ${overdue.taskCount === 1 ? 'task' : 'tasks'}`;
    const hours = overdue.hours > 0 ? ` (${formatHourValue(overdue.hours)} h)` : '';
    return `At risk: ${tasks}${hours} in ${where}`;
  }
  return `At risk: unfinished work in ${where} is past its due date`;
}

/** What one part's share is of: the allocation, or the task estimates when nothing is allocated. */
function base(h: LedHourTotals): { hours: number; text: string } {
  return h.allocatedHours > 0
    ? { hours: h.allocatedHours, text: `${formatHourValue(h.allocatedHours)} h allocated` }
    : { hours: taskedHours(h), text: `${formatHourValue(taskedHours(h))} h in tasks` };
}

/**
 * One bar per project: its hours stacked by state (completed at the bottom, then in progress, not started and
 * not yet tasked), so a bar is as tall as the project's allocation (or its task estimates when over-tasked, with a
 * dash at the allocation). Hovering a colour reads that part ("Watercraft · In progress", "700 h",
 * "35% of 2,000 h allocated"); a project with an at-risk module gets a red border and says why.
 */
export function projectHourBars(
  projects: readonly LedProjectProgress[],
  overdueByProject: readonly LedOverdueProject[] = []
): DashboardBar[] {
  const overdue = new Map(overdueByProject.map((o) => [o.projectId, o]));
  return projects.map((project) => {
    const h = project.hours;
    const of = base(h);
    const segments: DashboardBarSegment[] = PROGRESS_STATUSES.map((status) => {
      const hours = HOURS[status.key](h);
      return {
        key: status.key,
        value: hours,
        color: status.color,
        hover: {
          label: `${project.projectName} · ${status.label}`,
          value: `${formatHourValue(hours)} h`,
          chip: `${formatPercent(hours, of.hours)} of ${of.text}`
        }
      };
    });
    const alert = projectRiskText(project, overdue.get(project.projectId));
    const parts = PROGRESS_STATUSES.map((s) => `${s.label.toLowerCase()} ${formatHourValue(HOURS[s.key](h))} h`).join(', ');
    return {
      key: project.projectId,
      label: project.identifier || project.projectName,
      title: project.projectName,
      valueText: of.text,
      chip: `${formatPercent(h.completedHours, of.hours)} completed`,
      segments,
      marker: h.overTaskedHours > 0 && h.allocatedHours > 0 ? h.allocatedHours : undefined,
      tooltip: `${project.projectName}: ${of.text}. ${parts}.${alert ? ` ${alert}.` : ''}`,
      alert
    };
  });
}

/** The chart's text for screen readers: every project's figures and risk. */
export function projectChartSummary(
  projects: readonly LedProjectProgress[],
  overdueByProject: readonly LedOverdueProject[] = []
): string {
  return (
    'Hours by project, by state. ' +
    projectHourBars(projects, overdueByProject)
      .map((bar) => bar.tooltip)
      .join(' ')
  );
}
