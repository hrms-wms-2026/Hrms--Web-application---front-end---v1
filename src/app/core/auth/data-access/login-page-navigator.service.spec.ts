import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { LoginPageNavigator } from './login-page-navigator.service';

/** Exposes the two browser touch points so the spec never leaves the test page. */
class TestableNavigator extends LoginPageNavigator {
  path = '/dashboard';
  clock = 1_000_000;
  readonly assigned: string[] = [];
  protected override now(): number {
    return this.clock;
  }
  protected override currentPath(): string {
    return this.path;
  }
  protected override assign(url: string): void {
    this.assigned.push(url);
  }
}

describe('LoginPageNavigator', () => {
  let navigator: TestableNavigator;
  let navigate: ReturnType<typeof vi.fn>;

  afterEach(() => sessionStorage.clear());

  beforeEach(() => {
    sessionStorage.clear();
    navigate = vi.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({
      providers: [TestableNavigator, { provide: Router, useValue: { navigate } }]
    });
    navigator = TestBed.inject(TestableNavigator);
  });

  it('goToLogin loads the login page as a full document', () => {
    navigator.goToLogin();
    expect(navigator.assigned).toEqual(['/auth/login']);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('leaveExpiredSession from an app page loads the login page as a full document', () => {
    navigator.leaveExpiredSession();
    expect(navigator.assigned).toEqual(['/auth/login']);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('leaveExpiredSession reloads once when several requests fail together', () => {
    navigator.leaveExpiredSession();
    navigator.leaveExpiredSession();
    navigator.leaveExpiredSession();
    expect(navigator.assigned).toHaveLength(1);
  });

  it('leaveExpiredSession on an /auth/ page only routes, so a repeating 401 there cannot reload in a loop', () => {
    navigator.path = '/auth/login';
    navigator.leaveExpiredSession();
    navigator.leaveExpiredSession();
    expect(navigator.assigned).toEqual([]);
    expect(navigate).toHaveBeenCalledWith(['/auth/login']);
  });

  it('treats other /auth/ pages (accept invitation, reset password) the same way', () => {
    navigator.path = '/auth/reset-password';
    navigator.leaveExpiredSession();
    expect(navigator.assigned).toEqual([]);
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('only routes when another expired-session reload happened within 10 seconds (no reload loop)', () => {
    navigator.leaveExpiredSession();
    expect(navigator.assigned).toHaveLength(1);

    // The next page after that reload: a fresh service, the same tab's sessionStorage.
    const nextPage = TestBed.runInInjectionContext(() => new TestableNavigator());
    nextPage.clock = navigator.clock + 3_000;
    nextPage.leaveExpiredSession();

    expect(nextPage.assigned).toEqual([]);
    expect(navigate).toHaveBeenCalledWith(['/auth/login']);
  });

  it('reloads again once the 10 second window has passed', () => {
    navigator.leaveExpiredSession();
    const later = TestBed.runInInjectionContext(() => new TestableNavigator());
    later.clock = navigator.clock + 10_001;
    later.leaveExpiredSession();
    expect(later.assigned).toEqual(['/auth/login']);
  });

  it('goToLogin after an explicit logout is never held back by the window', () => {
    navigator.leaveExpiredSession();
    const next = TestBed.runInInjectionContext(() => new TestableNavigator());
    next.clock = navigator.clock + 1_000;
    next.goToLogin();
    expect(next.assigned).toEqual(['/auth/login']);
  });
});
