import { DatePipe } from '@angular/common';
import {
  AfterViewChecked, ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, output, signal, untracked, viewChild
} from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { FileApiService, buildFileUrl } from '../../../../shared/data-access/file-api.service';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { CommentComposerComponent, ComposerUploader } from '../../../../shared/ui/comment-composer/comment-composer.component';
import { PeoplePickerComponent, PeoplePickerOption } from '../../../../shared/ui/people-picker/people-picker.component';
import { HostSlashCommand, MentionCandidate } from '../../../../shared/ui/rich-text-editor/rich-text-editor.component';
import { ConversationsApiService } from '../../data-access/conversations-api.service';
import { InboxApiService } from '../../data-access/inbox-api.service';
import { ConversationMessageDto, ConversationParticipantDto, InboxActionDto, InboxItemRef } from '../../models/inbox.dto';
import { ConversationStore } from '../../state/conversation.store';

const ADD_COMMAND = 'add';
const CONVERSATION_ATTACHMENT = 'conversation_attachment';
const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const TAG_LABELS: Record<string, string> = {
  info_request: 'Info requested', info_response: 'Info provided', justification: 'Justification'
};

function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Adds `mention--me` to the current user's mention chips so they stand out (the HTML is still rendered
 *  through Angular's sanitizer, which keeps the class). */
export function decorateMentions(html: string, me: string | null): string {
  if (!me || !html.includes('data-employee-id')) return html;
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild as HTMLElement;
  let changed = false;
  root.querySelectorAll('span.mention[data-employee-id]').forEach((chip) => {
    if (chip.getAttribute('data-employee-id') === me) {
      chip.classList.add('mention--me');
      changed = true;
    }
  });
  return changed ? root.innerHTML : html;
}

interface DayGroup {
  key: string;
  label: string;
  messages: ConversationMessageDto[];
}

/** The live group chat of one inbox item: members (+ add), messages (by day, own on the right, system
 *  lines centred, unread divider, load older), and a composer with @mentions, add-and-tag and the item's
 *  actions in its "/" menu. */
