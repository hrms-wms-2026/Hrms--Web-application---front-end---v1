import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { SideNavbarComponent } from './side-navbar.component';
import { AuthStore } from '../../../core/auth/state/auth.store';

@Component({ standalone: true, template: '' })
class BlankComponent {}

function setup(permissions: string[], activeModules: string[]) {
  TestBed.configureTestingModule({
    imports: [SideNavbarComponent],
    providers: [
      provideRouter([{ path: '**', component: BlankComponent }]),
      { provide: AuthStore, useValue: { permissions: () => permissions, activeModules: () => activeModules } }
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
    expect(labels).toEqual(['Home']);
  });

  it('shows People/Calendar/Time Off/Attendance when their modules are active', () => {
    const fixture = setup([], ['core_hr', 'calendar', 'leave', 'time_attendance']);
    const labels = Array.from(fixture.nativeElement.querySelectorAll('.nav-rail-item span')).map((el) => (el as HTMLElement).textContent);
    expect(labels).toEqual(['Home', 'People', 'Calendar', 'Time Off', 'Attendance']);
  });

  it('hides Organization when org_structure is active but the user lacks org:read/org:manage', () => {
    const fixture = setup([], ['org_structure']);
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

  it('renders all 8 sidebar items in canonical order for a tenant owner with every Phase 1 module and org/roles permissions', () => {
    const fixture = setup(
      ['org:read', 'roles:manage'],
      ['worksync_foundation', 'core_hr', 'calendar', 'leave', 'time_attendance', 'org_structure']
    );
    const labels = Array.from(fixture.nativeElement.querySelectorAll('.nav-rail-item span')).map((el) => (el as HTMLElement).textContent);
    expect(labels).toEqual([
      'Home',
      'Work',
      'People',
      'Calendar',
      'Time Off',
      'Attendance',
      'Org',
      'Settings'
    ]);
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
});
