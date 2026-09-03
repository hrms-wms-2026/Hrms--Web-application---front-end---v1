import { TestBed } from '@angular/core/testing';
import { PermissionService } from './permission.service';
import { AuthStore } from './auth.store';

function setup(permissions: string[], activeModules: string[] = []) {
  TestBed.configureTestingModule({
    providers: [{ provide: AuthStore, useValue: { permissions: () => permissions, activeModules: () => activeModules } }]
  });
  return TestBed.inject(PermissionService);
}

describe('PermissionService', () => {
  describe('hasPermission', () => {
    it('returns true when the exact permission is present', () => {
      const service = setup(['org:read']);
      expect(service.hasPermission('org:read')).toBe(true);
    });

    it('returns false when the permission is absent', () => {
      const service = setup(['org:read']);
      expect(service.hasPermission('org:manage')).toBe(false);
    });

    it('returns true for any permission when the wildcard "*" is granted (superuser)', () => {
      const service = setup(['*']);
      expect(service.hasPermission('org:manage')).toBe(true);
      expect(service.hasPermission('anything:at-all')).toBe(true);
    });
  });

  describe('hasAnyPermission', () => {
    it('returns true when at least one permission matches', () => {
      const service = setup(['org:read']);
      expect(service.hasAnyPermission(['org:read', 'org:manage'])).toBe(true);
    });

    it('returns false when none match', () => {
      const service = setup(['calendar:read']);
      expect(service.hasAnyPermission(['org:read', 'org:manage'])).toBe(false);
    });

    it('returns false for an empty permission list', () => {
      const service = setup(['*']);
      expect(service.hasAnyPermission([])).toBe(false);
    });

    it('short-circuits true on the wildcard', () => {
      const service = setup(['*']);
      expect(service.hasAnyPermission(['org:read', 'org:manage'])).toBe(true);
    });
  });

  describe('hasModule', () => {
    it('returns true when the module is active', () => {
      const service = setup([], ['org_structure', 'core_hr']);
      expect(service.hasModule('org_structure')).toBe(true);
    });

    it('returns false when the module is not active', () => {
      const service = setup([], ['core_hr']);
      expect(service.hasModule('org_structure')).toBe(false);
    });
  });

  describe('hasAnyModule', () => {
    it('returns true when at least one module is active', () => {
      const service = setup([], ['projects']);
      expect(service.hasAnyModule(['worksync_foundation', 'projects', 'tasks'])).toBe(true);
    });

    it('returns false when none are active', () => {
      const service = setup([], ['core_hr']);
      expect(service.hasAnyModule(['worksync_foundation', 'projects', 'tasks'])).toBe(false);
    });

    it('returns false for an empty module list', () => {
      const service = setup([], ['core_hr']);
      expect(service.hasAnyModule([])).toBe(false);
    });
  });
});
