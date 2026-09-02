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
    expect(milestoneRoute.children!.map((route) => route.path)).toEqual(['', 'tree', 'approvals']);
  });

  it('registers Board, Backlog, Calendar, Settings, and the task pages as project-level siblings', () => {
    const idRoute = WORK_ROUTES.find((r) => r.path === ':id')!;
    expect(idRoute.children!.map((route) => route.path)).toEqual(['milestones/:milestoneId', 'board', 'backlog', 'calendar', 'settings', 'task/new', 'task/:taskId']);
    expect(idRoute.children!.find((r) => r.path === 'board')!.loadComponent).toBeTruthy();
    expect(idRoute.children!.find((r) => r.path === 'backlog')!.loadComponent).toBeTruthy();
    expect(idRoute.children!.find((r) => r.path === 'calendar')!.loadComponent).toBeTruthy();
    expect(idRoute.children!.find((r) => r.path === 'settings')!.loadComponent).toBeTruthy();
    expect(idRoute.children!.find((r) => r.path === 'task/:taskId')!.loadComponent).toBeTruthy();
    const createRoute = idRoute.children!.find((r) => r.path === 'task/new')!;
    expect(createRoute.loadComponent).toBeTruthy();
    expect(createRoute.data).toEqual({ mode: 'create' });
    expect(idRoute.children!.indexOf(createRoute)).toBeLessThan(idRoute.children!.findIndex((r) => r.path === 'task/:taskId'));
  });

  it('has no remaining milestone-scoped stub routes', () => {
    const idRoute = WORK_ROUTES.find((r) => r.path === ':id')!;
    const milestoneRoute = idRoute.children!.find((r) => r.path === 'milestones/:milestoneId')!;
    expect(milestoneRoute.children!.map((r) => r.path)).toEqual(['', 'tree', 'approvals']);
    expect(milestoneRoute.children!.find((r) => r.path === 'approvals')!.loadComponent).toBeTruthy();
  });
});
