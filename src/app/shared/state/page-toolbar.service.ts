import { Injectable, signal } from '@angular/core';

export interface PageToolbarAction {
  readonly label: string;
  readonly disabled: () => boolean;
  readonly onClick: () => void;
}

/**
 * Lets the page currently mounted register one action button for the top navbar to show, without
 * the shared layout shell importing any feature module. The page sets it while alive and clears it
 * on destroy (or whenever it shouldn't be shown, e.g. the dashboard mid-edit) - the navbar just
 * renders whatever's here.
 */
@Injectable({ providedIn: 'root' })
export class PageToolbarService {
  readonly action = signal<PageToolbarAction | null>(null);

  set(action: PageToolbarAction): void {
    this.action.set(action);
  }

  clear(): void {
    this.action.set(null);
  }
}
