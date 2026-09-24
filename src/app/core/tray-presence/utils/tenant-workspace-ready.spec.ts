import { describe, expect, it } from 'vitest';
import { tenantWorkspaceReady } from './tenant-workspace-ready';

describe('tenantWorkspaceReady', () => {
  it('does not throw when authenticated is missing on a test stub', () => {
    expect(tenantWorkspaceReady(
      { } as never,
      { hasModule: () => false } as never,
      { canRenderProtectedContent: () => true } as never
    )).toBe(false);
  });

  it('waits until the session is authenticated', () => {
    expect(tenantWorkspaceReady(
      { authenticated: () => false } as never,
      { hasModule: () => false } as never,
      { canRenderProtectedContent: () => true } as never
    )).toBe(false);
  });

  it('allows tenant APIs when monitoring is off after login', () => {
    expect(tenantWorkspaceReady(
      { authenticated: () => true } as never,
      { hasModule: () => false } as never,
      { canRenderProtectedContent: () => false } as never
    )).toBe(true);
  });

  it('blocks tenant APIs until the tray gate unlocks when monitoring is on', () => {
    expect(tenantWorkspaceReady(
      { authenticated: () => true } as never,
      { hasModule: (m: string) => m === 'activity_monitoring' } as never,
      { canRenderProtectedContent: () => false } as never
    )).toBe(false);
  });

  it('allows tenant APIs after the tray connects', () => {
    expect(tenantWorkspaceReady(
      { authenticated: () => true } as never,
      { hasModule: (m: string) => m === 'activity_monitoring' } as never,
      { canRenderProtectedContent: () => true } as never
    )).toBe(true);
  });
});
