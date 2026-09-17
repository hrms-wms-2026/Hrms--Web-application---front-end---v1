import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { ResetPasswordComponent } from './reset-password.component';
import { AuthApiService } from '../../data-access/auth-api.service';

@Component({ standalone: true, template: '' })
class RouteTargetStubComponent {}

describe('ResetPasswordComponent', () => {
  function setup(options: { token?: string | null; resetPasswordImpl?: ReturnType<typeof vi.fn> } = {}) {
    const { token = 'raw-token', resetPasswordImpl } = options;

    const apiStub = {
      resetPassword: resetPasswordImpl ?? vi.fn().mockReturnValue(of({ message: 'ok' }))
    };

    TestBed.configureTestingModule({
      imports: [ResetPasswordComponent],
      providers: [
        provideRouter([
          { path: 'auth/login', component: RouteTargetStubComponent },
          { path: 'auth/forgot-password', component: RouteTargetStubComponent }
        ]),
        { provide: AuthApiService, useValue: apiStub },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: (key: string) => (key === 'token' ? token : null) } } } }
      ]
    });

    const fixture = TestBed.createComponent(ResetPasswordComponent);
    fixture.detectChanges();
    return { fixture, apiStub };
  }

  it('shows an invalid-link message and does not render the form when no token is present', () => {
    const { fixture } = setup({ token: null });

    expect(fixture.componentInstance.token).toBe('');
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('invalid or has expired');
  });

  it('rejects mismatched passwords without calling the API', async () => {
    const { fixture, apiStub } = setup();

    fixture.componentInstance.form.setValue({ password: 'Password123!', confirmPassword: 'Different123!' });
    await fixture.componentInstance.submit();

    expect(apiStub.resetPassword).not.toHaveBeenCalled();
    expect(fixture.componentInstance.form.controls.confirmPassword.errors).toEqual({ mismatch: true });
  });

  it('rejects a password shorter than 8 characters without calling the API', async () => {
    const { fixture, apiStub } = setup();

    fixture.componentInstance.form.setValue({ password: 'short', confirmPassword: 'short' });
    await fixture.componentInstance.submit();

    expect(apiStub.resetPassword).not.toHaveBeenCalled();
  });

  it('calls resetPassword with the token and new password, then shows the success state', async () => {
    const { fixture, apiStub } = setup();

    fixture.componentInstance.form.setValue({ password: 'Password123!', confirmPassword: 'Password123!' });
    await fixture.componentInstance.submit();

    expect(apiStub.resetPassword).toHaveBeenCalledWith('raw-token', 'Password123!');
    expect(fixture.componentInstance.submitted()).toBe(true);
  });

  it('navigates to /auth/login when the sign-in button is pressed after success', async () => {
    const { fixture } = setup();
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    fixture.componentInstance.form.setValue({ password: 'Password123!', confirmPassword: 'Password123!' });
    await fixture.componentInstance.submit();
    fixture.componentInstance.goToLogin();

    expect(navigateSpy).toHaveBeenCalledWith(['/auth/login']);
  });

  it('shows the generic invalid-or-expired message when the token is rejected', async () => {
    const { fixture } = setup({
      resetPasswordImpl: vi.fn().mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 400, error: { detail: 'Invalid or expired reset token.' } }))
      )
    });

    fixture.componentInstance.form.setValue({ password: 'Password123!', confirmPassword: 'Password123!' });
    await fixture.componentInstance.submit();

    expect(fixture.componentInstance.submitted()).toBe(false);
    expect(fixture.componentInstance.error()).toBe('Invalid or expired reset token.');
  });

  it('shows a network failure message on a network error (status 0)', async () => {
    const { fixture } = setup({
      resetPasswordImpl: vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })))
    });

    fixture.componentInstance.form.setValue({ password: 'Password123!', confirmPassword: 'Password123!' });
    await fixture.componentInstance.submit();

    expect(fixture.componentInstance.error()).toBe('We could not reach the server. Please try again.');
  });
});
