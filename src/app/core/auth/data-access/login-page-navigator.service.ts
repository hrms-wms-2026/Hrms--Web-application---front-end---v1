import { Injectable } from '@angular/core';

/**
 * Sends the browser to the login page as a full document load, not a router navigation.
 *
 * About fifty root-provided stores (employee directory, My Team capabilities, inbox chats, leave
 * types, current employee and others) keep what they fetched in memory for the life of the page.
 * A router navigation after logout keeps that page alive, so the next person to sign in on the
 * same tab could see the previous user's cached data. A document load starts every store empty.
 */
@Injectable({ providedIn: 'root' })
export class LoginPageNavigator {
  goToLogin(): void {
    // Same-origin path: a tenant host's login page still forwards to the root host as before,
    // and single-host mode keeps whatever slug logout already cleared or kept.
    window.location.assign('/auth/login');
  }
}
