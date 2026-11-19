import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthStore } from '../../../core/auth/state/auth.store';
import { MobileSectionNavComponent } from './mobile-section-nav.component';

@Component({ standalone: true, template: '' })
class BlankComponent {}

describe('MobileSectionNavComponent', () => {
  let fixture: ComponentFixture<MobileSectionNavComponent>;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MobileSectionNavComponent],
      providers: [
        provideRouter([{ path: '**', component: BlankComponent }]),
        { provide: AuthStore, useValue: { permissions: () => ['roles:read', 'users:read'], activeModules: () => [] } }
      ]
    }).compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(MobileSectionNavComponent);
    fixture.detectChanges();
  });

  const el = (): HTMLElement => fixture.nativeElement;

  it('shows nothing on a page without sibling pages', () => {
    expect(el().querySelector('.back-bar')).toBeNull();
  });

  it('shows the page name in the back bar and lists the section pages from its title', async () => {
    await router.navigateByUrl('/settings/users');
    fixture.detectChanges();

    expect(el().querySelector('.back-bar__title')?.textContent).toContain('Users');
    expect(el().querySelector('.switcher')).toBeNull();

    (el().querySelector('.back-bar__switch') as HTMLButtonElement).click();
    fixture.detectChanges();

    const items = el().querySelectorAll('.switcher__item');
    expect(Array.from(items).map((item) => item.textContent?.trim())).toEqual(['Roles & Permissions', 'Users']);
    expect(el().querySelector('.switcher__item--current')?.textContent).toContain('Users');
  });

  it('closes the page switcher when a page is picked', async () => {
    await router.navigateByUrl('/settings/users');
    fixture.componentInstance.toggleSwitcher();
    fixture.detectChanges();

    (el().querySelector('.switcher__item') as HTMLAnchorElement).click();
    expect(fixture.componentInstance.switcherOpen()).toBe(false);
  });
});
