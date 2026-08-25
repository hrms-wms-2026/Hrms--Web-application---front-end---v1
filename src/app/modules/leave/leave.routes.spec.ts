import { permissionGuard } from '../../core/guards/permission.guard';
import { LEAVE_ROUTES } from './leave.routes';
describe('LEAVE_ROUTES', () => { it('routes policies to the policy management page with leave manage permission', () => { const shellRoute = LEAVE_ROUTES.find((route) => route.path === ''); const route = shellRoute?.children?.find((child) => child.path === 'policies'); expect(route?.data).toEqual({ title: 'Leave Policies', permissions: ['leave:manage'] }); expect(route?.canActivate).toContain(permissionGuard); }); });
