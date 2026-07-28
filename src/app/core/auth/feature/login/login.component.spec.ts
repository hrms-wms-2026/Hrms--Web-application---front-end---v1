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
      authenticated: () => false,
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
      authenticated: () => true,
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
      authenticated: () => false,
      loading: () => false,
      error: () => null
    });
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    fixture.componentInstance.form.setValue({ email: 'a@b.com', password: 'secret' });
    await fixture.componentInstance.submit();

    expect(navigateSpy).toHaveBeenCalledWith(['/auth/legal-consent']);
  });

  it('navigates to /dashboard when login succeeds and is fully authenticated', async () => {
    const fixture = setup({
      login: vi.fn().mockResolvedValue(undefined),
      legalAcceptanceRequired: () => false,
      authenticated: () => true,
      loading: () => false,
      error: () => null
    });
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    fixture.componentInstance.form.setValue({ email: 'a@b.com', password: 'secret' });
    await fixture.componentInstance.submit();

    expect(navigateSpy).toHaveBeenCalledWith(['/dashboard']);
  });

  it('does not navigate when login rejects', async () => {
    const fixture = setup({
      login: vi.fn().mockRejectedValue(new Error('bad credentials')),
      legalAcceptanceRequired: () => false,
      authenticated: () => false,
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
      authenticated: () => false,
      loading: () => false,
      error: () => 'Invalid email or password.'
    });

    expect(fixture.nativeElement.textContent).toContain('Invalid email or password.');
  });
});
