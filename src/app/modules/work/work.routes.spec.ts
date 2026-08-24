import { WORK_ROUTES } from './work.routes';

describe('WORK_ROUTES', () => {
  it('has an empty-path route and a :id route', () => {
    expect(WORK_ROUTES.find((r) => r.path === '')).toBeTruthy();
    expect(WORK_ROUTES.find((r) => r.path === ':id')).toBeTruthy();
  });

  it('nests milestones/:milestoneId under :id, redirecting the empty path to tree', () => {
    const idRoute = WORK_ROUTES.find((r) => r.path === ':id')!;
    const milestoneRoute = idRoute.children!.find((r) => r.path === 'milestones/:milestoneId')!;
    expect(milestoneRoute).toBeTruthy();

    const emptyChild = milestoneRoute.children!.find((r) => r.path === '')!;
    expect(emptyChild.redirectTo).toBe('tree');
    expect(emptyChild.pathMatch).toBe('full');
  });

  it('registers all tab routes, in order', () => {
    const idRoute = WORK_ROUTES.find((r) => r.path === ':id')!;
    const milestoneRoute = idRoute.children!.find((r) => r.path === 'milestones/:milestoneId')!;
    const paths = milestoneRoute.children!.map((r) => r.path);
    expect(paths).toEqual(['', 'tree', 'board', 'backlog', 'approvals', 'my-task', 'list', 'calendar']);
    expect(idRoute.children!.find((r) => r.path === 'settings')).toBeTruthy();
  });

  it('tags remaining stub tab routes with titles in route data', () => {
    const idRoute = WORK_ROUTES.find((r) => r.path === ':id')!;
    const milestoneRoute = idRoute.children!.find((r) => r.path === 'milestones/:milestoneId')!;
    const byPath = (path: string) => milestoneRoute.children!.find((r) => r.path === path)!;
    const settingsRoute = idRoute.children!.find((r) => r.path === 'settings')!;

    expect(byPath('my-task').data).toEqual({ title: 'My Task' });
    expect(byPath('list').data).toEqual({ title: 'List' });
    expect(byPath('calendar').data).toEqual({ title: 'Calendar' });
    expect(byPath('board').loadComponent).toBeTruthy();
    expect(byPath('backlog').loadComponent).toBeTruthy();
    expect(byPath('approvals').loadComponent).toBeTruthy();
    expect(settingsRoute.loadComponent).toBeTruthy();
  });
});
