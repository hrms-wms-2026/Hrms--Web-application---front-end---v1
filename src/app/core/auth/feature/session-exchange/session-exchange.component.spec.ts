import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { SessionExchangeComponent } from './session-exchange.component';
import { AuthStore } from '../../state/auth.store';

@Component({ standalone: true, template: '' })
class RouteTargetStubComponent {}

describe('SessionExchangeComponent', () => {
  function setup(authStoreOverrides: Record<string, unknown>, code: string | null) {
    TestBed.configureTestingModule({
      imports: [SessionExchangeComponent],
      providers: [
        provideRouter([
          { path: 'dashboard', component: RouteTargetStubComponent },
          { path: 'auth/login', component: RouteTargetStubComponent }
        ]),
        { provide: AuthStore, useValue: authStoreOverrides },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: () => code } } }
        }
      ]
    });
    const fixture = TestBed.createComponent(SessionExchangeComponent);
    return fixture;
  }

  it('exchanges the code from the query string and navigates to /dashboard on success', async () => {
    const exchangeSpy = vi.fn().mockResolvedValue(undefined);
    const fixture = setup({ exchangeSession: exchangeSpy, error: () => null }, 'raw-exchange-code');
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    fixture.detectChanges();
    await fixture.whenStable();

    expect(exchangeSpy).toHaveBeenCalledWith('raw-exchange-code');
    expect(navigateSpy).toHaveBeenCalledWith(['/dashboard']);
    expect(fixture.componentInstance.failed()).toBe(false);
  });

  it('shows the failure state and does not navigate when the exchange call rejects', async () => {
    const exchangeSpy = vi.fn().mockRejectedValue(new Error('expired'));
    const fixture = setup(
      { exchangeSession: exchangeSpy, error: () => 'This sign-in link is invalid or has expired. Please sign in again.' },
      'raw-exchange-code'
    );
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.failed()).toBe(true);
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('This sign-in link is invalid or has expired.');
  });

  it('shows the failure state without calling exchangeSession when no code is present', async () => {
    const exchangeSpy = vi.fn();
    const fixture = setup({ exchangeSession: exchangeSpy, error: () => null }, null);

    fixture.detectChanges();
    await fixture.whenStable();

    expect(exchangeSpy).not.toHaveBeenCalled();
    expect(fixture.componentInstance.failed()).toBe(true);
  });

  it('backToLogin navigates to /auth/login', () => {
    const fixture = setup({ exchangeSession: vi.fn(), error: () => null }, null);
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    fixture.componentInstance.backToLogin();

    expect(navigateSpy).toHaveBeenCalledWith(['/auth/login']);
  });
});
