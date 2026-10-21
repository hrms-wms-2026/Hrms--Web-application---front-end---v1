import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { buildFileUrl } from '../../../../shared/data-access/file-api.service';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { InboxChatRowDto } from '../../models/inbox-chat.dto';
import { InboxChatsStore } from '../../state/inbox-chats.store';

/**
 * WhatsApp-style "Forward to…": pick one or more of your chats (groups and people) and send the case there. The chat it
 * is forwarded from is left out.
 */
@Component({
  selector: 'app-forward-dialog',
  standalone: true,
  imports: [AvatarComponent, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="open()" title="Forward to…" [subtitle]="caseTitle()" size="md" (closed)="closed.emit()">
      <div class="fwd" data-testid="forward-dialog">
        <label class="fwd__search">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input type="search" placeholder="Search chats…" aria-label="Search chats" data-testid="forward-search"
            [value]="search()" (input)="search.set($any($event.target).value)" />
        </label>
        <ul class="fwd__list">
          @for (row of rows(); track row.conversationId) {
            <li>
              <label class="fwd__row" [attr.data-testid]="'forward-row-' + row.conversationId">
                <input type="checkbox" [checked]="chosen().has(row.conversationId)" (change)="toggle(row.conversationId)" />
                @if (row.type === 'direct') {
                  <app-avatar [userName]="row.title" [avatarUrl]="row.avatarFileId ? fileUrl(row.avatarFileId) : null" size="xs" />
                } @else {
                  <span class="fwd__group" [class.fwd__group--case]="row.type === 'case'" aria-hidden="true">#</span>
                }
                <span class="fwd__name">{{ row.title }}</span>
                <span class="fwd__kind">{{ row.type === 'direct' ? 'Person' : row.type === 'case' ? 'Case group' : 'Group' }}</span>
              </label>
            </li>
          } @empty {
            <li class="fwd__quiet">No chat matches</li>
          }
        </ul>
        @if (error()) { <p class="fwd__error" role="alert">{{ error() }}</p> }
        <div class="fwd__actions">
          <button type="button" class="fwd__btn" (click)="closed.emit()">Cancel</button>
          <button type="button" class="fwd__btn fwd__btn--primary" data-testid="forward-send" [disabled]="chosen().size === 0 || busy()"
            (click)="send.emit([...chosen()])">Forward{{ chosen().size > 1 ? ' to ' + chosen().size : '' }}</button>
        </div>
      </div>
    </app-modal>
  `,
  styles: [`
    .fwd { display: flex; flex-direction: column; gap: 12px; }
    .fwd__search { display: flex; align-items: center; gap: 6px; height: 34px; padding: 0 10px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); }
    .fwd__search:focus-within { border-color: var(--color-accent); }
    .fwd__search svg { width: 14px; height: 14px; fill: none; stroke: var(--color-text-secondary); stroke-width: 2; stroke-linecap: round; }
    .fwd__search input { width: 100%; border: 0; background: transparent; color: var(--color-text-primary); font: inherit; font-size: 13px; outline: none; }
    .fwd__list { display: flex; max-height: 320px; flex-direction: column; gap: 2px; margin: 0; padding: 0; overflow-y: auto; list-style: none; }
    .fwd__row { display: flex; align-items: center; gap: 10px; padding: 7px 8px; border-radius: 8px; cursor: pointer; }
    .fwd__row:hover { background: var(--color-surface-secondary); }
    .fwd__group { display: inline-flex; width: 22px; height: 22px; align-items: center; justify-content: center; border-radius: 6px;
      background: color-mix(in srgb, var(--color-accent) 12%, var(--color-surface)); color: var(--color-accent); font-size: 12px; font-weight: 700; }
    .fwd__group--case { background: color-mix(in srgb, var(--color-warning, #d97706) 15%, var(--color-surface)); color: var(--color-warning, #b45309); }
    .fwd__name { min-width: 0; flex: 1; overflow: hidden; font-size: 13px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
    .fwd__kind { color: var(--color-text-secondary); font-size: 11px; }
    .fwd__quiet { padding: 12px 8px; color: var(--color-text-secondary); font-size: 13px; }
    .fwd__error { margin: 0; color: var(--color-danger); font-size: 12px; }
    .fwd__actions { display: flex; justify-content: flex-end; gap: 8px; }
    .fwd__btn { height: 32px; padding: 0 14px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface);
      color: var(--color-text-primary); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
    .fwd__btn--primary { border-color: var(--color-accent); background: var(--color-accent); color: var(--color-accent-contrast, #fff); }
    .fwd__btn:disabled { opacity: .5; cursor: default; }
  `]
})
export class ForwardDialogComponent {
  private readonly chats = inject(InboxChatsStore);

  open = input(false);
  caseTitle = input('');
  /** The chat the case is forwarded from: not offered. */
  fromConversationId = input<string | null>(null);
  busy = input(false);
  error = input<string | null>(null);

  send = output<string[]>();
  closed = output<void>();

  protected readonly search = signal('');
  protected readonly chosen = signal<ReadonlySet<string>>(new Set());
  protected readonly rows = computed<InboxChatRowDto[]>(() => {
    const term = this.search().trim().toLowerCase();
    return this.chats.rows()
      .filter((r) => r.conversationId !== this.fromConversationId())
      .filter((r) => !term || r.title.toLowerCase().includes(term));
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      untracked(() => {
        this.search.set('');
        this.chosen.set(new Set());
      });
    });
  }

  protected toggle(id: string): void {
    const next = new Set(this.chosen());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.chosen.set(next);
  }

  protected fileUrl(fileId: string): string {
    return buildFileUrl(fileId);
  }
}
