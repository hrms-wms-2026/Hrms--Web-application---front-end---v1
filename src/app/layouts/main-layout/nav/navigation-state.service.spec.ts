import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthStore } from '../../../core/auth/state/auth.store';
import { NavigationStateService } from './navigation-state.service';

@Component({ standalone: true, template: '' })
class BlankComponent {}

describe('NavigationStateService', () => {
  let service: NavigationStateService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', component: BlankComponent }]),
        {
          provide: AuthStore,
          useValue: {
            permissions: () => ['attendance:read-own', 'attendance:write-own', 'attendance:read', 'attendance:approve', 'monitoring:read'],
            activeModules: () => ['time_attendance']
          }
        }
      ]
    });
    service = TestBed.inject(NavigationStateService);
    router = TestBed.inject(Router);
  });

  it('keeps Attendance active and returns sub-sidebar children when navigated to /attendance/monitoring', async () => {
    await router.navigateByUrl('/attendance/monitoring');

    expect(service.activeItem()?.id).toBe('time-attendance');
    const childIds = service.activeChildren().map((c) => c.id);
    expect(childIds).toEqual(['time-attendance-tracking', 'time-attendance-monitoring']);
  });
});
