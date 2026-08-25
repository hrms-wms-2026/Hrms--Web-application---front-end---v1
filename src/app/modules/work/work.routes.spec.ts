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
    expect(milestoneRoute.children!.map((route) => route.path)).toEqual(['', 'tree', 'approvals', 'my-task', 'list']);
  });

  it('registers Board, Backlog, Calendar, and Settings as project-level siblings', () => {
    const idRoute = WORK_ROUTES.find((r) => r.path === ':id')!;
    expect(idRoute.children!.map((route) => route.path)).toEqual(['milestones/:milestoneId', 'board', 'backlog', 'calendar', 'settings']);
    expect(idRoute.children!.find((r) => r.path === 'board')!.loadComponent).toBeTruthy();
    expect(idRoute.children!.find((r) => r.path === 'backlog')!.loadComponent).toBeTruthy();
    expect(idRoute.children!.find((r) => r.path === 'calendar')!.loadComponent).toBeTruthy();
    expect(idRoute.children!.find((r) => r.path === 'settings')!.loadComponent).toBeTruthy();
  });

  it('tags remaining milestone stub routes with titles in route data', () => {
    const idRoute = WORK_ROUTES.find((r) => r.path === ':id')!;
    const milestoneRoute = idRoute.children!.find((r) => r.path === 'milestones/:milestoneId')!;
    const byPath = (path: string) => milestoneRoute.children!.find((r) => r.path === path)!;

    expect(byPath('my-task').data).toEqual({ title: 'My Task' });
    expect(byPath('list').data).toEqual({ title: 'List' });
    expect(byPath('calendar')).toBeUndefined();
    expect(byPath('approvals').loadComponent).toBeTruthy();
  });
});
