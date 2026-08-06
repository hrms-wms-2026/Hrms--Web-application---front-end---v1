import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MainLayoutComponent } from './main-layout.component';
import { AuthStore } from '../../core/auth/state/auth.store';

const authStoreStub = {
  email: () => 'asha@onevo.test',
  permissions: () => [] as string[],
  activeModules: () => [] as string[]
};

describe('MainLayoutComponent', () => {
  it('renders the top and side navbar shell without legacy branding or placeholder text', async () => {
    await TestBed.configureTestingModule({
      imports: [MainLayoutComponent],
      providers: [provideRouter([]), { provide: AuthStore, useValue: authStoreStub }]
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
      providers: [provideRouter([]), { provide: AuthStore, useValue: authStoreStub }]
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
});
