import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { catchError, of } from 'rxjs';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { buildFileUrl } from '../../../../shared/data-access/file-api.service';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { DropdownMenuComponent, MenuItem } from '../../../../shared/ui/dropdown-menu/dropdown-menu.component';
import { PeoplePickerComponent, PeoplePickerOption } from '../../../../shared/ui/people-picker/people-picker.component';
import { InboxApiService } from '../../data-access/inbox-api.service';
import { EmployeeDirectoryStore } from '../../../work/state/employee-directory.store';
import { ConversationsApiService } from '../../data-access/conversations-api.service';
import { ConversationParticipantDto } from '../../models/inbox.dto';
import { ConversationStore } from '../../state/conversation.store';

/** Members shown before "Show more". */
const VISIBLE_MEMBERS = 4;

/** The open ticket's chat members in the ticket details: four at first, the rest on "Show more" (from the list the chat
 *  already loaded - no extra request), photos from the shared people cache. Members can be added (+) and added members
 *  removed, with the same rules as the chat's member list (the server checks them again). */
@Component({
  selector: 'app-ticket-participants',
  standalone: true,
  imports: [AvatarComponent, DropdownMenuComponent, PeoplePickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store && store.conversationId()) {
      <section class="tp" data-testid="ticket-participants">
        <div class="tp__head">
          <h4 class="tp__label">Participants <span class="tp__count">{{ members().length }}</span></h4>
          <span class="tp__tools">
            @if (!store.removed()) {
              <button type="button" class="tp__add" data-testid="ticket-participants-add" [attr.aria-expanded]="adding()"
                aria-label="Add people" title="Add people" (click)="toggleAdd()">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
              </button>
            }
            @if (menu().length > 0) {
              <app-dropdown-menu [items]="menu()" ariaLabel="Conversation actions" (selected)="onMenu($event)">
                <button menu-trigger type="button" class="tp__add" data-testid="ticket-participants-menu" aria-label="Conversation actions" title="More">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h.01M12 12h.01M19 12h.01" /></svg>
                </button>
              </app-dropdown-menu>
            }
          </span>
        </div>

        @if (leaveConfirm()) {
          <div class="tp__confirm" data-testid="ticket-participants-leave-confirm">
            <span>Leave this conversation? You will stop seeing it.</span>
            <button type="button" class="tp__btn" (click)="leaveConfirm.set(false)">Cancel</button>
            <button type="button" class="tp__btn tp__btn--danger" data-testid="conversation-leave-confirm" (click)="leave()">Leave</button>
          </div>
        }
        @if (exportError()) { <p class="tp__error" role="alert">{{ exportError() }}</p> }

        @if (adding()) {
          <div class="tp__picker" data-testid="ticket-participants-picker">
            <app-people-picker [options]="candidates()" [selectedIds]="chosen()" placeholder="Search people to add…"
              (searchChange)="search($event)" (toggled)="toggleCandidate($event)" />
            <div class="tp__picker-actions">
              <button type="button" class="tp__btn" (click)="toggleAdd()">Cancel</button>
              <button type="button" class="tp__btn tp__btn--primary" data-testid="ticket-participants-add-confirm"
                [disabled]="chosen().length === 0" (click)="confirmAdd()">Add {{ chosen().length || '' }}</button>
            </div>
          </div>
        }

        <ul class="tp__list">
          @for (p of visible(); track p.employeeId) {
            <li class="tp__row" data-testid="ticket-participant" [attr.data-employee-id]="p.employeeId">
              <app-avatar [userName]="p.name" [avatarUrl]="avatar(p)" size="sm" />
              <span class="tp__name">{{ p.name }}{{ p.employeeId === me() ? ' (you)' : '' }}</span>
              <span class="tp__role">{{ role(p) }}</span>
              @if (canRemove(p)) {
                <button type="button" class="tp__remove" [attr.data-testid]="'ticket-participant-remove-' + p.employeeId"
                  [attr.aria-label]="'Remove ' + p.name" [attr.title]="'Remove ' + p.name" (click)="remove(p.employeeId)">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
                </button>
              }
            </li>
          }
        </ul>
        @if (members().length > limit) {
          <button type="button" class="tp__more" data-testid="ticket-participants-more" (click)="expanded.set(!expanded())">
            {{ expanded() ? 'Show less' : 'Show ' + (members().length - limit) + ' more' }}
          </button>
        }
      </section>
    }
  `,
  styles: [`
    :host { display: block; }
    .tp { display: flex; flex-direction: column; gap: 8px; }
    .tp__head { display: flex; align-items: center; justify-content: space-between; }
    .tp__tools { display: inline-flex; align-items: center; gap: 4px; }
    .tp__confirm { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; color: var(--color-text-secondary); font-size: 12px; }
    .tp__error { margin: 0; color: var(--color-danger); font-size: 12px; }
    .tp__btn--danger { border-color: var(--color-danger); color: var(--color-danger); }
    .tp__label { margin: 0; color: var(--color-text-primary); font-size: 13px; font-weight: 650; }
    .tp__count { margin-left: 4px; color: var(--color-text-secondary); font-weight: 500; }
    .tp__add, .tp__remove { display: inline-flex; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 6px;
      background: transparent; color: var(--color-text-secondary); cursor: pointer; }
    .tp__add { width: 26px; height: 26px; border: 1px solid var(--color-border); }
    .tp__remove { width: 22px; height: 22px; opacity: 0; }
    .tp__row:hover .tp__remove, .tp__remove:focus-visible { opacity: 1; }
    .tp__add:hover, .tp__remove:hover { background: var(--color-surface-secondary); color: var(--color-text-primary); }
    .tp__remove:hover { color: var(--color-danger); }
    .tp__add svg, .tp__remove svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; }
    .tp__add:focus-visible, .tp__remove:focus-visible, .tp__more:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
    .tp__list { display: flex; flex-direction: column; gap: 6px; margin: 0; padding: 0; list-style: none; }
    .tp__row { display: flex; min-width: 0; align-items: center; gap: 8px; font-size: 13px; }
    .tp__name { min-width: 0; flex: 1; overflow: hidden; color: var(--color-text-primary); font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
    .tp__role { flex: 0 0 auto; padding: 1px 8px; border-radius: 999px; background: var(--color-surface-secondary); color: var(--color-text-secondary);
      font-size: 11px; font-weight: 600; }
    .tp__more { align-self: flex-start; padding: 0; border: 0; background: none; color: var(--color-accent); font: inherit; font-size: 12px;
      font-weight: 600; cursor: pointer; }
    .tp__picker { display: flex; flex-direction: column; gap: 6px; padding: 8px; border: 1px solid var(--color-border); border-radius: 10px; }
    .tp__picker-actions { display: flex; justify-content: flex-end; gap: 6px; }
    .tp__btn { height: 28px; padding: 0 10px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface);
      color: var(--color-text-primary); font: inherit; font-size: 12px; font-weight: 500; cursor: pointer; }
    .tp__btn--primary { border-color: var(--color-accent); background: var(--color-accent); color: var(--color-accent-contrast, #fff); }
    .tp__btn:disabled { opacity: .5; cursor: default; }
  `]
})
export class TicketParticipantsComponent {
  /** Absent outside the inbox page (nothing to show then). */
  protected readonly store = inject(ConversationStore, { optional: true });
  private readonly directory = inject(EmployeeDirectoryStore);
  private readonly conversations = inject(ConversationsApiService);
  private readonly auth = inject(AuthStore);
  private readonly inboxApi = inject(InboxApiService);

  /** The ticket's requester (InboxItem.requestedBy), for the role badge. */
  readonly requesterId = input<string | null>(null);

  protected readonly limit = VISIBLE_MEMBERS;
  protected readonly expanded = signal(false);
  protected readonly adding = signal(false);
  protected readonly chosen = signal<string[]>([]);
  private readonly results = signal<PeoplePickerOption[]>([]);
  protected readonly leaveConfirm = signal(false);
  protected readonly exporting = signal(false);
  protected readonly exportError = signal<string | null>(null);

  protected readonly me = computed(() => this.auth.employeeId() ?? null);
  protected readonly members = computed<readonly ConversationParticipantDto[]>(() => this.store?.participants() ?? []);
  protected readonly visible = computed(() => (this.expanded() ? this.members() : this.members().slice(0, VISIBLE_MEMBERS)));
  private readonly myRow = computed(() => this.members().find((p) => p.employeeId === this.me()) ?? null);
  /** Added members may leave; deciders and viewers may take the investigation export (the server checks both again). */
  protected readonly canLeave = computed(() => this.myRow()?.joinReason === 'added');
  protected readonly canExport = computed(() => {
    const row = this.myRow();
    if (!row) return false;
    if (row.joinReason === 'viewer') return true;
    return row.joinReason === 'base' && row.employeeId !== this.store?.subjectEmployeeId() && row.employeeId !== this.requesterId();
  });
  protected readonly menu = computed<MenuItem[]>(() => [
    ...(this.canExport() ? [{ id: 'export', label: this.exporting() ? 'Exporting…' : 'Export conversation', disabled: this.exporting() }] : []),
    ...(this.canLeave() ? [{ id: 'leave', label: 'Leave conversation', danger: true }] : [])
  ]);
  protected readonly candidates = computed(() => {
    const ids = new Set(this.members().map((p) => p.employeeId));
    return this.results().filter((p) => !ids.has(p.id));
  });

  constructor() {
    // The chat returned each member's name and photo: put them in the shared people cache so other screens reuse them.
    effect(() => {
      const members = this.members();
      untracked(() => this.directory.seed(members.map((p) => ({ id: p.employeeId, name: p.name, avatarFileId: p.avatarFileId }))));
    });
    // Another ticket starts collapsed, with the add panel closed.
    effect(() => {
      this.store?.conversationId();
      untracked(() => {
        this.expanded.set(false);
        this.adding.set(false);
        this.chosen.set([]);
        this.leaveConfirm.set(false);
        this.exportError.set(null);
      });
    });
  }

  /** The cached photo first; the member's own file id when the cache has none. */
  protected avatar(p: ConversationParticipantDto): string | null {
    return this.directory.get(p.employeeId)?.avatarUrl ?? (p.avatarFileId ? buildFileUrl(p.avatarFileId) : null);
  }

  protected role(p: ConversationParticipantDto): string {
    if (p.joinReason === 'viewer') return 'Viewer';
    if (p.joinReason === 'added') return 'Added';
    if (p.employeeId === this.store?.subjectEmployeeId()) return 'Subject';
    if (p.employeeId === this.requesterId()) return 'Requester';
    return 'Approver';
  }

  /** Added members can be removed by any base member and by whoever added them. */
  protected canRemove(p: ConversationParticipantDto): boolean {
    if (!this.store || p.joinReason !== 'added' || p.employeeId === this.me() || this.store.removed()) return false;
    return this.myRow()?.joinReason === 'base' || p.addedByEmployeeId === this.me();
  }

  protected async remove(employeeId: string): Promise<void> {
    await this.store?.removeParticipant(employeeId);
  }

  protected onMenu(id: string): void {
    if (id === 'export') this.exportBundle();
    else if (id === 'leave') this.leaveConfirm.set(true);
  }

  protected async leave(): Promise<void> {
    this.leaveConfirm.set(false);
    await this.store?.leave();
  }

  private exportBundle(): void {
    const ref = this.store?.ref();
    if (!ref) return;
    this.exporting.set(true);
    this.exportError.set(null);
    this.inboxApi.exportItem(ref).subscribe({
      next: (blob) => {
        this.exporting.set(false);
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `inbox-${ref.source}-${ref.kind}-${ref.id}.html`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 0);
      },
      error: () => {
        this.exporting.set(false);
        this.exportError.set('You cannot export this conversation.');
      }
    });
  }

  protected toggleAdd(): void {
    this.adding.update((open) => !open);
    this.chosen.set([]);
    if (this.adding()) this.search('');
  }

  protected search(text: string): void {
    this.conversations.searchPeople(text).pipe(catchError(() => of([])))
      .subscribe((people) => this.results.set(people.map((p) => ({
        id: p.employeeId, name: p.name, avatarUrl: p.avatarFileId ? buildFileUrl(p.avatarFileId) : null
      }))));
  }

  protected toggleCandidate(id: string): void {
    this.chosen.update((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  protected async confirmAdd(): Promise<void> {
    const ids = this.chosen();
    if (ids.length === 0 || !this.store) return;
    await this.store.addParticipants(ids);
    this.adding.set(false);
    this.chosen.set([]);
  }
}
