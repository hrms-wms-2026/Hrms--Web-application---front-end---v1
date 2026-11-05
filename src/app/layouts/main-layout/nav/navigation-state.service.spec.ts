import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthStore } from '../../../core/auth/state/auth.store';
import { signal } from '@angular/core';
import { PlannerAvailability, PlannerAvailabilityService } from '../../../modules/work/planner/state/planner-availability.service';
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

  it('keeps Attendance active with no sub-sidebar (it is one page), including with query parameters', async () => {
    await router.navigateByUrl('/attendance?openCorrection=today');

    expect(service.activeItem()?.id).toBe('time-attendance');
    expect(service.activeChildren()).toEqual([]);
    expect(service.hasSubSidebar()).toBe(false);
  });

  it('opens Settings with Monitoring in its sub-sidebar at /settings/monitoring', async () => {
    await router.navigateByUrl('/settings/monitoring');

    expect(service.activeItem()?.id).toBe('settings');
    expect(service.activeChildren().map((c) => c.id)).toEqual(['settings-clock-in-policy', 'settings-monitoring']);
  });

  it('hides the sub-sidebar for a section with no child pages (Time Off is one hub)', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', component: BlankComponent }]),
        { provide: AuthStore, useValue: { permissions: () => ['leave:read-own'], activeModules: () => ['leave'] } }
      ]
    });
    const single = TestBed.inject(NavigationStateService);
    await TestBed.inject(Router).navigateByUrl('/time-off');

    expect(single.activeChildren()).toEqual([]);
    expect(single.hasSubSidebar()).toBe(false);
    expect(single.hasVisibleSubSidebar()).toBe(false);
  });

  it('manages sub-sidebar collapsed and expanded states and persists to localStorage', async () => {
    await router.navigateByUrl('/settings/monitoring');

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

  it('shows every module on the mobile bar, with no More, when five or fewer are reachable', () => {
    expect(service.hasMobileMore()).toBe(false);
    expect(service.mobileBarItems().map((item) => item.id)).toEqual(['home', 'inbox', 'time-attendance', 'settings']);
    expect(service.mobileMoreItems()).toEqual([]);
  });

  describe('mobile bar with More', () => {
    let full: NavigationStateService;
    let fullRouter: Router;
    const ids = (items: readonly { id: string }[]): string[] => items.map((item) => item.id);
    const item = (id: string) => full.visibleItems().find((candidate) => candidate.id === id)!;

    beforeEach(() => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideRouter([{ path: '**', component: BlankComponent }]),
          {
            provide: AuthStore,
            useValue: {
              permissions: () => ['leave:read', 'attendance:read', 'org:read', 'roles:read', 'calendar:read'],
              activeModules: () => ['tasks', 'calendar', 'leave', 'time_attendance', 'org_structure']
            }
          }
        ]
      });
      full = TestBed.inject(NavigationStateService);
      fullRouter = TestBed.inject(Router);
    });

    it('keeps Home and the first three modules on the bar in rail order and puts the rest behind More', () => {
      expect(full.hasMobileMore()).toBe(true);
      expect(ids(full.mobileBarItems())).toEqual(['home', 'work', 'inbox', 'calendar']);
      expect(ids(full.mobileMoreItems())).toEqual(['time-off', 'time-attendance', 'organization', 'settings']);
    });

    it('moves a module opened from More onto the bar, in rail order, in place of the one opened longest ago', async () => {
      await fullRouter.navigateByUrl('/work');
      await fullRouter.navigateByUrl('/inbox');
      await fullRouter.navigateByUrl('/settings/roles');

      expect(ids(full.mobileBarItems())).toEqual(['home', 'work', 'inbox', 'settings']);
      expect(ids(full.mobileMoreItems())).toContain('calendar');

      await fullRouter.navigateByUrl('/time-off/requests');
      expect(ids(full.mobileBarItems())).toEqual(['home', 'inbox', 'time-off', 'settings']);
    });

    it('keeps pinned modules on the bar, so a module opened from More stays behind it once three are pinned', async () => {
      full.togglePin(item('work'));
      full.togglePin(item('inbox'));
      full.togglePin(item('organization'));

      expect(ids(full.mobileBarItems())).toEqual(['home', 'work', 'inbox', 'organization']);
      expect(full.canPin(item('settings'))).toBe(false);
      expect(JSON.parse(localStorage.getItem('onevo.mobile_nav_pinned')!)).toEqual(['work', 'inbox', 'organization']);

      await fullRouter.navigateByUrl('/settings/roles');
      expect(ids(full.mobileBarItems())).toEqual(['home', 'work', 'inbox', 'organization']);
      expect(ids(full.mobileMoreItems())).toContain('settings');

      full.togglePin(item('inbox'));
      expect(full.canPin(item('settings'))).toBe(true);
    });

    it('never lets Home be pinned', () => {
      expect(full.canPin(item('home'))).toBe(false);
      full.togglePin(item('home'));
      expect(full.pinnedIds()).toEqual([]);
    });
  });

  describe('Planner = Calendar', () => {
    const state = signal<PlannerAvailability>('off');

    beforeEach(() => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideRouter([{ path: '**', component: BlankComponent }]),
          { provide: AuthStore, useValue: { permissions: () => ['calendar:read'], activeModules: () => ['calendar', 'worksync_foundation',
            'projects', 'objectives_milestones', 'tasks', 'boards', 'planning_sprints'] } },
          { provide: PlannerAvailabilityService, useValue: { state } },
        ],
      });
      service = TestBed.inject(NavigationStateService);
      router = TestBed.inject(Router);
    });

    const calendarItems = () => service.visibleItems().filter((item) => item.id === 'calendar' || item.id === ('planner' as never));

    it('shows one item, "Calendar" at /calendar, while the planner is off', () => {
      state.set('off');
      expect(calendarItems().map((i) => [i.label, i.path])).toEqual([['Calendar', '/calendar']]);
    });

    it('shows one item, "Planner" at /planner, while it is on, still active on /calendar links', async () => {
      state.set('on');
      expect(calendarItems().map((i) => [i.label, i.path])).toEqual([['Planner', '/planner']]);

      await router.navigateByUrl('/calendar?connected=google');
      expect(service.activeItem()?.label).toBe('Planner');
    });
  });
});
