import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, computed, effect, inject, signal } from '@angular/core';
import { ConfirmModalComponent } from '../../../shared/ui/confirm-modal/confirm-modal.component';
import { DraftChip, DraftsStore } from '../../../shared/state/drafts.store';
import { NavigationStateService } from '../nav/navigation-state.service';

const BAR_OFFSET = '40px';

/** ClickUp-style docked bottom tray of the user's own unsaved work (task + onboarding drafts). */
@Component({
  selector: 'app-drafts-bar',
  standalone: true,
  imports: [ConfirmModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.drafts-bar--visible]': 'store.chips().length > 0',
    '[class.drafts-bar--hidden]': 'store.chips().length === 0',
    '[class.drafts-bar--has-sub-nav]': 'hasSubNav()'
  },
  template: `
    @if (store.chips().length > 0) {
      <nav class="drafts-bar" data-testid="drafts-bar" aria-label="Your drafts">
        <div class="drafts-bar__scroll-track">
          @for (chip of store.chips(); track chip.kind + chip.id) {
            <div
              class="drafts-bar__chip"
              [class.drafts-bar__chip--active]="store.activeDraft()?.id === chip.id"
            >
              <button
                type="button"
                class="drafts-bar__open"
                [attr.data-testid]="'draft-chip-' + chip.kind + '-' + chip.id"
                [title]="chip.label"
                (click)="open(chip)"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  @if (chip.kind === 'task') {
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  } @else {
                    <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  }
                </svg>
                <span class="drafts-bar__label">{{ chip.label }}</span>
                @if (chip.badge) {
                  <span class="drafts-bar__badge">{{ chip.badge }}</span>
                }
              </button>
              <button
                type="button"
                class="drafts-bar__remove"
                [attr.data-testid]="'draft-chip-remove-' + chip.kind + '-' + chip.id"
                [attr.aria-label]="'Delete draft ' + chip.label"
                title="Delete draft"
                (click)="pendingDelete.set(chip)"
              >
                ✕
              </button>
            </div>
          }
        </div>
      </nav>
    }
    <app-confirm-modal [open]="!!pendingDelete()" title="Delete draft?"
      [message]="'Delete the draft “' + (pendingDelete()?.label ?? '') + '”? This cannot be undone.'"
      confirmLabel="Delete" [loading]="deleting()" [errorMessage]="deleteError() ?? ''"
      (confirmed)="confirmDelete()" (cancelled)="pendingDelete.set(null)" />
  `,
  styles: [`
    :host {
      display: block;
      flex-shrink: 0;
      width: 100%;
    }
    :host(.drafts-bar--hidden) {
      display: none;
    }
    .drafts-bar {
      width: 100%;
      height: 38px;
      display: flex;
      align-items: center;
      background: var(--color-surface);
      border-top: 1px solid var(--color-border);
      box-shadow: var(--shadow-card);
      padding: 0 12px;
      box-sizing: border-box;
      border-radius: 0 0 16px 16px;
    }
    .drafts-bar__scroll-track {
      display: flex;
      align-items: center;
      gap: 6px;
      width: 100%;
      height: 100%;
      overflow-x: auto;
      overflow-y: hidden;
      scrollbar-width: none;
      -ms-overflow-style: none;
      scroll-behavior: smooth;
    }
    .drafts-bar__scroll-track::-webkit-scrollbar {
      display: none;
      width: 0;
      height: 0;
    }
    .drafts-bar__chip {
      display: inline-flex;
      align-items: center;
      flex: 0 0 auto;
      height: 28px;
      border: 1px solid var(--color-border);
      border-radius: 6px;
      background: var(--color-surface);
      box-shadow: var(--shadow-card);
      transition: background-color 120ms ease, border-color 120ms ease, box-shadow 120ms ease;
    }
    .drafts-bar__chip:hover {
      background: var(--color-surface-secondary);
      border-color: var(--color-border-strong);
    }
    .drafts-bar__chip--active {
      border-color: var(--color-accent, #3b82f6);
      background: var(--color-surface);
      box-shadow: 0 0 0 1px var(--color-accent, #3b82f6);
    }
    .drafts-bar__open {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
      height: 100%;
      padding: 0 4px 0 8px;
      border: 0;
      background: none;
      color: var(--color-text-primary);
      font: inherit;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      line-height: 1;
    }
    .drafts-bar__open svg {
      width: 14px;
      height: 14px;
      flex: 0 0 auto;
      fill: none;
      stroke: var(--color-text-secondary);
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .drafts-bar__label {
      overflow: hidden;
      max-width: 22ch;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .drafts-bar__badge {
      padding: 1px 5px;
      border-radius: 4px;
      background: var(--color-surface-secondary);
      color: var(--color-text-secondary);
      font-size: 10px;
      font-weight: 600;
      white-space: nowrap;
    }
    .drafts-bar__remove {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      margin-right: 4px;
      padding: 0;
      border: 0;
      border-radius: 4px;
      background: none;
      color: var(--color-text-secondary);
      font-size: 11px;
      cursor: pointer;
      transition: background-color 120ms ease, color 120ms ease;
    }
    .drafts-bar__remove:hover {
      background: rgba(0, 0, 0, 0.07);
      color: var(--color-danger-text, #ef4444);
    }
    @media (max-width: 768px) {
      :host {
        position: fixed;
        left: 50%;
        transform: translateX(-50%);
        bottom: 74px;
        z-index: 1050;
        width: auto;
        max-width: calc(100vw - 1.5rem);
        pointer-events: none;
      }
      :host(.drafts-bar--has-sub-nav) {
        bottom: 116px;
      }
      .drafts-bar {
        width: auto;
        max-width: 100%;
        height: 34px;
        padding: 0 6px;
        border: 1px solid var(--color-border);
        border-radius: 9999px;
        box-shadow: var(--shadow-popover);
        background: var(--color-surface);
        pointer-events: auto;
      }
      .drafts-bar__chip {
        height: 26px;
        border-radius: 9999px;
        box-shadow: none;
        border-color: transparent;
        background: var(--color-surface-secondary);
      }
      .drafts-bar__chip:hover {
        background: var(--color-surface);
        border-color: var(--color-border);
      }
      .drafts-bar__chip--active {
        background: var(--color-surface);
        border-color: var(--color-accent);
      }
    }
  `]
})
export class DraftsBarComponent {
  protected readonly store = inject(DraftsStore);
  private readonly navState = inject(NavigationStateService, { optional: true });