@Component({
  selector: 'app-conversation-panel',
  standalone: true,
  imports: [DatePipe, AvatarComponent, CommentComposerComponent, PeoplePickerComponent],
  providers: [ConversationStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="conv" data-testid="conversation-panel" aria-label="Conversation">
      <header class="conv__header">
        <div class="conv__label">Conversation</div>
        <button type="button" class="conv__members" data-testid="conversation-members" [attr.title]="membersTooltip()"
          [attr.aria-expanded]="membersOpen()" aria-label="People in this conversation" (click)="membersOpen.set(!membersOpen())">
          @for (p of visibleMembers(); track p.employeeId) {
            <app-avatar class="conv__member" [userName]="p.name" [avatarUrl]="avatarUrl(p.avatarFileId)" size="xs" />
          }
          @if (extraMembers() > 0) { <span class="conv__more">+{{ extraMembers() }}</span> }
        </button>
        @if (canExport()) {
          <button type="button" class="conv__add-btn" data-testid="conversation-export" [disabled]="exporting()" (click)="exportBundle()">Export</button>
        }
        @if (!store.removed()) {
          <button type="button" class="conv__add-btn" data-testid="conversation-add-member" (click)="toggleAdd()">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 20a6 6 0 0 0-12 0" /><path d="M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" /><path d="M19 8v6M16 11h6" /></svg>
            Add
          </button>
        }
      </header>

      @if (membersOpen()) {
        <div class="conv__people" data-testid="conversation-people" role="list">
          @for (p of store.participants(); track p.employeeId) {
            <div class="conv__person" role="listitem" data-testid="conversation-participant" [attr.data-employee-id]="p.employeeId">
              <app-avatar [userName]="p.name" [avatarUrl]="avatarUrl(p.avatarFileId)" size="xs" />
              <span class="conv__person-name">{{ p.name }}{{ p.employeeId === me() ? ' (you)' : '' }}</span>
              <span class="conv__role" data-testid="participant-role">{{ role(p) }}</span>
              @if (canRemove(p)) {
                <button type="button" class="conv__link" [attr.data-testid]="'participant-remove-' + p.employeeId"
                  [attr.aria-label]="'Remove ' + p.name" (click)="remove(p.employeeId)">Remove</button>
              }
            </div>
          }
          @if (canLeave()) {
            @if (leaveConfirm()) {
              <div class="conv__person conv__person--confirm">
                <span>Leave this conversation? You will stop seeing it.</span>
                <button type="button" class="conv__link" (click)="leaveConfirm.set(false)">Cancel</button>
                <button type="button" class="conv__link conv__link--danger" data-testid="conversation-leave-confirm" (click)="leave()">Leave</button>
              </div>
            } @else {
              <button type="button" class="conv__link conv__link--danger" data-testid="conversation-leave" (click)="leaveConfirm.set(true)">Leave conversation</button>
            }
          }
        </div>
      }
      @if (exportError()) { <p class="conv__error" role="alert">{{ exportError() }}</p> }

      @if (addOpen()) {
        <div class="conv__add" data-testid="conversation-add-panel">
          <app-people-picker
            [options]="candidateOptions()"
            [selectedIds]="chosen()"
            placeholder="Search people to add…"
            (searchChange)="searchPeople($event)"
            (toggled)="toggleCandidate($event)"
          />
          <div class="conv__add-actions">
            <button type="button" class="conv__btn" (click)="toggleAdd()">Cancel</button>
            <button type="button" class="conv__btn conv__btn--primary" data-testid="conversation-add-confirm"
              [disabled]="chosen().length === 0" (click)="confirmAdd()">Add {{ chosen().length || '' }}</button>
          </div>
        </div>
      }

      @if (store.loading() && store.messages().length === 0) {
        <p class="conv__muted">Loading conversation…</p>
      } @else if (store.error()) {
        <p class="conv__error" role="alert">{{ store.error() }}</p>
      }

      <div #scroller class="conv__messages" data-testid="conversation-messages" (scroll)="onScroll()">
        @if (store.hasMore()) {
          <button type="button" class="conv__older" data-testid="conversation-load-older" [disabled]="store.olderLoading()" (click)="loadOlder()">
            {{ store.olderLoading() ? 'Loading…' : 'Load older messages' }}
          </button>
        }
        @if (!store.loading() && store.messages().length === 0) {
          <p class="conv__muted">No messages yet. Start the conversation.</p>
        }
        @for (group of days(); track group.key) {
          <div class="conv__day" data-testid="conversation-day"><span>{{ group.label }}</span></div>
          @for (m of group.messages; track m.id) {
            @if (m.id === unreadFromId()) {
              <div class="conv__unread" data-testid="conversation-unread-divider"><span>New</span></div>
            }
            @if (m.kind === 'system') {
              <div class="msg msg--system" [attr.data-message-id]="m.id">
                <span [innerHTML]="m.bodyHtml"></span> · <time>{{ m.createdAt | date: 'h:mm a' }}</time>
              </div>
            } @else {
              <div class="msg" [class.msg--own]="m.authorEmployeeId === me()" [class.msg--justification]="m.tag === 'justification' && !m.isDeleted"
                [attr.data-message-id]="m.id">
                @if (m.authorEmployeeId !== me()) {
                  <app-avatar class="msg__avatar" [userName]="m.authorName" [avatarUrl]="avatarUrl(m.authorAvatarFileId)" size="xs" />
                }
                <div class="msg__bubble">
                  @if (m.authorEmployeeId !== me()) { <div class="msg__author">{{ m.authorName }}</div> }
                  @if (m.tag && !m.isDeleted) { <div class="msg__tag" data-testid="message-tag">{{ tagLabel(m.tag) }}</div> }
                  @if (m.isDeleted) {
                    <div class="msg__body msg__body--deleted">Message deleted</div>
                  } @else if (editingId() === m.id) {
                    <app-comment-composer
                      [attr.data-testid]="'message-editor-' + m.id"
                      [initialContent]="m.bodyHtml"
                      [attachments]="false"
                      [collapsible]="false"
                      [showCancel]="true"
                      submitLabel="Save"
                      [enterToSend]="true"
                      [mentionCandidates]="mentionCandidates()"
                      (submitted)="saveEdit(m.id, $event)"
                      (cancelled)="editingId.set(null)"
                    />
                  } @else {
                    <div class="msg__body" [innerHTML]="body(m)"></div>
                  }
                  @if (!m.isDeleted && m.attachments?.length) {
                    <div class="msg__files">
                      @for (a of m.attachments; track a.id) {
                        <button type="button" class="msg__file" [attr.data-testid]="'attachment-' + a.id" (click)="download(a.id, a.fileName)">
                          {{ a.fileName }} <span class="msg__file-size">{{ size(a.sizeBytes) }}</span>
                        </button>
                      }
                    </div>
                  }
                  <time class="msg__time">{{ m.createdAt | date: 'h:mm a' }}@if (m.editedAt && !m.isDeleted) { <span> (edited)</span> }</time>
                </div>
                @if (m.authorEmployeeId === me() && !m.isDeleted && !store.removed() && editingId() !== m.id) {
                  <div class="msg__menu" data-testid="message-menu">
                    <button type="button" class="conv__link" [attr.data-testid]="'message-edit-' + m.id" aria-label="Edit message" (click)="editingId.set(m.id)">Edit</button>
                    <button type="button" class="conv__link conv__link--danger" [attr.data-testid]="'message-delete-' + m.id" aria-label="Delete message"
                      (click)="deleteMessage(m.id)">Delete</button>
                  </div>
                }
              </div>
            }
          }
        }
      </div>

      @if (store.sendError()) { <p class="conv__error" role="alert" data-testid="conversation-send-error">{{ store.sendError() }}</p> }

      @if (store.removed()) {
        <p class="conv__muted conv__removed" role="status" data-testid="conversation-removed">You were removed from this conversation.</p>
      } @else {
        @if (isSubject()) {
          <label class="conv__justify">
            <input type="checkbox" data-testid="conversation-justification" [checked]="justification()"
              (change)="justification.set($any($event.target).checked)" />
            Mark as justification
          </label>
        }
        <app-comment-composer
          #composer
          class="conv__composer"
          [collapsible]="false"
          submitLabel="Send"
          placeholder="Write a message, @ to mention."
          [attachments]="true"
          [uploader]="uploader"
          [enterToSend]="true"
          [mentionCandidates]="mentionCandidates()"
          [allowAddAndTag]="true"
          [mentionSearch]="mentionSearch"
          [extraSlashCommands]="slashCommands()"
          (submitted)="send($event.content, $event.mentions, $event.attachmentFileIds)"
          (slashCommand)="onSlashCommand($event)"
          (addAndTag)="addAndTag($event)"
        />
      }
    </section>
  `,
  styles: [`
    :host { display: block; }
    .conv { display: flex; flex-direction: column; gap: 10px; }
    .conv__header { display: flex; align-items: center; gap: 10px; }
    .conv__label { color: var(--color-text-secondary); font-size: 11px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
    .conv__members { display: flex; flex: 1; align-items: center; justify-content: flex-end; }
    .conv__member { margin-left: -6px; border-radius: 999px; box-shadow: 0 0 0 2px var(--color-surface); }
    .conv__more { margin-left: 4px; color: var(--color-text-secondary); font-size: 11px; font-weight: 600; }
    .conv__add-btn, .conv__btn { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); color: var(--color-text-primary); font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; }
    .conv__add-btn svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .conv__btn--primary { border-color: var(--color-accent); background: var(--color-accent); color: var(--color-accent-contrast, #fff); }
    .conv__btn:disabled { opacity: .5; cursor: default; }
    .conv__add { display: flex; flex-direction: column; gap: 8px; padding: 10px; border: 1px solid var(--color-border); border-radius: 10px; }
    .conv__add-actions { display: flex; justify-content: flex-end; gap: 8px; }
    .conv__messages { display: flex; max-height: 360px; min-height: 120px; flex-direction: column; gap: 6px; overflow-y: auto; padding: 8px 2px; }
    .conv__older { align-self: center; padding: 3px 10px; border: 0; border-radius: 999px; background: var(--color-surface-secondary); color: var(--color-text-secondary); font: inherit; font-size: 11px; cursor: pointer; }
    .conv__day, .conv__unread { display: flex; align-items: center; gap: 8px; margin: 6px 0; color: var(--color-text-secondary); font-size: 11px; font-weight: 600; }
    .conv__day::before, .conv__day::after, .conv__unread::before, .conv__unread::after { content: ''; flex: 1; height: 1px; background: var(--color-border); }
    .conv__unread { color: var(--color-danger); }
    .conv__unread::before, .conv__unread::after { background: color-mix(in srgb, var(--color-danger) 40%, transparent); }
    .conv__muted { margin: 0; color: var(--color-text-secondary); font-size: 12px; text-align: center; }
    .conv__error { margin: 0; padding: 6px 10px; border-radius: 8px; background: color-mix(in srgb, var(--color-danger) 8%, transparent); color: var(--color-danger); font-size: 12px; }
    .msg { display: flex; align-items: flex-end; gap: 6px; max-width: 88%; }
    .msg--own { align-self: flex-end; flex-direction: row-reverse; }
    .msg--system { align-self: center; max-width: 100%; color: var(--color-text-secondary); font-size: 11px; text-align: center; }
    .msg__avatar { flex: 0 0 auto; }
    .msg__bubble { min-width: 0; padding: 7px 10px; border-radius: 12px 12px 12px 4px; background: var(--color-surface-secondary); font-size: 13px; }
    .msg--own .msg__bubble { border-radius: 12px 12px 4px 12px; background: color-mix(in srgb, var(--color-accent) 14%, var(--color-surface)); }
    .msg__author { margin-bottom: 2px; color: var(--color-text-secondary); font-size: 11px; font-weight: 650; }
    .msg__body { overflow-wrap: anywhere; line-height: 1.45; }
    .msg__body ::ng-deep p, .msg__body ::ng-deep div { margin: 0; }
    .msg__body ::ng-deep .mention { padding: 0 3px; border-radius: 4px; background: color-mix(in srgb, var(--color-accent) 12%, transparent); color: var(--color-accent); font-weight: 600; }
    .msg__body ::ng-deep .mention--me { background: var(--color-accent); color: var(--color-accent-contrast, #fff); }
    .msg__time { display: block; margin-top: 2px; color: var(--color-text-secondary); font-size: 10px; text-align: right; }
    .conv__members { padding: 0; border: 0; background: none; cursor: pointer; }
    .conv__people { display: flex; flex-direction: column; gap: 2px; padding: 8px; border: 1px solid var(--color-border); border-radius: 10px; }
    .conv__person { display: flex; align-items: center; gap: 8px; padding: 4px 2px; font-size: 12px; }
    .conv__person--confirm { flex-wrap: wrap; color: var(--color-text-secondary); }
    .conv__person-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .conv__role { padding: 1px 8px; border-radius: 999px; background: var(--color-surface-secondary); color: var(--color-text-secondary); font-size: 11px; font-weight: 600; }
    .conv__link { padding: 0; border: 0; background: none; color: var(--color-accent); font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; }
    .conv__link--danger { color: var(--color-danger); }
    .conv__link:focus-visible, .conv__members:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
    .conv__removed { padding: 8px; border: 1px dashed var(--color-border); border-radius: 8px; }
    .conv__justify { display: inline-flex; align-items: center; gap: 6px; color: var(--color-text-secondary); font-size: 12px; }
    .msg { position: relative; }
    .msg__menu { display: flex; gap: 8px; align-self: center; opacity: 0; transition: opacity .1s; }
    .msg:hover .msg__menu, .msg:focus-within .msg__menu { opacity: 1; }
    .msg__body--deleted { color: var(--color-text-secondary); font-style: italic; }
    .msg__tag { margin-bottom: 2px; color: var(--color-accent); font-size: 10px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
    .msg--justification .msg__bubble { border: 1px solid color-mix(in srgb, var(--color-warning, #d97706) 55%, transparent); background: color-mix(in srgb, var(--color-warning, #d97706) 10%, var(--color-surface)); }
    .msg--justification .msg__tag { color: var(--color-warning, #d97706); }
    .msg__files { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
    .msg__file { padding: 2px 8px; border: 1px solid var(--color-border); border-radius: 999px; background: var(--color-surface); color: var(--color-text-primary); font: inherit; font-size: 11px; cursor: pointer; }
    .msg__file-size { color: var(--color-text-secondary); }
  `]
})
export class ConversationPanelComponent implements AfterViewChecked {
  protected readonly store = inject(ConversationStore);
  private readonly auth = inject(AuthStore);
  private readonly conversations = inject(ConversationsApiService);

  /** The inbox item whose conversation this is. */
  itemRef = input.required<InboxItemRef>();
  /** The item's available actions, offered in the composer's "/" menu. */
  actions = input<readonly InboxActionDto[]>([]);
  /** A "/" action was picked: the host runs it exactly like its action-bar button. */
  action = output<string>();
  /** The item's requester (InboxItem.requestedBy), for the role badge. */
  requesterId = input<string | null>(null);

  private readonly files = inject(FileApiService);
  private readonly inboxApi = inject(InboxApiService);

  /** Chat attachments upload as conversation_attachment: at most 5 per message, 25 MB each. */
  protected readonly uploader: ComposerUploader = {
    upload: (file: File) => this.files.upload(file, CONVERSATION_ATTACHMENT).pipe(
      map((f) => ({ fileId: f.fileId, originalFileName: f.originalFileName, fileSizeBytes: f.fileSizeBytes }))),
    maxFiles: MAX_ATTACHMENTS,
    maxBytes: MAX_ATTACHMENT_BYTES
  };
  protected readonly membersOpen = signal(false);
  protected readonly leaveConfirm = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly justification = signal(false);
  protected readonly exporting = signal(false);
  protected readonly exportError = signal<string | null>(null);

  private readonly myRow = computed(() => this.store.participants().find((p) => p.employeeId === this.me()) ?? null);
  protected readonly isSubject = computed(() => !!this.me() && this.me() === this.store.subjectEmployeeId());
  protected readonly canLeave = computed(() => this.myRow()?.joinReason === 'added');
  /** Deciders (base members who are neither the subject nor the requester) and viewers (e.g. HR after an escalation);
   *  the server checks again and refuses anyone else. */
  protected readonly canExport = computed(() => {
    const row = this.myRow();
    if (!row) return false;
    if (row.joinReason === 'viewer') return true;
    return row.joinReason === 'base' && row.employeeId !== this.store.subjectEmployeeId() && row.employeeId !== this.requesterId();
  });

  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  private readonly composer = viewChild<CommentComposerComponent>('composer');

  protected readonly me = computed(() => this.auth.employeeId() ?? null);
  protected readonly addOpen = signal(false);
  protected readonly chosen = signal<string[]>([]);
  protected readonly searchResults = signal<PeoplePickerOption[]>([]);
  private stickToBottom = true;
  private lastMessageCount = 0;

  protected readonly unreadFromId = computed(() => {
    const id = this.store.unreadFromId();
    const message = this.store.messages().find((m) => m.id === id);
    return message && message.authorEmployeeId !== this.me() ? id : null;
  });
  protected readonly visibleMembers = computed(() => this.store.participants().slice(0, 5));
  protected readonly extraMembers = computed(() => Math.max(0, this.store.participants().length - 5));
  protected readonly membersTooltip = computed(() => this.store.participants()
    .map((p) => (p.joinReason === 'added' ? `${p.name} (added)` : p.name)).join(', '));
  protected readonly mentionCandidates = computed<MentionCandidate[]>(() => this.store.participants()
    .filter((p) => p.employeeId !== this.me())
    .map((p) => ({ id: p.employeeId, name: p.name, avatarUrl: this.avatarUrl(p.avatarFileId) })));
  protected readonly slashCommands = computed<HostSlashCommand[]>(() => [
    ...this.actions().filter((a) => a.key !== 'open_target')
      .map((a) => ({ id: a.key, label: a.label, category: 'ACTIONS', icon: a.tone === 'danger' ? '✕' : '✓', description: 'Run on this item' })),
    { id: ADD_COMMAND, label: 'Add people', category: 'ACTIONS', icon: '+', description: 'Add someone to this conversation' }
  ]);
  protected readonly candidateOptions = computed(() => {
    const members = new Set(this.store.participantIds());
    return this.searchResults().filter((p) => !members.has(p.id));
  });

  protected readonly days = computed<DayGroup[]>(() => {
    const groups: DayGroup[] = [];
    for (const m of this.store.messages()) {
      const date = new Date(m.createdAt);
      const key = date.toDateString();
      let group = groups[groups.length - 1];
      if (!group || group.key !== key) {
        group = { key, label: this.dayLabel(date), messages: [] };
        groups.push(group);
      }
      group.messages.push(m);
    }
    return groups;
  });

  /** For add-and-tag in the composer: any active colleague (the tenant-wide conversation lookup, not the
   *  permission-scoped People directory). A failed lookup just offers nobody. */
  protected readonly mentionSearch = (query: string): Observable<readonly MentionCandidate[]> =>
    this.conversations.searchPeople(query).pipe(
      map((people) => people.map((p) => ({ id: p.employeeId, name: p.name, avatarUrl: this.avatarUrl(p.avatarFileId) }))),
      catchError(() => of([])));

  constructor() {
    effect(() => {
      const ref = this.itemRef();
      untracked(() => {
        this.stickToBottom = true;
        void this.store.open(ref);
      });
    });
  }

  ngAfterViewChecked(): void {
    // Follow new messages only when the reader is already at the bottom.
    const count = this.store.messages().length;
    if (count !== this.lastMessageCount) {
      const grewAtEnd = count > this.lastMessageCount;
      this.lastMessageCount = count;
      if (grewAtEnd && this.stickToBottom) this.scrollToBottom();
    }
  }

  protected onScroll(): void {
    const el = this.scroller()?.nativeElement;
    if (!el) return;
    this.stickToBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (el.scrollTop === 0 && this.store.hasMore()) void this.loadOlder();
  }

  protected async loadOlder(): Promise<void> {
    const el = this.scroller()?.nativeElement;
    const before = el ? el.scrollHeight : 0;
    this.stickToBottom = false;
    await this.store.loadOlder();
    // Keep the reader's place after older messages are prepended.
    queueMicrotask(() => { if (el) el.scrollTop = el.scrollHeight - before; });
  }

  protected body(message: ConversationMessageDto): string {
    return decorateMentions(message.bodyHtml, this.me());
  }

  protected avatarUrl(fileId: string | null | undefined): string | null {
    return fileId ? buildFileUrl(fileId) : null;
  }

  protected async send(html: string, mentions: string[], attachmentFileIds: string[] = []): Promise<void> {
    this.stickToBottom = true;
    const tag = this.isSubject() && this.justification() ? 'justification' : null;
    if (await this.store.send(html, mentions, attachmentFileIds, tag)) this.justification.set(false);
  }

  protected role(p: ConversationParticipantDto): string {
    if (p.joinReason === 'viewer') return 'Viewer';
    if (p.joinReason === 'added') return 'Added';
    if (p.employeeId === this.store.subjectEmployeeId()) return 'Subject';
    if (p.employeeId === this.requesterId()) return 'Requester';
    return 'Approver';
  }

  /** Added members can be removed by any base member and by whoever added them. */
  protected canRemove(p: ConversationParticipantDto): boolean {
    if (p.joinReason !== 'added' || p.employeeId === this.me() || this.store.removed()) return false;
    return this.myRow()?.joinReason === 'base' || p.addedByEmployeeId === this.me();
  }

  protected async remove(employeeId: string): Promise<void> {
    await this.store.removeParticipant(employeeId);
  }

  protected async leave(): Promise<void> {
    this.leaveConfirm.set(false);
    if (await this.store.leave()) this.membersOpen.set(false);
  }

  protected tagLabel(tag: string): string {
    return TAG_LABELS[tag] ?? tag;
  }

  protected async saveEdit(messageId: string, event: { content: string; mentions: string[] }): Promise<void> {
    if (await this.store.editMessage(messageId, event.content, event.mentions)) this.editingId.set(null);
  }

  protected async deleteMessage(messageId: string): Promise<void> {
    await this.store.deleteMessage(messageId);
  }

  protected size(bytes: number): string {
    return bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  /** Attachments download through the authenticated endpoint and are saved from a blob (never a raw URL). */
  protected download(attachmentId: string, fileName: string): void {
    const conversationId = this.store.conversationId();
    if (!conversationId) return;
    this.conversations.attachment(conversationId, attachmentId).subscribe({
      next: (blob) => saveBlob(blob, fileName),
      error: () => this.store.markSendError('You can no longer download this file.')
    });
  }

  protected exportBundle(): void {
    this.exporting.set(true);
    this.exportError.set(null);
    const ref = this.itemRef();
    this.inboxApi.exportItem(ref).subscribe({
      next: (blob) => {
        this.exporting.set(false);
        saveBlob(blob, `inbox-${ref.source}-${ref.kind}-${ref.id}.html`);
      },
      error: () => {
        this.exporting.set(false);
        this.exportError.set('You cannot export this conversation.');
      }
    });
  }

  protected onSlashCommand(id: string): void {
    if (id === ADD_COMMAND) {
      if (!this.addOpen()) this.toggleAdd();
      return;
    }
    this.action.emit(id);
  }

  protected async addAndTag(person: MentionCandidate): Promise<void> {
    const added = await this.store.addParticipants([person.id]);
    if (added.length > 0) this.composer()?.insertMention(person);
  }

  protected toggleAdd(): void {
    this.addOpen.update((open) => !open);
    this.chosen.set([]);
    if (this.addOpen()) this.searchPeople('');
  }

  protected searchPeople(search: string): void {
    this.conversations.searchPeople(search).pipe(catchError(() => of([])))
      .subscribe((people) => this.searchResults.set(people.map((p) => ({ id: p.employeeId, name: p.name }))));
  }

  protected toggleCandidate(id: string): void {
    this.chosen.update((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  protected async confirmAdd(): Promise<void> {
    const ids = this.chosen();
    if (ids.length === 0) return;
    await this.store.addParticipants(ids);
    this.addOpen.set(false);
    this.chosen.set([]);
  }

  private scrollToBottom(): void {
    const el = this.scroller()?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }

  private dayLabel(date: Date): string {
    const today = new Date();
    const yesterday = new Date(today.getTime() - 86_400_000);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }
}
