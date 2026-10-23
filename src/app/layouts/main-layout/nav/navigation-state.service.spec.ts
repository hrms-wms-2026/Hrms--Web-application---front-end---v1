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
    localStorage.clear();
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
    expect(childIds).toEqual(['time-attendance-overview', 'time-attendance-tracking', 'time-attendance-monitoring']);
  });

  it('keeps Attendance active and sub-sidebar visible when navigating with query parameters', async () => {
    await router.navigateByUrl('/attendance/time-tracking?openCorrection=today');

    expect(service.activeItem()?.id).toBe('time-attendance');
    const childIds = service.activeChildren().map((c) => c.id);
    expect(childIds).toEqual(['time-attendance-overview', 'time-attendance-tracking', 'time-attendance-monitoring']);
  });

  it('hides the sub-sidebar when the section has only one reachable page', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', component: BlankComponent }]),
        { provide: AuthStore, useValue: { permissions: () => ['leave:read-own'], activeModules: () => ['leave'] } }
      ]
    });
    const single = TestBed.inject(NavigationStateService);
    await TestBed.inject(Router).navigateByUrl('/time-off');

    expect(single.activeChildren().map((c) => c.id)).toEqual(['time-off-balances']);
    expect(single.hasSubSidebar()).toBe(false);
    expect(single.hasVisibleSubSidebar()).toBe(false);
  });

  it('manages sub-sidebar collapsed and expanded states and persists to localStorage', async () => {
    await router.navigateByUrl('/attendance/overview');

    expect(service.hasSubSidebar()).toBe(true);
    expect(service.isSubSidebarCollapsed()).toBe(false);
    expect(service.hasVisibleSubSidebar()).toBe(true);
    expect(service.canExpandSubSidebar()).toBe(false);

    service.collapseSubSidebar();
    expect(service.isSubSidebarCollapsed()).toBe(true);
    expect(service.hasVisibleSubSidebar()).toBe(false);
    expect(service.canExpandSubSidebar()).toBe(true);
    expect(localStorage.getItem('onevo.sub_sidebar_collapsed')).toBe('true');

    service.expandSubSidebar();
    expect(service.isSubSidebarCollapsed()).toBe(false);
    expect(service.hasVisibleSubSidebar()).toBe(true);
    expect(service.canExpandSubSidebar()).toBe(false);
    expect(localStorage.getItem('onevo.sub_sidebar_collapsed')).toBe('false');

    service.toggleSubSidebar();
    expect(service.isSubSidebarCollapsed()).toBe(true);
    expect(localStorage.getItem('onevo.sub_sidebar_collapsed')).toBe('true');
  });
});