  protected readonly hasSubNav = computed(() => !!this.navState && this.navState.activeChildren().length > 1);

  protected readonly pendingDelete = signal<DraftChip | null>(null);
  protected readonly deleting = signal(false);
  protected readonly deleteError = signal<string | null>(null);

  constructor() {
    void this.store.load();
    const root = document.documentElement;
    effect(() => {
      const hasChips = this.store.chips().length > 0;
      const subNav = this.hasSubNav();
      const offset = hasChips ? (subNav ? '80px' : BAR_OFFSET) : '0px';
      root.style.setProperty('--bottom-tray-offset', offset);
    });
    inject(DestroyRef).onDestroy(() => root.style.setProperty('--bottom-tray-offset', '0px'));
  }

  @HostListener('window:focus')
  protected onWindowFocus(): void {
    void this.store.load();
  }

  protected open(chip: DraftChip): void {
    this.store.openDraft(chip);
  }

  protected async confirmDelete(): Promise<void> {
    const chip = this.pendingDelete();
    if (!chip) return;
    this.deleting.set(true);
    this.deleteError.set(null);
    const ok = await this.store.removeChip(chip);
    this.deleting.set(false);
    if (ok) this.pendingDelete.set(null);
    else this.deleteError.set('Could not delete the draft. Please try again.');
  }
}
