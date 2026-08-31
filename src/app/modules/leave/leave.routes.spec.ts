import { LEAVE_ROUTES } from './leave.routes';
describe('LEAVE_ROUTES', () => { it('has My Balances as the permission-protected index route', () => { const index = LEAVE_ROUTES[0].children?.find((route) => route.path === ''); expect(index?.data?.['permissions']).toEqual(['leave:read-own']); }); it('has a Team Balances route for leave:read-team', () => { const team = LEAVE_ROUTES[0].children?.find((route) => route.path === 'team'); expect(team?.data?.['permissions']).toEqual(['leave:read-team']); }); it('has an Entitlements route for HR leave readers and managers', () => { const route = LEAVE_ROUTES[0].children?.find((child) => child.path === 'entitlements'); expect(route?.data?.['permissions']).toEqual(['leave:read', 'leave:manage']); }); it('retains Leave Types and Leave Policies', () => { const children = LEAVE_ROUTES[0].children ?? []; expect(children.some((route) => route.path === 'types')).toBe(true); expect(children.some((route) => route.path === 'policies')).toBe(true); });

  it('has a pending-approvals child route requiring leave:approve', () => {
    const shell = LEAVE_ROUTES[0];
    const pending = shell.children?.find((r) => r.path === 'team-approvals');
    expect(pending?.data?.['permissions']).toEqual(['leave:approve']);
  });

  it('has an all child route requiring leave:read', () => {
    const shell = LEAVE_ROUTES[0];
    const all = shell.children?.find((r) => r.path === 'all');
    expect(all?.data?.['permissions']).toEqual(['leave:read']);
  });

  it('has a calendar child route requiring calendar:read', () => {
    const shell = LEAVE_ROUTES[0];
    const calendar = shell.children?.find((r) => r.path === 'calendar');
    expect(calendar?.data?.['permissions']).toEqual(['calendar:read']);
  });
});
