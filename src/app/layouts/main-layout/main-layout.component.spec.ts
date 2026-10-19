import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { MainLayoutComponent } from './main-layout.component';
import { AuthStore } from '../../core/auth/state/auth.store';
import { TrayPresenceStore } from '../../core/tray-presence/state/tray-presence.store';
import { NavigationStateService } from './nav/navigation-state.service';
import { ProfileStore } from '@modules/profile/state/profile.store';
import { FileApiService } from '../../shared/data-access/file-api.service';
import { MyProfile } from '@modules/profile/models/profile.model';

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

const emptyProfileStoreStub = {
  profile: signal<MyProfile | null>(null),
  loadProfile: vi.fn()
};

const fileApiStub = {
  getFileUrl: (fileId: string) => `https://api.test/files/${fileId}`
};

@Component({ standalone: true, template: '' })
class BlankRouteComponent {}

function authStoreWith(permissions: string[], activeModules: string[]) {
  return {
    email: () => 'asha@onevo.test', authenticated: () => true, permissions: () => permissions, activeModules: () => activeModules,
    managesPeople: () => false
  };
}

describe('MainLayoutComponent', () => {
  it('renders the top and side navbar shell without legacy branding or placeholder text', async () => {
    await TestBed.configureTestingModule({
      imports: [MainLayoutComponent],
      providers: [
        provideRouter([]),
        { provide: AuthStore, useValue: authStoreStub },
        { provide: TrayPresenceStore, useValue: connectedTrayPresenceStub },
        { provide: ProfileStore, useValue: emptyProfileStoreStub },
        { provide: FileApiService, useValue: fileApiStub }
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
        { provide: TrayPresenceStore, useValue: connectedTrayPresenceStub },
        { provide: ProfileStore, useValue: emptyProfileStoreStub },
        { provide: FileApiService, useValue: fileApiStub }
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

  it('passes the profile photo URL and name from ProfileStore down to the top navbar profile popover', async () => {
    const profile = {
      personalInformation: { firstName: 'Asha', lastName: 'Kumar', avatarFileId: 'file-77' }
    } as MyProfile;

    await TestBed.configureTestingModule({
      imports: [MainLayoutComponent],
      providers: [
        provideRouter([]),
        { provide: AuthStore, useValue: authStoreStub },
        { provide: TrayPresenceStore, useValue: connectedTrayPresenceStub },
        { provide: ProfileStore, useValue: { profile: signal<MyProfile | null>(profile), loadProfile: vi.fn() } },
        { provide: FileApiService, useValue: fileApiStub }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(MainLayoutComponent);
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector('.profile-menu-trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    const img = fixture.nativeElement.querySelector('.avatar__image') as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.src).toBe('https://api.test/files/file-77');

    const userName = fixture.nativeElement.querySelector('.profile-user-name');
    expect(userName.textContent?.trim()).toBe('Asha Kumar');
  });

  it('mounts app-toast-host inside global-notification-container', async () => {
    await TestBed.configureTestingModule({
      imports: [MainLayoutComponent],
      providers: [
        provideRouter([]),
        { provide: AuthStore, useValue: authStoreStub },
        { provide: TrayPresenceStore, useValue: connectedTrayPresenceStub },
        { provide: ProfileStore, useValue: emptyProfileStoreStub },
        { provide: FileApiService, useValue: fileApiStub }
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
        { provide: TrayPresenceStore, useValue: connectedTrayPresenceStub },
        { provide: ProfileStore, useValue: emptyProfileStoreStub },
        { provide: FileApiService, useValue: fileApiStub }
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
        { provide: TrayPresenceStore, useValue: connectedTrayPresenceStub },
        { provide: ProfileStore, useValue: emptyProfileStoreStub },
        { provide: FileApiService, useValue: fileApiStub }
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
    // The People section is filtered out entirely (no core_hr), so only the Organization title shows.
    const titles = Array.from(fixture.nativeElement.querySelectorAll('app-sub-sidebar .sub-sidebar__section-title')).map(
      (el) => (el as HTMLElement).textContent
    );
    expect(titles).toEqual(['Organization']);
  });

  it('renders Org with an Organization and a People section when the user has both', async () => {
    await TestBed.configureTestingModule({
      imports: [MainLayoutComponent],
      providers: [
        provideRouter([{ path: '**', component: BlankRouteComponent }]),
        { provide: AuthStore, useValue: authStoreWith(['org:read', 'employees:write'], ['org_structure', 'core_hr']) },
        { provide: TrayPresenceStore, useValue: connectedTrayPresenceStub },
        { provide: ProfileStore, useValue: emptyProfileStoreStub },
        { provide: FileApiService, useValue: fileApiStub }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(MainLayoutComponent);
    const router = TestBed.inject(Router);
    fixture.detectChanges();

    await router.navigateByUrl('/people/employees');
    fixture.detectChanges();

    const sections = Array.from(fixture.nativeElement.querySelectorAll('app-sub-sidebar .sub-sidebar__section')).map((section) => ({
      title: (section as HTMLElement).querySelector('.sub-sidebar__section-title')?.textContent,
      links: Array.from((section as HTMLElement).querySelectorAll('a')).map((a) => a.textContent)
    }));
    expect(sections).toEqual([
      { title: 'Organization', links: ['Departments', 'Positions'] },
      { title: 'People', links: ['Employees', 'Checklists', 'Offboarding'] }
    ]);
    expect(fixture.nativeElement.querySelector('app-sub-sidebar .sub-sidebar__heading')?.textContent).toBe('Org');
  });

  it('renders no sub-sidebar when the active item has no permitted children', async () => {
    await TestBed.configureTestingModule({
      imports: [MainLayoutComponent],
      providers: [
        provideRouter([{ path: '**', component: BlankRouteComponent }]),
        { provide: AuthStore, useValue: authStoreStub },
        { provide: TrayPresenceStore, useValue: connectedTrayPresenceStub },
        { provide: ProfileStore, useValue: emptyProfileStoreStub },
        { provide: FileApiService, useValue: fileApiStub }
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
        { provide: TrayPresenceStore, useValue: connectedTrayPresenceStub },
        { provide: ProfileStore, useValue: emptyProfileStoreStub },
        { provide: FileApiService, useValue: fileApiStub }
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
