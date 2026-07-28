import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { DashboardHomeComponent } from './dashboard-home.component';
import { AuthStore } from '../../../../core/auth/state/auth.store';

describe('DashboardHomeComponent', () => {
  it('shows the signed-in user email', async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardHomeComponent],
      providers: [
        provideRouter([]),
        { provide: AuthStore, useValue: { email: () => 'a@b.com', logout: () => Promise.resolve() } }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(DashboardHomeComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('a@b.com');
  });

  it('calls AuthStore.logout and navigates to /auth/login on sign out', async () => {
    const logoutSpy = vi.fn().mockResolvedValue(undefined);
    await TestBed.configureTestingModule({
      imports: [DashboardHomeComponent],
      providers: [provideRouter([]), { provide: AuthStore, useValue: { email: () => 'a@b.com', logout: logoutSpy } }]
    }).compileComponents();

    const fixture = TestBed.createComponent(DashboardHomeComponent);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    await fixture.componentInstance.signOut();

    expect(logoutSpy).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/auth/login']);
  });
});
