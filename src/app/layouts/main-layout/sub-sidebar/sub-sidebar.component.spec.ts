import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NavigationStateService } from '../nav/navigation-state.service';
import { SubSidebarComponent } from './sub-sidebar.component';

describe('SubSidebarComponent', () => {
  it('renders the section label and one link per item', async () => {
    await TestBed.configureTestingModule({
      imports: [SubSidebarComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    const fixture = TestBed.createComponent(SubSidebarComponent);
    fixture.componentRef.setInput('sectionLabel', 'Settings');
    fixture.componentRef.setInput('items', [
      { id: 'settings-general', label: 'General Settings', path: '/settings/general' },
      { id: 'settings-roles', label: 'Roles & Permissions', path: '/settings/roles' }
    ]);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')?.textContent).toContain('Settings');
    const links = el.querySelectorAll('a');
    expect(links.length).toBe(2);
    expect(links[0].getAttribute('href')).toBe('/settings/general');
    expect(links[1].textContent).toContain('Roles & Permissions');
  });

  it('labels the nav landmark with the section name', async () => {
    await TestBed.configureTestingModule({
      imports: [SubSidebarComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    const fixture = TestBed.createComponent(SubSidebarComponent);
    fixture.componentRef.setInput('sectionLabel', 'Organization');
    fixture.componentRef.setInput('items', []);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('nav')?.getAttribute('aria-label')).toBe('Organization navigation');
  });

  it('renders the collapse button and calls collapseSubSidebar when clicked', async () => {
    await TestBed.configureTestingModule({
      imports: [SubSidebarComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    const fixture = TestBed.createComponent(SubSidebarComponent);
    fixture.componentRef.setInput('sectionLabel', 'Attendance');
    fixture.componentRef.setInput('items', []);
    fixture.detectChanges();

    const navState = TestBed.inject(NavigationStateService);
    const collapseBtn = fixture.nativeElement.querySelector('.sub-sidebar__collapse-btn') as HTMLButtonElement;
    expect(collapseBtn).toBeTruthy();
    expect(collapseBtn.getAttribute('aria-label')).toBe('Close sidebar');

    expect(navState.isSubSidebarCollapsed()).toBe(false);
    collapseBtn.click();
    expect(navState.isSubSidebarCollapsed()).toBe(true);
  });
});
