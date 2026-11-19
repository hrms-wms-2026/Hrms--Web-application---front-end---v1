import { Injectable, signal } from '@angular/core';

/** The page name the mobile back bar shows (null when it shows none), so page headers can avoid repeating it. */
@Injectable({ providedIn: 'root' })
export class MobileBackBarState {
  readonly label = signal<string | null>(null);
}
