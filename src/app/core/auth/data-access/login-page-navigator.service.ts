import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';

const LOGIN_PATH = '/auth/login';
/** sessionStorage key: when the last expired-session reload happened (epoch ms). */
const LAST_RELOAD_KEY = 'crownus.sessionLossReloadAt';
/** A second expired-session reload inside this window only routes, so a 401 loop cannot keep reloading. */
const RELOAD_COOLDOWN_MS = 10_000;

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
  private readonly router = inject(Router);
  private leaving = false;

  /** After an explicit logout. */
  goToLogin(): void {
    // Same-origin path: a tenant host's login page still forwards to the root host as before,
    // and single-host mode keeps whatever slug logout already cleared or kept.
    this.loadDocument(LOGIN_PATH);
  }

  /**
   * After the server says the session is gone (401, stale CSRF, tenant mismatch).
   *
   * - On an app page: one full document load, so the next sign-in starts with empty stores.
   * - Already on an /auth/ page: a router navigation as before. A reload there could loop if a
   *   request on that page keeps answering 401, and an /auth/ page holds no signed-in data.
   * - Several requests failing together reload once, not once per request.
   * - A second one within RELOAD_COOLDOWN_MS of the last only routes. This stops a reload loop
   *   when the login page's session check still passes but app calls keep answering 401 (the
   *   login page sends a "signed-in" user back to the app, which 401s again).
   */
  leaveExpiredSession(): void {
    if (this.leaving) return;
    if (this.currentPath().startsWith('/auth/') || this.reloadedRecently()) {
      void this.router.navigate([LOGIN_PATH]);
      return;
    }
    this.rememberReload();
    this.loadDocument(LOGIN_PATH);
  }

  private reloadedRecently(): boolean {
    try {
      const last = Number(sessionStorage.getItem(LAST_RELOAD_KEY));
      return Number.isFinite(last) && last > 0 && this.now() - last < RELOAD_COOLDOWN_MS;
    } catch {
      return false; // storage unavailable: no loop memory, behave as a first reload
    }
  }

  private rememberReload(): void {
    try {
      sessionStorage.setItem(LAST_RELOAD_KEY, String(this.now()));
    } catch {
      // storage unavailable (private mode): the in-page `leaving` flag still stops repeats on this page
    }
  }

  private loadDocument(path: string): void {
    this.leaving = true;
    this.assign(path);
  }

  /** Current time; a method so specs can use a fixed clock. */
  protected now(): number {
    return Date.now();
  }

  /** The current path; a method so specs can set it (jsdom's location cannot be replaced). */
  protected currentPath(): string {
    return window.location.pathname;
  }

  /** The document load; a method so specs can observe it without leaving the test page. */
  protected assign(url: string): void {
    window.location.assign(url);
  }
}
