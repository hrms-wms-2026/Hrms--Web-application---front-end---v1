import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, ActivatedRouteSnapshot } from '@angular/router';
import { permissionGuard } from './permission.guard';
import { PermissionService } from '../auth/state/permission.service';

function routeWithPermissions(permissions?: string[]): ActivatedRouteSnapshot {
  return { data: { permissions } } as unknown as ActivatedRouteSnapshot;
}

function routeWithPermissionsAndModules(permissions: string[] | undefined, modules: string[] | undefined): ActivatedRouteSnapshot {
  return { data: { permissions, modules } } as unknown as ActivatedRouteSnapshot;
}

describe('permissionGuard', () => {
  function runGuard(route: ActivatedRouteSnapshot) {
    return TestBed.runInInjectionContext(() => permissionGuard(route, {} as never));
  }

  it('allows navigation when no permissions are declared on the route', () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: PermissionService, useValue: { hasAnyPermission: () => false } }]
    });

    expect(runGuard(routeWithPermissions(undefined))).toBe(true);
  });

  it('allows navigation when the user has at least one required permission', () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: PermissionService, useValue: { hasAnyPermission: () => true } }]
    });

    expect(runGuard(routeWithPermissions(['org:read', 'org:manage']))).toBe(true);
  });

  it('redirects to /dashboard when the user has none of the required permissions', () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: PermissionService, useValue: { hasAnyPermission: () => false } }]
    });
    const router = TestBed.inject(Router);
    const createUrlTreeSpy = vi.spyOn(router, 'createUrlTree');

    const result = runGuard(routeWithPermissions(['org:manage']));

    expect(createUrlTreeSpy).toHaveBeenCalledWith(['/dashboard']);
    expect(result).not.toBe(true);
  });

  it('allows navigation when the user has the required permission and the required module is active', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: PermissionService, useValue: { hasAnyPermission: () => true, hasAnyModule: () => true } }
      ]
    });

    expect(runGuard(routeWithPermissionsAndModules(['org:read'], ['org_structure']))).toBe(true);
  });

  it('redirects to /dashboard when the required permission is present but the required module is not active', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: PermissionService, useValue: { hasAnyPermission: () => true, hasAnyModule: () => false } }
      ]
    });
    const router = TestBed.inject(Router);
    const createUrlTreeSpy = vi.spyOn(router, 'createUrlTree');

    const result = runGuard(routeWithPermissionsAndModules(['org:read'], ['org_structure']));

    expect(createUrlTreeSpy).toHaveBeenCalledWith(['/dashboard']);
    expect(result).not.toBe(true);
  });
});
