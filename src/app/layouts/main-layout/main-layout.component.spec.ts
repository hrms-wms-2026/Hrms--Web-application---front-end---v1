import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { MainLayoutComponent } from './main-layout.component';
import { AuthStore } from '../../core/auth/state/auth.store';
import { TrayPresenceStore } from '../../core/tray-presence/state/tray-presence.store';
import { NavigationStateService } from './nav/navigation-state.service';

const authStoreStub = {
  email: () => 'asha@onevo.test',
  authenticated: () => true,
  permissions: () => [] as string[],
  activeModules: () => [] as string[]
};

const connectedTrayPresenceStub = {
  start: () => undefined,
  canRenderProtectedContent: () => true,
  isBlocking: () => false
};

@Component({ standalone: true, template: '' })
class BlankRouteComponent {}

function authStoreWith(permissions: string[], activeModules: string[]) {
  return { email: () => 'asha@onevo.test', authenticated: () => true, permissions: () => permissions, activeModules: () => activeModules };
}

describe('MainLayoutComponent', () => {
  it('renders the top and side navbar shell without legacy branding or placeholder text', async () => {
    await TestBed.configureTestingModule({
      imports: [MainLayoutComponent],
      providers: [
        provideRouter([]),
        { provide: AuthStore, useValue: authStoreStub },
        { provide: TrayPresenceStore, useValue: connectedTrayPresenceStub }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(MainLayoutComponent);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-top-navbar')).toBeTruthy();
    expect(el.querySelector('app-side-navbar')).toBeTruthy();
    expect(el.textContent).not.toContain('ONEVO');
    expect(el.textContent).not.toContain('Navigation will be configured later');
  });

  it('passes the authenticated user email down to the top navbar profile popover', async () => {
    await TestBed.configureTestingModule({
      imports: [MainLayoutComponent],
      providers: [
        provideRouter([]),
        { provide: AuthStore, useValue: authStoreStub },
        { provide: TrayPresenceStore, useValue: connectedTrayPresenceStub }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(MainLayoutComponent);
    fixture.detectChanges();

    // Raw email should NOT be rendered in the shell topbar when popover is closed
    expect(fixture.nativeElement.textContent).not.toContain('asha@onevo.test');

    // Click profile avatar button to open popover
    const trigger = fixture.nativeElement.querySelector('.profile-menu-trigger') as HTMLButtonElement;
    expect(trigger).toBeTruthy();
    trigger.click();
    fixture.detectChanges();

    // User email is rendered inside the profile popover
    expect(fixture.nativeElement.textContent).toContain('asha@onevo.test');
  });

  it('mounts app-toast-host inside global-notification-container', async () => {
    await TestBed.configureTestingModule({
      imports: [MainLayoutComponent],
      providers: [
        provideRouter([]),
        { provide: AuthStore, useValue: authStoreStub },
        { provide: TrayPresenceStore, useValue: connectedTrayPresenceStub }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(MainLayoutComponent);
    fixture.detectChanges();

    const container = fixture.nativeElement.querySelector('#global-notification-container');
    expect(container).toBeTruthy();
    expect(container.querySelector('app-toast-host')).toBeTruthy();
  });

  it('renders the sub-sidebar filtered to permitted children when navigated into Settings', async () => {
    await TestBed.configureTestingModule({
      imports: [MainLayoutComponent],
      providers: [
        provideRouter([{ path: '**', component: BlankRouteComponent }]),
        { provide: AuthStore, useValue: authStoreWith(['roles:manage'], []) },
        { provide: TrayPresenceStore, useValue: connectedTrayPresenceStub }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(MainLayoutComponent);
    const router = TestBed.inject(Router);
    fixture.detectChanges();

    await router.navigateByUrl('/settings/roles');
    fixture.detectChanges();

    const subLinks = Array.from(fixture.nativeElement.querySelectorAll('app-sub-sidebar a')).map(
      (el) => (el as HTMLElement).textContent
    );
    expect(subLinks).toEqual(['Roles & Permissions']);
  });

  it('renders Organization sub-sidebar with Departments and Positions when navigated into /organization/departments', async () => {
    await TestBed.configureTestingModule({
      imports: [MainLayoutComponent],
      providers: [
        provideRouter([{ path: '**', component: BlankRouteComponent }]),
        { provide: AuthStore, useValue: authStoreWith(['org:read'], ['org_structure']) },
        { provide: TrayPresenceStore, useValue: connectedTrayPresenceStub }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(MainLayoutComponent);
    const router = TestBed.inject(Router);
    fixture.detectChanges();

    await router.navigateByUrl('/organization/departments');
    fixture.detectChanges();

    const subLinks = Array.from(fixture.nativeElement.querySelectorAll('app-sub-sidebar a')).map(
      (el) => (el as HTMLElement).textContent
    );
    expect(subLinks).toEqual(['Departments', 'Positions']);
  });

  it('renders no sub-sidebar when the active item has no permitted children', async () => {
    await TestBed.configureTestingModule({
      imports: [MainLayoutComponent],
      providers: [
        provideRouter([{ path: '**', component: BlankRouteComponent }]),
        { provide: AuthStore, useValue: authStoreStub },
        { provide: TrayPresenceStore, useValue: connectedTrayPresenceStub }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(MainLayoutComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-sub-sidebar')).toBeNull();
  });

  it('hides the sub-sidebar when collapsed via NavigationStateService and expands on keyboard shortcut Ctrl+\\', async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [MainLayoutComponent],
      providers: [
        provideRouter([{ path: '**', component: BlankRouteComponent }]),
        { provide: AuthStore, useValue: authStoreWith(['org:read'], ['org_structure']) },
        { provide: TrayPresenceStore, useValue: connectedTrayPresenceStub }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(MainLayoutComponent);
    const router = TestBed.inject(Router);
    const navState = TestBed.inject(NavigationStateService);
    fixture.detectChanges();

    await router.navigateByUrl('/organization/departments');
    fixture.detectChanges();

    // Visible initially
    expect(fixture.nativeElement.querySelector('app-sub-sidebar')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.main-layout--has-sub-sidebar')).toBeTruthy();

    // Collapse
    navState.collapseSubSidebar();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-sub-sidebar')).toBeNull();
    expect(fixture.nativeElement.querySelector('.main-layout--has-sub-sidebar')).toBeNull();

    // Trigger Ctrl+\ shortcut
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '\\', ctrlKey: true }));
    fixture.detectChanges();

    expect(navState.isSubSidebarCollapsed()).toBe(false);
    expect(fixture.nativeElement.querySelector('app-sub-sidebar')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.main-layout--has-sub-sidebar')).toBeTruthy();
  });
});
