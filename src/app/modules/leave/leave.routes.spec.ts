import { LEAVE_ROUTES } from './leave.routes';
describe('LEAVE_ROUTES', () => {
  it('has My Balances as the permission-protected index route', () => { const index = LEAVE_ROUTES[0].children?.find((route) => route.path === ''); expect(index?.data?.['permissions']).toEqual(['leave:read-own']); });

  it('has a Team route for the consolidated Balances/Approvals/All Requests hub, any-of gated', () => {
    const team = LEAVE_ROUTES[0].children?.find((route) => route.path === 'team');
    expect(team?.data?.['permissions']).toEqual(['leave:read-team', 'leave:approve', 'leave:read']);
  });

  it('has an Entitlements route for HR leave readers and managers', () => { const route = LEAVE_ROUTES[0].children?.find((child) => child.path === 'entitlements'); expect(route?.data?.['permissions']).toEqual(['leave:read', 'leave:manage']); });
  it('retains Leave Types and Leave Policies', () => { const children = LEAVE_ROUTES[0].children ?? []; expect(children.some((route) => route.path === 'types')).toBe(true); expect(children.some((route) => route.path === 'policies')).toBe(true); });

  it('redirects the legacy team-approvals URL to the Team hub, still gated on leave:approve', () => {
    const shell = LEAVE_ROUTES[0];
    const legacy = shell.children?.find((r) => r.path === 'team-approvals');
    expect(legacy?.data?.['permissions']).toEqual(['leave:approve']);
    expect(legacy?.loadComponent).toBeTypeOf('function');
  });

  it('redirects the legacy all URL to the Team hub, still gated on leave:read', () => {
    const shell = LEAVE_ROUTES[0];
    const legacy = shell.children?.find((r) => r.path === 'all');
    expect(legacy?.data?.['permissions']).toEqual(['leave:read']);
    expect(legacy?.loadComponent).toBeTypeOf('function');
  });

  it('has a calendar child route requiring calendar:read', () => {
    const shell = LEAVE_ROUTES[0];
    const calendar = shell.children?.find((r) => r.path === 'calendar');
    expect(calendar?.data?.['permissions']).toEqual(['calendar:read']);
  });
});
