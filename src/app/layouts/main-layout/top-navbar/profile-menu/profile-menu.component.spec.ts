import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { ProfileMenuComponent } from './profile-menu.component';
import { ThemeStore } from '../../../../core/theme/state/theme.store';
import { ThemePresetId } from '../../../../core/theme/models/theme-preset.model';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { NotificationService } from '../../../../core/services/notification.service';

function setup(overrides: { logoutResult?: boolean } = {}) {
  const presetSignal = signal<ThemePresetId>('default');
  const setPreset = vi.fn((preset: ThemePresetId) => presetSignal.set(preset));

  const logoutMock = vi.fn().mockResolvedValue(overrides.logoutResult ?? true);
  const navigateMock = vi.fn().mockResolvedValue(true);
  const notificationErrorMock = vi.fn();

  TestBed.configureTestingModule({
    imports: [ProfileMenuComponent],
    providers: [
      { provide: ThemeStore, useValue: { preset: presetSignal, setPreset } },
      { provide: AuthStore, useValue: { logout: logoutMock } },
      { provide: Router, useValue: { navigate: navigateMock } },
      { provide: NotificationService, useValue: { error: notificationErrorMock } }
    ]
  });

  const fixture = TestBed.createComponent(ProfileMenuComponent);
  fixture.componentRef.setInput('userName', 'Asha Kumar');
  fixture.componentRef.setInput('email', 'asha@onevo.test');
  fixture.detectChanges();

  return { fixture, setPreset, presetSignal, logoutMock, navigateMock, notificationErrorMock };
}

describe('ProfileMenuComponent', () => {
  it('renders the avatar button as a closed, accessible menu trigger', () => {
    const { fixture } = setup();
    const trigger = fixture.nativeElement.querySelector('.profile-menu-trigger') as HTMLButtonElement;

    expect(trigger).toBeTruthy();
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(fixture.nativeElement.querySelector('[role="menu"]')).toBeFalsy();
  });

  it('renders a generic circular avatar fallback when no avatarUrl is provided', () => {
    const { fixture } = setup();
    const svg = fixture.nativeElement.querySelector('.avatar__icon, .avatar__fallback');
    expect(svg).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.avatar__image')).toBeFalsy();
  });

  it('renders profile image when avatarUrl is provided', () => {
    const { fixture } = setup();
    fixture.componentRef.setInput('avatarUrl', 'https://example.com/user.png');
    fixture.detectChanges();

    const img = fixture.nativeElement.querySelector('.avatar__image') as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.src).toBe('https://example.com/user.png');
  });

  it('opens profile popover on trigger click and displays user name and email inside the popover', () => {
    const { fixture } = setup();
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

  it('renders "Log out" button with icon below Appearance separated by a divider', () => {
    const { fixture } = setup();
    fixture.debugElement.query(By.css('.profile-menu-trigger')).nativeElement.click();
    fixture.detectChanges();

    const actionBtns = fixture.nativeElement.querySelectorAll('.profile-action-btn');
    expect(actionBtns.length).toBe(2);

    expect(actionBtns[0].textContent).toContain('Appearance');
    expect(actionBtns[1].textContent).toContain('Log out');

    const logoutIcon = actionBtns[1].querySelector('.action-icon');
    expect(logoutIcon).toBeTruthy();

    const divider = fixture.nativeElement.querySelector('.profile-actions-section .profile-popover-divider');
    expect(divider).toBeTruthy();
  });

  it('opens preferences modal when Appearance action is clicked from popover', () => {
    const { fixture } = setup();

    // Open popover
    fixture.debugElement.query(By.css('.profile-menu-trigger')).nativeElement.click();
    fixture.detectChanges();

    // Click Appearance
    const appearanceBtn = fixture.debugElement.query(By.css('.profile-action-btn'));
    expect(appearanceBtn.nativeElement.textContent).toContain('Appearance');
    appearanceBtn.nativeElement.click();
    fixture.detectChanges();

    // Preferences modal should be open and popover should close
    expect(fixture.nativeElement.querySelector('.profile-popover-panel')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('app-preferences-modal')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.preferences-container')).toBeTruthy();
  });

  it('allows selecting a theme preset from preferences modal which calls ThemeStore.setPreset', () => {
    const { fixture, setPreset } = setup();

    // Open popover then preferences modal
    fixture.debugElement.query(By.css('.profile-menu-trigger')).nativeElement.click();
    fixture.detectChanges();
    fixture.debugElement.query(By.css('.profile-action-btn')).nativeElement.click();
    fixture.detectChanges();

    const options = fixture.nativeElement.querySelectorAll('[role="radio"]');
    expect(options.length).toBe(5);

    const emeraldOption = Array.from(options).find((el) =>
      (el as HTMLElement).textContent?.includes('Emerald')
    ) as HTMLElement;
    emeraldOption.click();

    expect(setPreset).toHaveBeenCalledWith('emerald');
  });

  it('calls AuthStore.logout and navigates to /auth/login on successful logout', async () => {
    const { fixture, logoutMock, navigateMock, notificationErrorMock } = setup({ logoutResult: true });

    fixture.debugElement.query(By.css('.profile-menu-trigger')).nativeElement.click();
    fixture.detectChanges();

    const logoutBtn = fixture.nativeElement.querySelector('.profile-action-btn--logout') as HTMLButtonElement;
    expect(logoutBtn).toBeTruthy();

    logoutBtn.click();
    fixture.detectChanges();

    expect(logoutMock).toHaveBeenCalled();
    // Popover panel should close
    expect(fixture.nativeElement.querySelector('.profile-popover-panel')).toBeFalsy();

    // Wait for async logout promise resolution
    await fixture.whenStable();

    expect(navigateMock).toHaveBeenCalledWith(['/auth/login']);
    expect(notificationErrorMock).not.toHaveBeenCalled();
  });

  it('displays safe notification toast "Could not log out. Try again." and does not navigate when logout fails', async () => {
    const { fixture, logoutMock, navigateMock, notificationErrorMock } = setup({ logoutResult: false });

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
