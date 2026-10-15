import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { SideNavbarComponent } from './side-navbar.component';
import { AuthStore } from '../../../core/auth/state/auth.store';
import { environment } from '../../../../environments/environment';
import { LegalEntityApiService } from '../../../modules/organization/data-access/legal-entity-api.service';
import { LegalEntityStore } from '../../../modules/organization/state/legal-entity.store';
import { NavigationStateService } from '../nav/navigation-state.service';
import { signal } from '@angular/core';
import { InboxStore } from '../../../modules/inbox/state/inbox.store';

@Component({ standalone: true, template: '' })
class BlankComponent {}

const inboxBadge = signal('');

function setup(permissions: string[], activeModules: string[]) {
  TestBed.configureTestingModule({
    imports: [SideNavbarComponent],
    providers: [
      provideRouter([{ path: '**', component: BlankComponent }]),
      { provide: AuthStore, useValue: { permissions: () => permissions, activeModules: () => activeModules } },
      { provide: InboxStore, useValue: { badgeLabel: inboxBadge } }
    ]
  });
  const fixture = TestBed.createComponent(SideNavbarComponent);
  fixture.detectChanges();
  return fixture;
}

describe('SideNavbarComponent', () => {
  it('always shows Home for an authenticated user with no other modules/permissions', () => {
    const fixture = setup([], []);
    const labels = Array.from(fixture.nativeElement.querySelectorAll('.nav-rail-item span')).map((el) => (el as HTMLElement).textContent);
    expect(labels).toEqual(['Home', 'Inbox']);
  });

  it('shows Calendar/Time Off/Attendance when their modules and self-service access are active, but not People without an employees permission', () => {
    // Regression: "People" used to show from core_hr alone, because its "Employees" child had
    // no permission gate of its own - self-service attendance/leave access is not an employees
    // permission, and the real /people route guard requires employees:read or employees:write,
    // so People must stay hidden for this user even though core_hr is active.
    const fixture = setup(['attendance:read-own', 'leave:read-own'], ['core_hr', 'calendar', 'leave', 'time_attendance']);
    const labels = Array.from(fixture.nativeElement.querySelectorAll('.nav-rail-item span')).map((el) => (el as HTMLElement).textContent);
    expect(labels).toEqual(['Home', 'Inbox', 'Calendar', 'Time Off', 'Attendance']);
  });

  it('shows People once the user also holds employees:read, alongside self-service access', () => {
    const fixture = setup(
      ['attendance:read-own', 'leave:read-own', 'employees:read'],
      ['core_hr', 'calendar', 'leave', 'time_attendance']
    );
    const labels = Array.from(fixture.nativeElement.querySelectorAll('.nav-rail-item span')).map((el) => (el as HTMLElement).textContent);
    expect(labels).toEqual(['Home', 'Inbox', 'People', 'Calendar', 'Time Off', 'Attendance']);
  });

  it('hides Organization when org_structure is active but the user lacks org:read', () => {
    const fixture = setup([], ['org_structure']);
    const labels = Array.from(fixture.nativeElement.querySelectorAll('.nav-rail-item span')).map((el) => (el as HTMLElement).textContent);
    expect(labels).not.toContain('Org');
  });

  it('hides Organization when the user has org:manage but lacks org:read', () => {
    const fixture = setup(['org:manage'], ['org_structure']);
    const labels = Array.from(fixture.nativeElement.querySelectorAll('.nav-rail-item span')).map((el) => (el as HTMLElement).textContent);
    expect(labels).not.toContain('Org');
  });

  it('shows Organization (rendered as "Org") when org_structure is active and the user has org:read', () => {
    const fixture = setup(['org:read'], ['org_structure']);
    const labels = Array.from(fixture.nativeElement.querySelectorAll('.nav-rail-item span')).map((el) => (el as HTMLElement).textContent);
    expect(labels).toContain('Org');
  });

  it('hides Organization when the user has org:read but org_structure is not an active module', () => {
    const fixture = setup(['org:read'], []);
    const labels = Array.from(fixture.nativeElement.querySelectorAll('.nav-rail-item span')).map((el) => (el as HTMLElement).textContent);
    expect(labels).not.toContain('Org');
  });

  it('renders all 9 sidebar items in canonical order for a tenant owner with every Phase 1 module and org/roles permissions', () => {
    const fixture = setup(
      ['org:read', 'roles:manage', 'attendance:read', 'leave:read-own'],
      ['worksync_foundation', 'core_hr', 'calendar', 'leave', 'time_attendance', 'org_structure']
    );
    const labels = Array.from(fixture.nativeElement.querySelectorAll('.nav-rail-item span')).map((el) => (el as HTMLElement).textContent);
    expect(labels).toEqual([
      'Home',
      'Work',
      'Inbox',
      'People',
      'Calendar',
      'Time Off',
      'Attendance',
      'Org',
      'Settings'
    ]);
  });

  it('shows the Inbox right after Work with its badge (pending requests + unread messages)', () => {
    inboxBadge.set('9+');
    const fixture = setup([], ['worksync_foundation']);
    const links = Array.from(fixture.nativeElement.querySelectorAll('.nav-rail-item')) as HTMLElement[];
    const inbox = links.find((l) => l.textContent?.includes('Inbox'));

    expect(links.map((l) => l.querySelector('span')?.textContent)).toEqual(['Home', 'Work', 'Inbox']);
    expect(inbox?.getAttribute('href')).toBe('/inbox');
    expect(inbox?.querySelector('.nav-rail-item__badge')?.textContent?.trim()).toBe('9+');
    inboxBadge.set('');
  });

  it('hides the Inbox badge when there is nothing waiting', () => {
    inboxBadge.set('');
    const fixture = setup([], ['worksync_foundation']);
    expect(fixture.nativeElement.querySelector('.nav-rail-item__badge')).toBeNull();
  });

  it('shows Settings when the user has roles:manage, even with no active_modules at all', () => {
    const fixture = setup(['roles:manage'], []);
    const labels = Array.from(fixture.nativeElement.querySelectorAll('.nav-rail-item span')).map((el) => (el as HTMLElement).textContent);
    expect(labels).toContain('Settings');
  });

  it('hides Settings entirely when the user has none of the confirmed Settings permissions', () => {
    const fixture = setup(['core_hr:read'], ['core_hr']);
    const labels = Array.from(fixture.nativeElement.querySelectorAll('.nav-rail-item span')).map((el) => (el as HTMLElement).textContent);
    expect(labels).not.toContain('Settings');
  });

  it('marks the active rail item when navigated into Settings', async () => {
    const fixture = setup(['roles:manage'], []);
    const router = TestBed.inject(Router);

    await router.navigateByUrl('/settings/roles');
    fixture.detectChanges();

    const activeLink = fixture.nativeElement.querySelector('.nav-rail-item--active');
    expect(activeLink?.textContent).toContain('Settings');
  });

  it('marks the active rail item when navigated into /organization/departments', async () => {
    const fixture = setup(['org:read'], ['org_structure']);
    const router = TestBed.inject(Router);

    await router.navigateByUrl('/organization/departments');
    fixture.detectChanges();

    const activeLink = fixture.nativeElement.querySelector('.nav-rail-item--active');
    expect(activeLink?.textContent).toContain('Org');
  });

  it('shows the sidebar-style initial tile when no company is selected', () => {
    const fixture = setup([], []);
    const initial = fixture.nativeElement.querySelector('.company-logo-tile__initial');
    expect(initial?.textContent?.trim()).toBe('O');
  });

  it('keeps the workspace-name tooltip on the company tile (now set by the shared component)', () => {
    const fixture = setup([], []);
    const tile = fixture.nativeElement.querySelector('.company-logo-tile');
    expect(tile.getAttribute('title')).toBe('Workspace');
  });

  it('renders the company logo image via the shared tile when a company with a logo is selected', () => {
    TestBed.configureTestingModule({
      imports: [SideNavbarComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: '**', component: BlankComponent }]),
        { provide: AuthStore, useValue: { permissions: () => [], activeModules: () => [] } },
        {
          provide: LegalEntityStore,
          useValue: {
            selectedLegalEntity: () => ({
              id: 'co-1',
              name: 'Acme Corp',
              companyCode: 'ACME',
              logoFileId: 'file-9',
              isActive: true,
              isPrimary: true
            })
          }
        }
      ]
    });
    const fixture = TestBed.createComponent(SideNavbarComponent);
    fixture.detectChanges();

    const img: HTMLImageElement = fixture.nativeElement.querySelector('.company-logo-tile__img');
    expect(img).toBeTruthy();
    expect(img.src).toBe(`${environment.apiUrl}/org/legal-entities/co-1/logo?v=file-9`);
  });

  it('resolves the same logo URL as General Settings (LegalEntityApiService.getLogoUrl) for the same company/logo id', () => {
    TestBed.configureTestingModule({
      imports: [SideNavbarComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: '**', component: BlankComponent }]),
        { provide: AuthStore, useValue: { permissions: () => [], activeModules: () => [] } },
        {
          provide: LegalEntityStore,
          useValue: {
            selectedLegalEntity: () => ({
              id: 'co-1',
              name: 'Acme Corp',
              companyCode: 'ACME',
              logoFileId: 'file-9',
              isActive: true,
              isPrimary: true
            })
          }
        }
      ]
    });
    const fixture = TestBed.createComponent(SideNavbarComponent);
    fixture.detectChanges();

    const legalEntityApi = TestBed.inject(LegalEntityApiService);
    const expectedUrl = legalEntityApi.getLogoUrl('co-1', 'file-9');

    const img: HTMLImageElement = fixture.nativeElement.querySelector('.company-logo-tile__img');
    expect(img.src).toBe(expectedUrl);
  });

  it('renders expand button when active section has children and sub-sidebar is collapsed, and expands on click', async () => {
    localStorage.clear();
    const fixture = setup(['attendance:read-own', 'attendance:write-own', 'attendance:read', 'attendance:approve'], ['time_attendance']);
    const router = TestBed.inject(Router);
    const navState = TestBed.inject(NavigationStateService);

    await router.navigateByUrl('/attendance/overview');
    fixture.detectChanges();

    // Initially not collapsed
    expect(fixture.nativeElement.querySelector('.nav-rail__expand-btn')).toBeNull();

    // Collapse sub-sidebar
    navState.collapseSubSidebar();
    fixture.detectChanges();

    const expandBtn = fixture.nativeElement.querySelector('.nav-rail__expand-btn') as HTMLButtonElement;
    expect(expandBtn).toBeTruthy();
    expect(expandBtn.getAttribute('aria-label')).toBe('Open sidebar');

    // Click expand
    expandBtn.click();
    fixture.detectChanges();

    expect(navState.isSubSidebarCollapsed()).toBe(false);
    expect(fixture.nativeElement.querySelector('.nav-rail__expand-btn')).toBeNull();
  });
});
