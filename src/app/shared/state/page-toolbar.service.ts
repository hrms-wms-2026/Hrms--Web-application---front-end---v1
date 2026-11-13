import { Injectable, signal } from '@angular/core';

/** The icons the navbar capsule knows how to draw. */
export type PageToolbarIcon = 'add' | 'reset' | 'save';

/** One button inside the expanded navbar capsule (e.g. the dashboard's Add / Reset / Save). */
export interface PageToolbarItem {
  /** Used as the button's data-testid. */
  readonly id: string;
  readonly label: () => string;
  readonly icon: PageToolbarIcon;
  readonly disabled: () => boolean;
  readonly onClick: (event: Event) => void;
  /** Filled with the accent colour (the capsule's main action). */
  readonly primary?: boolean;
}

export interface PageToolbarAction {
  /** Accessible name of the collapsed circle button. */
  readonly label: string;
  readonly disabled: () => boolean;
  /** Clicking the collapsed circle. */
  readonly onClick: () => void;
  /** True while the capsule is open (the page is in its edit mode). */
  readonly expanded?: () => boolean;
  /** Shown at the start of the open capsule (e.g. "Customize your dashboard"). */
  readonly title?: string;
  /** Tooltip on the title: how to use the edit mode. */
  readonly hint?: string;
  /** The buttons shown inside the open capsule. */
  readonly items?: readonly PageToolbarItem[];
  /** Clicking the circle while the capsule is open (it shows an X then). */
  readonly onCollapse?: () => void;
  /** Accessible name of the circle while open. */
  readonly collapseLabel?: string;
  readonly collapseDisabled?: () => boolean;
}

/**
 * Lets the page currently mounted register one action for the top navbar to show, without the shared
 * layout shell importing any feature module. The page sets it while alive and clears it on destroy -
 * the navbar just renders whatever's here: a small circle button that, when the page reports itself
 * expanded, opens into a capsule with the page's items.
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
