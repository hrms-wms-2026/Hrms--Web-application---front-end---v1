import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthStore } from '../../../core/auth/state/auth.store';
import { InboxStore } from '../../../modules/inbox/state/inbox.store';
import { MobileBottomNavComponent } from './mobile-bottom-nav.component';

@Component({ standalone: true, template: '' })
class BlankComponent {}

describe('MobileBottomNavComponent', () => {
  let fixture: ComponentFixture<MobileBottomNavComponent>;
  let router: Router;

  async function setUp(permissions: string[], activeModules: string[]): Promise<void> {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [MobileBottomNavComponent],
      providers: [
        provideRouter([{ path: '**', component: BlankComponent }]),
        { provide: AuthStore, useValue: { permissions: () => permissions, activeModules: () => activeModules } },
        { provide: InboxStore, useValue: { badgeLabel: signal('3') } }
      ]
    }).compileComponents();
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(MobileBottomNavComponent);
    fixture.detectChanges();
  }

  const el = (): HTMLElement => fixture.nativeElement;
  const barLabels = (): (string | null)[] =>
    Array.from(el().querySelectorAll('.mobile-nav-item')).map((item) => item.getAttribute('aria-label'));

  describe('with every module', () => {
    beforeEach(() =>
      setUp(['leave:read', 'attendance:read', 'org:read', 'roles:read', 'calendar:read'], ['tasks', 'calendar', 'leave', 'time_attendance', 'org_structure'])
    );

    it('shows icons only, Home first, and a More button', () => {
      expect(barLabels()).toEqual(['Home', 'Work', 'Inbox', 'Calendar', 'More']);
      expect(el().querySelector('.mobile-nav-item')?.textContent?.trim()).toBe('');
      expect(el().querySelector('.mobile-nav-item__badge')?.textContent).toBe('3');
    });

    it('lists the other modules, with labels and pins, in the More sheet, and the bar modules only when asked', () => {
      (el().querySelector('[aria-label="More"]') as HTMLButtonElement).click();
      fixture.detectChanges();

      const labels = (): (string | null)[] => Array.from(el().querySelectorAll('.more-row__label')).map((label) => label.textContent);
      expect(labels()).toEqual(['Time Off', 'Attendance', 'Org', 'Settings']);
      expect(el().querySelectorAll('.more-row__pin').length).toBe(4);

      (el().querySelector('[aria-label="Show modules on your bar"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(labels()).toEqual(['Time Off', 'Attendance', 'Org', 'Settings', 'Work', 'Inbox', 'Calendar']);

      fixture.componentInstance.closeMore();
      fixture.componentInstance.toggleMore();
      fixture.detectChanges();
      expect(labels().length).toBe(4);
    });

    it('shows the label under the active icon only', async () => {
      await router.navigateByUrl('/work');
      fixture.detectChanges();

      const shown = Array.from(el().querySelectorAll('.mobile-nav-item__label')).map((label) => label.textContent);
      expect(shown).toEqual(['Work']);
    });

    it('lights More while the page open is one of its modules', async () => {
      await router.navigateByUrl('/time-off/types');
      fixture.detectChanges();
      // Time Off moves onto the bar when there is an unpinned slot, so More is lit only once all slots are pinned.
      expect(fixture.componentInstance.moreActive()).toBe(false);

      fixture.componentInstance.togglePin(fixture.componentInstance.barItems()[1]);
      fixture.componentInstance.togglePin(fixture.componentInstance.barItems()[2]);
      fixture.componentInstance.togglePin(fixture.componentInstance.barItems()[3]);
      await router.navigateByUrl('/settings/roles');
      fixture.detectChanges();

      expect(fixture.componentInstance.moreActive()).toBe(true);
      expect(el().querySelector('[aria-label="More"]')?.classList).toContain('mobile-nav-item--active');
    });
  });

  it('has no More when five or fewer modules are reachable', async () => {
    await setUp([], []);
    expect(barLabels()).not.toContain('More');
  });
});
