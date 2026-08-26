import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { PermissionService } from '../../core/auth/state/permission.service';
import { ConnectDeviceComponent } from '../settings/feature/connect-device/connect-device.component';
import { ATTENDANCE_ROUTES } from './attendance.routes';

describe('Attendance routes', () => {
  it('renders the employee workspace activation journey at /monitoring', async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter(ATTENDANCE_ROUTES),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: PermissionService,
          useValue: {
            hasAnyPermission: (permissions: readonly string[]) => permissions.includes('attendance:read-own'),
            hasAnyModule: (modules: readonly string[]) => modules.includes('time_attendance')
          }
        }
      ]
    }).compileComponents();

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/monitoring', ConnectDeviceComponent);

    expect(harness.routeNativeElement?.querySelector('[data-testid="workspace-activation"]')).toBeTruthy();
  });
});
