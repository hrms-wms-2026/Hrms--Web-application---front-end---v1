import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, effect, inject, signal } from '@angular/core';
import { ConfirmModalComponent } from '../../../shared/ui/confirm-modal/confirm-modal.component';
import { DraftChip, DraftsStore } from '../../../shared/state/drafts.store';

const BAR_OFFSET = '56px';

/** ClickUp-style strip of the user's own unsaved work (task + onboarding drafts) along the bottom of the app. */
@Component({
  selector: 'app-drafts-bar',
  standalone: true,
  imports: [ConfirmModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.chips().length > 0) {
      <nav class="drafts-bar" data-testid="drafts-bar" aria-label="Your drafts">
        @for (chip of store.chips(); track chip.kind + chip.id) {
          <div class="drafts-bar__chip">
            <button type="button" class="drafts-bar__open" [attr.data-testid]="'draft-chip-' + chip.kind + '-' + chip.id"
              [title]="chip.label" (click)="open(chip)">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                @if (chip.kind === 'task') { <path d="M6 3h9l3 3v15H6zM9 12h6M9 16h6" /> }
                @else { <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" /> }
              </svg>
              <span class="drafts-bar__label">{{ chip.label }}</span>
              @if (chip.badge) { <span class="drafts-bar__badge">{{ chip.badge }}</span> }
            </button>
            <button type="button" class="drafts-bar__remove" [attr.data-testid]="'draft-chip-remove-' + chip.kind + '-' + chip.id"
              [attr.aria-label]="'Delete draft ' + chip.label" (click)="pendingDelete.set(chip)">✕</button>
          </div>
        }
      </nav>
    }
    <app-confirm-modal [open]="!!pendingDelete()" title="Delete draft?"
      [message]="'Delete the draft “' + (pendingDelete()?.label ?? '') + '”? This cannot be undone.'"
      confirmLabel="Delete" [loading]="deleting()" [errorMessage]="deleteError() ?? ''"
      (confirmed)="confirmDelete()" (cancelled)="pendingDelete.set(null)" />
  `,
  styles: [`
    .drafts-bar { position: fixed; left: 16px; right: 16px; bottom: 12px; z-index: 1050; display: flex; gap: 8px; overflow-x: auto; pointer-events: none; }
    .drafts-bar__chip { display: inline-flex; align-items: center; flex: 0 0 auto; max-width: 18rem; border: 1px solid var(--color-border); border-radius: 9px; background: var(--color-surface); box-shadow: 0 4px 14px rgb(0 0 0 / 10%); pointer-events: auto; }
    .drafts-bar__open { display: inline-flex; align-items: center; gap: 6px; min-width: 0; padding: 6px 4px 6px 10px; border: 0; background: none; color: var(--color-text-primary); font: inherit; font-size: 12px; cursor: pointer; }
    .drafts-bar__open svg { width: 14px; height: 14px; flex: 0 0 auto; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .drafts-bar__label { overflow: hidden; max-width: 24ch; text-overflow: ellipsis; white-space: nowrap; }
    .drafts-bar__badge { padding: 1px 6px; border-radius: 6px; background: var(--color-surface-secondary); color: var(--color-text-secondary); font-size: 11px; white-space: nowrap; }
    .drafts-bar__remove { padding: 4px 8px; border: 0; background: none; color: var(--color-text-secondary); cursor: pointer; }
    .drafts-bar__remove:hover { color: var(--color-danger-text); }
    @media (max-width: 768px) { .drafts-bar { bottom: 84px; } }
  `]
})
export class DraftsBarComponent {
  protected readonly store = inject(DraftsStore);

  protected readonly pendingDelete = signal<DraftChip | null>(null);
  protected readonly deleting = signal(false);
  protected readonly deleteError = signal<string | null>(null);

  constructor() {
    void this.store.load();
    const root = document.documentElement;
    effect(() => root.style.setProperty('--bottom-tray-offset', this.store.chips().length > 0 ? BAR_OFFSET : '0px'));
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
