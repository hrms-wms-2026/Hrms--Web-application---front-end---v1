import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { LoginComponent } from './login.component';
import { AuthStore } from '../../state/auth.store';

@Component({ standalone: true, template: '' })
class RouteTargetStubComponent {}

describe('LoginComponent', () => {
  function setup(authStoreOverrides: Record<string, unknown>) {
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([
          { path: 'dashboard', component: RouteTargetStubComponent },
          { path: 'auth/legal-consent', component: RouteTargetStubComponent }
        ]),
        { provide: AuthStore, useValue: authStoreOverrides }
      ]
    });
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('does not call login when the form is invalid', async () => {
    const loginSpy = vi.fn();
    const fixture = setup({
      login: loginSpy,
      legalAcceptanceRequired: () => false,
      redirectRequired: () => false,
      continueUrl: () => null,
      loading: () => false,
      error: () => null
    });

    await fixture.componentInstance.submit();

    expect(loginSpy).not.toHaveBeenCalled();
  });

  it('calls login with the form values when valid', async () => {
    const loginSpy = vi.fn().mockResolvedValue(undefined);
    const fixture = setup({
      login: loginSpy,
      legalAcceptanceRequired: () => false,
      redirectRequired: () => false,
      continueUrl: () => null,
      loading: () => false,
      error: () => null
    });

    fixture.componentInstance.form.setValue({ email: 'a@b.com', password: 'secret' });
    await fixture.componentInstance.submit();

    expect(loginSpy).toHaveBeenCalledWith({ email: 'a@b.com', password: 'secret' });
  });

  it('navigates to /auth/legal-consent when login succeeds but legal acceptance is required', async () => {
    const fixture = setup({
      login: vi.fn().mockResolvedValue(undefined),
      legalAcceptanceRequired: () => true,
      redirectRequired: () => false,
      continueUrl: () => null,
      loading: () => false,
      error: () => null
    });
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    fixture.componentInstance.form.setValue({ email: 'a@b.com', password: 'secret' });
    await fixture.componentInstance.submit();

    expect(navigateSpy).toHaveBeenCalledWith(['/auth/legal-consent']);
  });

  it('redirects the browser to continue_url when every gate clears (base-domain login hands off to the tenant host)', async () => {
    const originalLocation = window.location;
    // @ts-expect-error -- replacing window.location with a controllable stand-in for this test
    delete window.location;
    window.location = { ...originalLocation, href: '' } as unknown as string & Location;

    const fixture = setup({
      login: vi.fn().mockResolvedValue(undefined),
      legalAcceptanceRequired: () => false,
      redirectRequired: () => true,
      continueUrl: () => 'http://acme.localhost:4200/auth/continue?code=raw-exchange-code',
      loading: () => false,
      error: () => null
    });
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    fixture.componentInstance.form.setValue({ email: 'a@b.com', password: 'secret' });
    await fixture.componentInstance.submit();

    expect(window.location.href).toBe('http://acme.localhost:4200/auth/continue?code=raw-exchange-code');
    expect(navigateSpy).not.toHaveBeenCalled();

    window.location = originalLocation as unknown as string & Location;
  });

  it('does not navigate when login rejects', async () => {
    const fixture = setup({
      login: vi.fn().mockRejectedValue(new Error('bad credentials')),
      legalAcceptanceRequired: () => false,
      redirectRequired: () => false,
      continueUrl: () => null,
      loading: () => false,
      error: () => 'Invalid email or password.'
    });
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    fixture.componentInstance.form.setValue({ email: 'a@b.com', password: 'wrong' });
    await fixture.componentInstance.submit();

    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('renders the store error message', () => {
    const fixture = setup({
      login: vi.fn(),
      legalAcceptanceRequired: () => false,
      redirectRequired: () => false,
      continueUrl: () => null,
      loading: () => false,
      error: () => 'Invalid email or password.'
    });

    expect(fixture.nativeElement.textContent).toContain('Invalid email or password.');
  });
});
