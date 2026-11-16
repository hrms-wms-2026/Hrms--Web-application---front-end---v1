import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

/** The only place Google Identity Services may be loaded from. */
export const GOOGLE_GSI_SCRIPT_URL = 'https://accounts.google.com/gsi/client';

export interface GoogleCredentialResponse {
  credential?: string;
}

export interface GoogleAccountsId {
  initialize(config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    ux_mode?: 'popup' | 'redirect';
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    itp_support?: boolean;
  }): void;
  renderButton(parent: HTMLElement, options: Record<string, string | number>): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } };
  }
}

/**
 * Thin wrapper over Google Identity Services. Loads the GIS script lazily (only the root login
 * page needs it), draws Google's own sign-in button and passes the returned ID token to the caller.
 *
 * SECURITY: the token is never stored, logged or kept here. It is handed straight to the callback,
 * which posts it to POST /auth/login/google and drops it. One Tap / auto sign-in is not enabled.
 * Components must use this service rather than touching window.google directly.
 */
@Injectable({ providedIn: 'root' })
export class GoogleIdentityService {
  private document = inject(DOCUMENT);
  private loading: Promise<GoogleAccountsId> | null = null;

  load(): Promise<GoogleAccountsId> {
    const ready = this.document.defaultView?.google?.accounts.id;
    if (ready) return Promise.resolve(ready);
    if (this.loading) return this.loading;

    this.loading = new Promise<GoogleAccountsId>((resolve, reject) => {
      const script = this.document.createElement('script');
      script.src = GOOGLE_GSI_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.addEventListener('load', () => {
        const id = this.document.defaultView?.google?.accounts.id;
        if (id) {
          resolve(id);
        } else {
          this.reset(script);
          reject(new Error('Google Identity Services did not initialise.'));
        }
      });
      script.addEventListener('error', () => {
        this.reset(script);
        reject(new Error('Could not load Google Identity Services.'));
      });
      this.document.head.appendChild(script);
    });

    return this.loading;
  }

  async renderSignInButton(
    host: HTMLElement,
    clientId: string,
    onCredential: (idToken: string) => void,
  ): Promise<void> {
    const id = await this.load();
    id.initialize({
      client_id: clientId,
      callback: (response) => {
        if (response.credential) onCredential(response.credential);
      },
      ux_mode: 'popup',
      auto_select: false,
      cancel_on_tap_outside: true,
      itp_support: true,
    });
    id.renderButton(host, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'rectangular',
      logo_alignment: 'center',
      width: Math.min(Math.max(host.clientWidth, 240), 400),
    });
  }

  /** A failed load must not poison later attempts (e.g. after a blocker is turned off). */
  private reset(script: HTMLScriptElement): void {
    this.loading = null;
    script.remove();
  }
}
