import { AuthStore } from '../../auth/state/auth.store';
import { PermissionService } from '../../auth/state/permission.service';
import { TrayPresenceStore } from '../state/tray-presence.store';

/** Navbar tenant APIs must not fire until session modules are known and, when
 *  activity monitoring is on, the tray gate has unlocked the workspace. */
export function tenantWorkspaceReady(
  auth: InstanceType<typeof AuthStore>,
  permissions: PermissionService,
  tray: InstanceType<typeof TrayPresenceStore>
): boolean {
  const authenticated = typeof auth.authenticated === 'function' && auth.authenticated();
  if (!authenticated)
    return false;
  if (!permissions.hasModule('activity_monitoring'))
    return true;
  return tray.canRenderProtectedContent();
}
