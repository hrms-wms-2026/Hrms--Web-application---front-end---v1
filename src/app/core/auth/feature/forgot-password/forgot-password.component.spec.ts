import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { ForgotPasswordComponent } from './forgot-password.component';
import { AuthApiService } from '../../data-access/auth-api.service';

@Component({ standalone: true, template: '' })
class RouteTargetStubComponent {}

describe('ForgotPasswordComponent', () => {
  function setup(forgotPasswordImpl?: ReturnType<typeof vi.fn>) {
    const apiStub = {
      forgotPassword: forgotPasswordImpl ?? vi.fn().mockReturnValue(of({ message: 'ok' }))
    };

    TestBed.configureTestingModule({
      imports: [ForgotPasswordComponent],
      providers: [
        provideRouter([{ path: 'auth/login', component: RouteTargetStubComponent }]),
        { provide: AuthApiService, useValue: apiStub }
      ]
    });

    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    fixture.detectChanges();
    return { fixture, apiStub };
  }

  it('does not call the API when the form is invalid', async () => {
    const { fixture, apiStub } = setup();

    await fixture.componentInstance.submit();

    expect(apiStub.forgotPassword).not.toHaveBeenCalled();
    expect(fixture.componentInstance.submitted()).toBe(false);
  });

  it('calls forgotPassword with the entered email and shows the generic success state', async () => {
    const { fixture, apiStub } = setup();

    fixture.componentInstance.form.setValue({ email: 'a@b.com' });
    await fixture.componentInstance.submit();

    expect(apiStub.forgotPassword).toHaveBeenCalledWith('a@b.com');
    expect(fixture.componentInstance.submitted()).toBe(true);
  });

  it('shows an error message instead of the success state on a network failure', async () => {
    const { fixture } = setup(vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 }))));

    fixture.componentInstance.form.setValue({ email: 'a@b.com' });
    await fixture.componentInstance.submit();

    expect(fixture.componentInstance.submitted()).toBe(false);
    expect(fixture.componentInstance.error()).toBe('We could not reach the server. Please try again.');
  });

  it('surfaces a server-provided detail message when present', async () => {
    const { fixture } = setup(
      vi.fn().mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 429, error: { detail: 'Too many requests.' } }))
      )
    );

    fixture.componentInstance.form.setValue({ email: 'a@b.com' });
    await fixture.componentInstance.submit();

    expect(fixture.componentInstance.error()).toBe('Too many requests.');
  });
});
