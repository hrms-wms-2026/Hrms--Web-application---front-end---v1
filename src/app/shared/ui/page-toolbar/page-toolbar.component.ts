import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PageToolbarService } from '../../state/page-toolbar.service';

/**
 * The navbar's page action (e.g. the dashboard's "Customize"): a small button with an edit icon, styled like the notification bell. While the
 * page is in its edit mode the circle opens into a capsule holding the page's title and items (icon + name),
 * and the pencil turns into an X that leaves edit mode. Every change eases (width, fade, icon morph); nothing
 * snaps. Renders nothing when no page registered an action.
 */
@Component({
  selector: 'app-page-toolbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (toolbar.action(); as action) {
      <div class="ptb" [class.ptb--open]="expanded()" role="group" [attr.aria-label]="action.title ?? action.label">
        <div class="ptb__tray" [attr.inert]="expanded() ? null : ''" [attr.aria-hidden]="expanded() ? null : 'true'">
          <div class="ptb__items">
            @if (action.title) {
              <span class="ptb__title" data-testid="page-toolbar-title" [attr.title]="action.hint ?? null">{{ action.title }}</span>
              <span class="ptb__divider" aria-hidden="true"></span>
            }
            @for (item of action.items ?? []; track item.id; let i = $index) {
              <button
                type="button"
                class="ptb__item"
                [class.ptb__item--primary]="item.primary"
                [style.--ptb-i]="i + 1"
                [attr.data-testid]="item.id"
                [attr.aria-label]="item.label()"
                [disabled]="item.disabled()"
                (click)="item.onClick($event)"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  @switch (item.icon) {
                    @case ('add') {
                      <path d="M12 5v14M5 12h14" />
                    }
                    @case ('reset') {
                      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" />
                    }
                    @case ('save') {
                      <path d="M20 6 9 17l-5-5" />
                    }
                  }
                </svg>
                <span class="ptb__label">{{ item.label() }}</span>
              </button>
            }
          </div>
        </div>
        <!-- One circle for both states, so the pencil can morph into the X instead of being swapped. -->
        <button
          type="button"
          class="ptb__circle"
          [attr.data-testid]="expanded() ? 'page-toolbar-close' : 'page-toolbar-open'"
          [attr.aria-label]="expanded() ? (action.collapseLabel ?? 'Close') : action.label"
          [attr.title]="expanded() ? (action.collapseLabel ?? 'Close') : action.label"
          [attr.aria-expanded]="expanded()"
          [disabled]="expanded() ? (action.collapseDisabled?.() ?? false) : action.disabled()"
          (click)="expanded() ? action.onCollapse?.() : action.onClick()"
        >
          <svg class="ptb__icon ptb__icon--edit" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
          <svg class="ptb__icon ptb__icon--close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      min-width: 0;
      --ptb-ms: 420ms;
      --ptb-ease: cubic-bezier(0.22, 1, 0.36, 1);
    }
    .ptb {
      display: inline-flex;
      align-items: center;
      min-width: 0;
      height: var(--topbar-control-h, 28px);
      /* Same shape and colours as the navbar's notification bell: a round chip that opens into a pill. */
      border-radius: 999px;
      border: 1px solid transparent;
      transition:
        background-color var(--ptb-ms) var(--ptb-ease),
        border-color var(--ptb-ms) var(--ptb-ease),
        padding var(--ptb-ms) var(--ptb-ease);
    }
    .ptb--open {
      background: var(--topbar-chip-bg, var(--color-surface-secondary));
      border-color: var(--topbar-chip-border, transparent);
      box-shadow: var(--topbar-chip-shadow, none);
      padding-left: 4px;
      padding-right: 3px;
    }
    /* Width animates from 0 to the content's natural width (grid track 0fr -> 1fr). */
    .ptb__tray {
      display: grid;
      grid-template-columns: 0fr;
      min-width: 0;
      transition: grid-template-columns var(--ptb-ms) var(--ptb-ease);
    }
    .ptb--open .ptb__tray {
      grid-template-columns: 1fr;
    }
    .ptb__items {
      display: flex;
      align-items: center;
      gap: 2px;
      min-width: 0;
      overflow: hidden;
      white-space: nowrap;
    }
    /* The gap before the circle lives on the items, so a closed tray measures exactly 0. */
    .ptb__items > :last-child {
      margin-right: 4px;
    }
    /* Contents fade and slide in a beat behind the width, one after another; on close they leave first. */
    .ptb__title,
    .ptb__divider,
    .ptb__item {
      opacity: 0;
      transform: translateX(8px);
      transition:
        opacity 160ms ease,
        transform 160ms ease,
        background-color 150ms ease;
    }
    .ptb--open .ptb__title,
    .ptb--open .ptb__divider,
    .ptb--open .ptb__item {
      opacity: 1;
      transform: none;
      transition:
        opacity 260ms ease calc(80ms + var(--ptb-i, 0) * 40ms),
        transform var(--ptb-ms) var(--ptb-ease) calc(80ms + var(--ptb-i, 0) * 40ms),
        background-color 150ms ease;
    }
    .ptb__title {
      padding: 0 6px 0 8px;
      font-size: 12px;
      font-weight: 700;
      color: var(--color-text-primary);
      cursor: default;
    }
    .ptb__divider {
      width: 1px;
      height: 14px;
      margin: 0 4px;
      background: var(--color-border-strong);
    }
    .ptb__item {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      height: calc(var(--topbar-control-h, 28px) - 10px);
      border-radius: 999px;
      padding: 0 10px 0 8px;
      font-size: 12px;
      font-weight: 600;
      color: var(--color-text-secondary);
      cursor: pointer;
    }
    .ptb__item svg {
      width: 14px;
      height: 14px;
      flex: none;
    }
    .ptb__item:hover:not(:disabled) {
      background: var(--color-border);
      color: var(--color-text-primary);
    }
    .ptb__item--primary {
      background: var(--color-accent);
      color: var(--color-accent-contrast);
    }
    .ptb__item--primary:hover:not(:disabled) {
      background: var(--color-accent-hover);
    }
    .ptb__circle {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: var(--topbar-control-h, 28px);
      height: var(--topbar-control-h, 28px);
      flex: none;
      border-radius: 999px;
      border: 1px solid var(--topbar-chip-border, transparent);
      background: var(--topbar-chip-bg, var(--color-surface-secondary));
      box-shadow: var(--topbar-chip-shadow, none);
      color: var(--color-text-secondary);
      cursor: pointer;
      transition:
        background-color var(--ptb-ms) var(--ptb-ease),
        width var(--ptb-ms) var(--ptb-ease),
        height var(--ptb-ms) var(--ptb-ease),
        border-radius var(--ptb-ms) var(--ptb-ease),
        transform 150ms ease;
    }
    .ptb__circle:active:not(:disabled) {
      transform: scale(0.92);
    }
    .ptb--open .ptb__circle {
      width: calc(var(--topbar-control-h, 28px) - 10px);
      height: calc(var(--topbar-control-h, 28px) - 10px);
      border-color: transparent;
      background: transparent;
      box-shadow: none;
    }
    .ptb__circle:hover:not(:disabled) {
      background: var(--topbar-chip-bg-hover, var(--color-border));
      color: var(--color-text-primary);
    }
    /* The pencil spins out as the X spins in (and back). */
    .ptb__icon {
      position: absolute;
      width: 16px;
      height: 16px;
      transition:
        opacity 220ms ease,
        transform var(--ptb-ms) var(--ptb-ease);
    }
    .ptb__icon--close {
      opacity: 0;
      transform: rotate(-90deg) scale(0.5);
    }
    .ptb--open .ptb__icon--edit {
      opacity: 0;
      transform: rotate(90deg) scale(0.5);
    }
    .ptb--open .ptb__icon--close {
      opacity: 1;
      transform: none;
    }
    .ptb__item:disabled,
    .ptb__circle:disabled {
      cursor: default;
      opacity: 0.5;
    }
    .ptb__item:focus-visible,
    .ptb__circle:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }
    /* Narrower screens: drop the title, then the names (each name stays its button's accessible label). */
    @media (max-width: 1100px) {
      .ptb__title,
      .ptb__divider {
        display: none;
      }
    }
    @media (max-width: 640px) {
      .ptb__label {
        display: none;
      }
      .ptb__item {
        padding: 0 7px;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .ptb,
      .ptb__tray,
      .ptb__title,
      .ptb__divider,
      .ptb__item,
      .ptb__circle,
      .ptb__icon {
        transition: none !important;
      }
    }
  `
})
export class PageToolbarComponent {
  protected readonly toolbar = inject(PageToolbarService);
  protected readonly expanded = computed(() => this.toolbar.action()?.expanded?.() ?? false);
}
