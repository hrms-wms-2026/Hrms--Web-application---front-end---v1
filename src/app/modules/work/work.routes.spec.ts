import { unsavedChangesGuard } from '../../core/guards/unsaved-changes.guard';
import { WORK_ROUTES } from './work.routes';

describe('WORK_ROUTES', () => {
  it('has an empty-path route and a :id route', () => {
    expect(WORK_ROUTES.find((r) => r.path === '')).toBeTruthy();
    expect(WORK_ROUTES.find((r) => r.path === ':id')).toBeTruthy();
  });

  it('nests the milestone Tree and remaining milestone tabs under :id', () => {
    const idRoute = WORK_ROUTES.find((r) => r.path === ':id')!;
    const milestoneRoute = idRoute.children!.find((r) => r.path === 'milestones/:milestoneId')!;
    expect(milestoneRoute).toBeTruthy();

    const emptyChild = milestoneRoute.children!.find((r) => r.path === '')!;
    expect(emptyChild.redirectTo).toBe('tree');
    expect(emptyChild.pathMatch).toBe('full');
    expect(milestoneRoute.children!.map((route) => route.path)).toEqual(['', 'tree']);
  });

  it('registers the Approvals redirect, Board, Backlog, Calendar, and Settings as project-level siblings', () => {
    const idRoute = WORK_ROUTES.find((r) => r.path === ':id')!;
    expect(idRoute.children!.map((route) => route.path)).toEqual(['milestones/:milestoneId', 'approvals', 'board', 'backlog', 'calendar', 'settings']);
    // The Approvals tab moved to the Inbox; old links (dashboard, bookmarks) redirect there.
    const approvals = idRoute.children!.find((r) => r.path === 'approvals')!;
    expect(approvals.loadComponent).toBeUndefined();
    const redirect = approvals.redirectTo as (r: { queryParams: Record<string, string> }) => string;
    expect(redirect({ queryParams: { request: 'r1' } })).toBe('/inbox/work/approval/r1');
    expect(redirect({ queryParams: {} })).toBe('/inbox');
    expect(idRoute.children!.find((r) => r.path === 'board')!.loadComponent).toBeTruthy();
    expect(idRoute.children!.find((r) => r.path === 'backlog')!.loadComponent).toBeTruthy();
    expect(idRoute.children!.find((r) => r.path === 'calendar')!.loadComponent).toBeTruthy();
    expect(idRoute.children!.find((r) => r.path === 'settings')!.loadComponent).toBeTruthy();
  });

  it('no longer registers standalone task routes — task create/edit is an in-page modal', () => {
    const idRoute = WORK_ROUTES.find((r) => r.path === ':id')!;
    expect(idRoute.children!.find((r) => r.path === 'task/new')).toBeUndefined();
    expect(idRoute.children!.find((r) => r.path === 'task/:taskId')).toBeUndefined();
  });

  it('has no remaining milestone-scoped stub routes', () => {
    const idRoute = WORK_ROUTES.find((r) => r.path === ':id')!;
    const milestoneRoute = idRoute.children!.find((r) => r.path === 'milestones/:milestoneId')!;
    expect(milestoneRoute.children!.map((r) => r.path)).toEqual(['', 'tree']);
  });

  it('board, backlog, and milestone tree routes are protected by the unsaved-changes guard', () => {
    const idRoute = WORK_ROUTES.find((r) => r.path === ':id')!;
    const board = idRoute.children!.find((r) => r.path === 'board');
    const backlog = idRoute.children!.find((r) => r.path === 'backlog');
    const milestone = idRoute.children!.find((r) => r.path === 'milestones/:milestoneId');
    const tree = milestone?.children?.find((r) => r.path === 'tree');

    expect(board?.canDeactivate).toBeDefined();
    expect(board?.canDeactivate).toContain(unsavedChangesGuard);
    expect(backlog?.canDeactivate).toBeDefined();
    expect(backlog?.canDeactivate).toContain(unsavedChangesGuard);
    expect(tree?.canDeactivate).toBeDefined();
    expect(tree?.canDeactivate).toContain(unsavedChangesGuard);
  });
});
