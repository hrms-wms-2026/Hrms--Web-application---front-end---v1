import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { ProfileMenuComponent } from './profile-menu.component';
import { ThemeStore } from '../../../../core/theme/state/theme.store';
import { THEME_PRESETS, ThemePresetId } from '../../../../core/theme/models/theme-preset.model';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { NotificationService } from '../../../../core/services/notification.service';
import { ProfileStore } from '@modules/profile/state/profile.store';

async function setup(overrides: { logoutResult?: boolean } = {}) {
  const presetSignal = signal<ThemePresetId>('default');
  const setPreset = vi.fn((preset: ThemePresetId) => presetSignal.set(preset));

  const logoutMock = vi.fn().mockResolvedValue(overrides.logoutResult ?? true);
  const navigateMock = vi.fn().mockResolvedValue(true);
  const notificationErrorMock = vi.fn();

  await TestBed.configureTestingModule({
    imports: [ProfileMenuComponent],
    providers: [
      { provide: ThemeStore, useValue: { preset: presetSignal, setPreset, mode: signal('light'), resolvedMode: signal('light'), setMode: vi.fn() } },
      { provide: AuthStore, useValue: { logout: logoutMock } },
      { provide: Router, useValue: { navigate: navigateMock } },
      { provide: NotificationService, useValue: { error: notificationErrorMock } },
      {
        provide: ProfileStore,
        useValue: {
          profile: signal(null),
          loading: signal(false),
          error: signal(null),
          saving: signal(false),
          saveError: signal(null),
          loadProfile: vi.fn()
        }
      }
    ]
  }).compileComponents();

  const fixture = TestBed.createComponent(ProfileMenuComponent);
  fixture.componentRef.setInput('userName', 'Asha Kumar');
  fixture.componentRef.setInput('email', 'asha@onevo.test');
  fixture.detectChanges();

  return { fixture, setPreset, presetSignal, logoutMock, navigateMock, notificationErrorMock };
}

describe('ProfileMenuComponent', () => {
  it('renders the avatar button as a closed, accessible menu trigger', async () => {
    const { fixture } = await setup();
    const trigger = fixture.nativeElement.querySelector('.profile-menu-trigger') as HTMLButtonElement;

    expect(trigger).toBeTruthy();
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(fixture.nativeElement.querySelector('[role="menu"]')).toBeFalsy();
  });

  it('shows the online badge while the browser is connected and hides it when it goes offline', async () => {
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    const { fixture } = await setup();
    const badge = () => fixture.nativeElement.querySelector('[data-testid="profile-online-badge"]');
    expect(badge()).toBeTruthy();

    onLine.mockReturnValue(false);
    window.dispatchEvent(new Event('offline'));
    fixture.detectChanges();
    expect(badge()).toBeNull();

    onLine.mockReturnValue(true);
    window.dispatchEvent(new Event('online'));
    fixture.detectChanges();
    expect(badge()).toBeTruthy();
    onLine.mockRestore();
  });

  it('keeps the closed profile trigger flat and the avatar-to-chevron spacing compact', async () => {
    const { fixture } = await setup();
    const trigger = fixture.nativeElement.querySelector('.profile-menu-trigger') as HTMLButtonElement;
    const chevron = trigger.querySelector('.profile-menu-chevron') as SVGElement;
    const styles = getComputedStyle(trigger);

    expect(styles.gap).toBe('2px');
    expect(styles.backgroundColor).toBe('rgba(0, 0, 0, 0)');
    expect(['', 'none']).toContain(styles.boxShadow);
    expect(getComputedStyle(chevron).width).toBe('12px');
  });

  it('renders a generic circular avatar fallback when no avatarUrl is provided', async () => {
    const { fixture } = await setup();
    const svg = fixture.nativeElement.querySelector('.avatar__icon, .avatar__fallback');
    expect(svg).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.avatar__image')).toBeFalsy();
  });

  it('renders profile image when avatarUrl is provided', async () => {
    const { fixture } = await setup();
    fixture.componentRef.setInput('avatarUrl', 'https://example.com/user.png');
    fixture.detectChanges();

    const img = fixture.nativeElement.querySelector('.avatar__image') as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.src).toBe('https://example.com/user.png');
  });

  it('opens profile popover on trigger click and displays user name and email inside the popover', async () => {
    const { fixture } = await setup();
    const trigger = fixture.debugElement.query(By.css('.profile-menu-trigger'));

    trigger.nativeElement.click();
    fixture.detectChanges();

    const popoverPanel = fixture.nativeElement.querySelector('.profile-popover-panel');
    expect(popoverPanel).toBeTruthy();

    const userName = fixture.nativeElement.querySelector('.profile-user-name');
    const userEmail = fixture.nativeElement.querySelector('.profile-user-email');

    expect(userName.textContent?.trim()).toBe('Asha Kumar');
    expect(userEmail.textContent?.trim()).toBe('asha@onevo.test');
  });

  it('renders My Profile, Appearance, and Log out action buttons with a divider before logout', async () => {
    const { fixture } = await setup();
    fixture.debugElement.query(By.css('.profile-menu-trigger')).nativeElement.click();
    fixture.detectChanges();

    const actionBtns = fixture.nativeElement.querySelectorAll('.profile-action-btn');
    expect(actionBtns.length).toBe(3);

    expect(actionBtns[0].textContent).toContain('My Profile');
    expect(actionBtns[1].textContent).toContain('Appearance');
    expect(actionBtns[2].textContent).toContain('Log out');

    const logoutIcon = actionBtns[2].querySelector('.action-icon');
    expect(logoutIcon).toBeTruthy();

    const divider = fixture.nativeElement.querySelector('.profile-actions-section .profile-popover-divider');
    expect(divider).toBeTruthy();
  });

  it('opens the Preferences modal on the Appearance tab by default', async () => {
    const { fixture } = await setup();
    const component = fixture.componentInstance;
    component.openPreferences();
    fixture.detectChanges();

    expect(component.activeTabId()).toBe('appearance');
  });

  it('opens the Profile tab with Personal Information selected when My Profile is clicked', async () => {
    const { fixture } = await setup();
    const component = fixture.componentInstance;
    component.openPreferences('profile');
    fixture.detectChanges();

    expect(component.activeTabId()).toBe('profile');
    expect(component.activeProfileSubTab()).toBe('personal');
  });

  it('opens preferences modal when Appearance action is clicked from popover', async () => {
    const { fixture } = await setup();

    fixture.debugElement.query(By.css('.profile-menu-trigger')).nativeElement.click();
    fixture.detectChanges();

    const actionBtns = fixture.nativeElement.querySelectorAll('.profile-action-btn');
    const appearanceBtn = Array.from(actionBtns).find((btn) =>
      (btn as HTMLElement).textContent?.includes('Appearance')
    ) as HTMLElement;
    appearanceBtn.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.profile-popover-panel')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('app-preferences-modal')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.preferences-container')).toBeTruthy();
  });

  it('allows selecting a theme preset from preferences modal which calls ThemeStore.setPreset', async () => {
    const { fixture, setPreset } = await setup();

    fixture.debugElement.query(By.css('.profile-menu-trigger')).nativeElement.click();
    fixture.detectChanges();

    const actionBtns = fixture.nativeElement.querySelectorAll('.profile-action-btn');
    const appearanceBtn = Array.from(actionBtns).find((btn) =>
      (btn as HTMLElement).textContent?.includes('Appearance')
    ) as HTMLElement;
    appearanceBtn.click();
    fixture.detectChanges();

    const options = fixture.nativeElement.querySelectorAll('[aria-label="Theme Presets"] [role="radio"]');
    expect(options.length).toBe(THEME_PRESETS.length);

    const emeraldOption = Array.from(options).find((el) =>
      (el as HTMLElement).textContent?.includes('Emerald')
    ) as HTMLElement;
    emeraldOption.click();

    expect(setPreset).toHaveBeenCalledWith('emerald');
  });

  it('calls AuthStore.logout and navigates to /auth/login on successful logout', async () => {
    const { fixture, logoutMock, navigateMock, notificationErrorMock } = await setup({ logoutResult: true });

    fixture.debugElement.query(By.css('.profile-menu-trigger')).nativeElement.click();
    fixture.detectChanges();

    const logoutBtn = fixture.nativeElement.querySelector('.profile-action-btn--logout') as HTMLButtonElement;
    expect(logoutBtn).toBeTruthy();

    logoutBtn.click();
    fixture.detectChanges();

    expect(logoutMock).toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.profile-popover-panel')).toBeFalsy();

    await fixture.whenStable();

    expect(navigateMock).toHaveBeenCalledWith(['/auth/login']);
    expect(notificationErrorMock).not.toHaveBeenCalled();
  });

  it('displays safe notification toast "Could not log out. Try again." and does not navigate when logout fails', async () => {
    const { fixture, logoutMock, navigateMock, notificationErrorMock } = await setup({ logoutResult: false });

    fixture.debugElement.query(By.css('.profile-menu-trigger')).nativeElement.click();
    fixture.detectChanges();

    const logoutBtn = fixture.nativeElement.querySelector('.profile-action-btn--logout') as HTMLButtonElement;
    logoutBtn.click();
    fixture.detectChanges();

    expect(logoutMock).toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.profile-popover-panel')).toBeFalsy();

    await fixture.whenStable();

    expect(navigateMock).not.toHaveBeenCalled();
    expect(notificationErrorMock).toHaveBeenCalledWith('Could not log out. Try again.');
  });
});
