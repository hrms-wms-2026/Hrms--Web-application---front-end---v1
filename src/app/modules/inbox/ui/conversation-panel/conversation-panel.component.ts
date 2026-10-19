import { DatePipe } from '@angular/common';
import {
  AfterViewChecked, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, input, output, signal, untracked,
  viewChild
} from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { FileApiService, buildFileUrl } from '../../../../shared/data-access/file-api.service';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { CommentComposerComponent, ComposerUploader } from '../../../../shared/ui/comment-composer/comment-composer.component';
import { PeoplePickerComponent, PeoplePickerOption } from '../../../../shared/ui/people-picker/people-picker.component';
import { EmojiPickerComponent } from '../../../work/ui/emoji-picker/emoji-picker.component';
import { HostSlashCommand, MentionCandidate } from '../../../../shared/ui/rich-text-editor/rich-text-editor.component';
import { ConversationsApiService } from '../../data-access/conversations-api.service';
import {
  ConversationMessageDto, ConversationParticipantDto, InboxActionDto, InboxChangeDto, InboxItemDto, InboxItemRef, InboxKindDescriptorDto
} from '../../models/inbox.dto';
import { RealtimeConversationReaction } from '../../../../core/realtime/inbox-realtime.models';
import { ConversationStore } from '../../state/conversation.store';
import { ExceptionEvidenceResponse } from '../../../../shared/models/exception-evidence.model';
import { FaceEvidenceCardComponent } from '../face-evidence-card/face-evidence-card.component';
import { InboxChangeSetComponent } from '../inbox-change-set/inbox-change-set.component';
import { LeaveRequestSummaryComponent } from '../leave-request-summary/leave-request-summary.component';

const ADD_COMMAND = 'add';
const CONVERSATION_ATTACHMENT = 'conversation_attachment';
const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
/** The author may edit or delete a message for this long after sending it (the server enforces it too). */
const EDIT_WINDOW_MS = 30 * 60 * 1000;
const CLOCK_TICK_MS = 30 * 1000;
/** What the server takes for conversation_attachment (UploadPurposeCatalog). */
const ATTACHMENT_ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.xls,.xlsx,.zip';
const TAG_LABELS: Record<string, string> = {
  justification: 'Justification'
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

interface FailedSend {
  html: string;
  mentions: string[];
  attachmentFileIds: string[];
  replyToId: string | null;
}

/** How long a quoted message stays highlighted after jumping to it. */
const JUMP_HIGHLIGHT_MS = 1200;
const QUOTE_LENGTH = 120;

/** The chat of one ticket (inbox item), WhatsApp-style (its ConversationStore is provided by the host page, which shares
 *  it with the ticket details): a header with the ticket and a ⋯ menu (add member,
 *  members, export, leave), messages anchored to the bottom (latest first in view; scrolling up loads older
 *  ones), and a composer with @mentions, add-and-tag and the item's actions in its "/" menu. Each ticket keeps
 *  its own unsent draft. */
@Component({
  selector: 'app-conversation-panel',
  standalone: true,
  imports: [
    DatePipe, AvatarComponent, CommentComposerComponent, EmojiPickerComponent, FaceEvidenceCardComponent, InboxChangeSetComponent, LeaveRequestSummaryComponent,
    PeoplePickerComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="conv" data-testid="conversation-panel" aria-label="Conversation">
      <!-- No header: the ticket's title and status are in the list and the details. Only what has no other home stays. -->
      <div class="conv__float">
        <button type="button" class="conv__icon-btn conv__back" data-testid="conversation-back" aria-label="Back to tickets" (click)="back.emit()">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <button type="button" class="conv__icon-btn conv__details-toggle" [class.conv__details-toggle--always]="!detailsVisible()"
          data-testid="conversation-toggle-details" [attr.aria-pressed]="detailsVisible()"
          [attr.aria-label]="detailsVisible() ? 'Hide ticket details' : 'Show ticket details'"
          [attr.title]="detailsVisible() ? 'Hide ticket details' : 'Show ticket details'" (click)="toggleDetails.emit()">
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M15 4v16" /></svg>
        </button>
      </div>

      @if (addOpen()) {
        <div class="conv__panel" data-testid="conversation-add-panel">
          <div class="conv__panel-head"><span>Add member</span></div>
          <app-people-picker
            [options]="candidateOptions()"
            [selectedIds]="chosen()"
            placeholder="Search people to add…"
            (searchChange)="searchPeople($event)"
            (toggled)="toggleCandidate($event)"
          />
          <div class="conv__panel-actions">
            <button type="button" class="conv__btn" (click)="toggleAdd()">Cancel</button>
            <button type="button" class="conv__btn conv__btn--primary" data-testid="conversation-add-confirm"
              [disabled]="chosen().length === 0" (click)="confirmAdd()">Add {{ chosen().length || '' }}</button>
          </div>
        </div>
      }

      <div #scroller class="conv__messages scroll-fade" data-testid="conversation-messages" (scroll)="onScroll()">
        <div class="conv__spacer"></div>
        @if (store.olderLoading()) {
          <p class="conv__muted" data-testid="conversation-older-loading" aria-live="polite">Loading older messages…</p>
        }
        @if (store.loading() && store.messages().length === 0) {
          <p class="conv__muted">Loading conversation…</p>
        } @else if (store.error()) {
          <p class="conv__error" role="alert">{{ store.error() }}</p>
        } @else if (days().length === 0) {
          <p class="conv__muted">No messages yet. Start the conversation.</p>
        }
        @for (group of days(); track group.key) {
          <div class="conv__day" data-testid="conversation-day"><span>{{ group.label }}</span></div>
          @for (m of group.messages; track m.id) {
            @if (m.id === unreadFromId()) {
              <div class="conv__unread" data-testid="conversation-unread-divider"><span>New</span></div>
            }
            @if (m.kind === 'evidence') {
              @if (hasEvidence()) {
                <div class="msg msg--evidence" [class.msg--highlight]="highlightedId() === m.id" [attr.data-message-id]="m.id" data-testid="message-evidence">
                  <span class="msg__bot" [class.msg__bot--changes]="!faceEvidence()" aria-hidden="true">
                    @if (faceEvidence()) {
                      <svg viewBox="0 0 24 24"><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" /><circle cx="12" cy="11" r="3" /><path d="M8 17a4 4 0 0 1 8 0" /></svg>
                    } @else {
                      <svg viewBox="0 0 24 24"><path d="M9 5h10M9 12h10M9 19h10M5 5h.01M5 12h.01M5 19h.01" /></svg>
                    }
                  </span>
                  <div class="msg__content">
                    <div class="msg__meta">
                      <span class="msg__author">{{ evidenceLabel() }}</span>
                      <time class="msg__time">{{ m.createdAt | date: 'h:mm a' }}</time>
                      @if (canReply(m)) {
                        <span class="msg__menu">
                          <button type="button" class="conv__link" [attr.data-testid]="'message-reply-' + m.id" [attr.aria-label]="'Reply to the ' + evidenceLabel().toLowerCase()" (click)="startReply(m)">Reply</button>
                        </span>
                      }
                    </div>
                    <div class="msg__bubble">
                      @if (faceEvidence(); as ev) {
                        <app-face-evidence-card [evidence]="ev" />
                      } @else if (item()?.source === 'leave') {
                        <app-leave-request-summary [changes]="changes()" [editable]="changesEditable()" [errors]="changeErrors()"
                          (editsChange)="changesEdited.emit($event)" />
                      } @else {
                        <app-inbox-change-set data-testid="message-changes" [changes]="changes()" [editable]="changesEditable()" [errors]="changeErrors()"
                          (editsChange)="changesEdited.emit($event)" />
                      }
                    </div>
                  </div>
                </div>
              }
            } @else if (m.kind === 'system') {
              <div class="msg msg--system" [attr.data-message-id]="m.id">
                <span [innerHTML]="m.bodyHtml"></span> · <time>{{ m.createdAt | date: 'h:mm a' }}</time>
              </div>
            } @else {
              @let own = m.authorEmployeeId === me();
              <div class="msg" [class.msg--own]="own" [class.msg--justification]="m.tag === 'justification' && !m.isDeleted"
                [class.msg--highlight]="highlightedId() === m.id" [attr.data-message-id]="m.id">
                <app-avatar class="msg__avatar" [userName]="own ? 'You' : m.authorName" [avatarUrl]="avatarUrl(m.authorAvatarFileId)" size="sm" />
                <div class="msg__content">
                  <div class="msg__meta">
                    <span class="msg__author">{{ own ? 'You' : m.authorName }}</span>
                    <time class="msg__time">{{ m.createdAt | date: 'h:mm a' }}@if (m.editedAt && !m.isDeleted) { <span> (edited)</span> }</time>
                    @if (!m.isDeleted && !store.removed() && editingId() !== m.id) {
                      <span class="msg__menu" [class.msg__menu--open]="reactPickerFor() === m.id" data-testid="message-menu">
                        @if (canReply(m)) {
                          <button type="button" class="conv__link" [attr.data-testid]="'message-reply-' + m.id" aria-label="Reply to message" (click)="startReply(m)">Reply</button>
                        }
                        <span class="msg__react">
                          <button type="button" class="msg__react-btn" [attr.data-testid]="'message-react-' + m.id" aria-label="React to message"
                            title="React" aria-haspopup="dialog" [attr.aria-expanded]="reactPickerFor() === m.id" (click)="toggleReactPicker(m.id)">
                            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8.5 14.5a4 4 0 0 0 7 0" /><path d="M9 9.5h.01M15 9.5h.01" /></svg>
                          </button>
                          @if (reactPickerFor() === m.id) {
                            <div class="msg__react-backdrop" aria-hidden="true" (click)="reactPickerFor.set(null)"></div>
                            <app-emoji-picker class="msg__react-picker" [class.msg__react-picker--own]="own"
                              [attr.data-testid]="'message-react-picker-' + m.id" (emojiSelected)="react(m, $event)" />
                          }
                        </span>
                        @if (own && canChange(m)) {
                          <button type="button" class="conv__link" [attr.data-testid]="'message-edit-' + m.id" aria-label="Edit message" (click)="editingId.set(m.id)">Edit</button>
                          <button type="button" class="conv__link conv__link--danger" [attr.data-testid]="'message-delete-' + m.id" aria-label="Delete message"
                            (click)="deleteMessage(m.id)">Delete</button>
                        }
                      </span>
                    }
                  </div>
                  <div class="msg__bubble">
                    @if (m.replyTo && !m.isDeleted) {
                      <button type="button" class="msg__quote" data-testid="message-quote" [attr.aria-label]="'Go to the message from ' + quoteAuthor(m.replyTo)"
                        (click)="jumpTo(m.replyTo.id)">
                        <span class="msg__quote-author">{{ quoteAuthor(m.replyTo) }}</span>
                        <span class="msg__quote-text">{{ quoteText(m.replyTo) }}</span>
                      </button>
                    }
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
                          <button type="button" class="msg__file" [attr.data-testid]="'attachment-' + a.id" [attr.aria-label]="'Download ' + a.fileName"
                            (click)="download(a.id, a.fileName)">
                            <svg class="msg__file-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></svg>
                            <span class="msg__file-text">
                              <span class="msg__file-name">{{ a.fileName }}</span>
                              <span class="msg__file-size">{{ size(a.sizeBytes) }}</span>
                            </span>
                            <svg class="msg__file-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>
                          </button>
                        }
                      </div>
                    }
                  </div>
                  @if (!m.isDeleted && m.reactions?.length) {
                    <div class="msg__reactions" [attr.data-testid]="'message-reactions-' + m.id">
                      @for (r of m.reactions; track r.emoji) {
                        <button type="button" class="msg__reaction" [class.msg__reaction--mine]="isMine(r)" [attr.aria-pressed]="isMine(r)"
                          [attr.title]="reactorNames(r)" [attr.data-testid]="'reaction-' + m.id + '-' + r.emoji" [disabled]="store.removed()"
                          (click)="react(m, r.emoji)">
                          <span class="msg__reaction-emoji">{{ r.emoji }}</span><span>{{ r.employeeIds.length }}</span>
                        </button>
                      }
                    </div>
                  }
                </div>
              </div>
            }
          }
        }
      </div>

      <footer class="conv__footer">
        @if (store.sendError()) {
          <p class="conv__error" role="alert" data-testid="conversation-send-error">
            {{ store.sendError() }}
            @if (failed()) {
              <button type="button" class="conv__link" data-testid="conversation-retry" [disabled]="store.sending()" (click)="retry()">Retry</button>
            }
          </p>
        }
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
          @if (replyingTo(); as r) {
            <div class="conv__replying" data-testid="conversation-replying">
              <svg class="conv__replying-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>
              <span class="conv__replying-text"><strong>Replying to {{ quoteAuthor(r) }}</strong> {{ replyingText(r) }}</span>
              <button type="button" class="conv__icon-btn conv__replying-close" data-testid="conversation-reply-cancel" aria-label="Cancel reply"
                (click)="replyingTo.set(null)">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
          }
          <!-- Switching tickets empties the composer and loads that ticket's own draft, so text never leaks across. -->
          <app-comment-composer
            #composer
            class="conv__composer"
            variant="chat"
            [initialContent]="draftFor(refKey())"
            [collapsible]="false"
            [submitLabel]="store.sending() ? 'Sending…' : 'Send'"
            placeholder="Type a message…"
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
      </footer>
    </section>
  `,
  styles: [`
    :host { display: block; height: 100%; min-height: 0; }
    .conv { display: flex; height: 100%; min-height: 0; flex-direction: column; }
    .conv__icon-btn { display: inline-flex; width: 30px; height: 30px; flex: 0 0 auto; align-items: center; justify-content: center; border: 0; border-radius: 8px; background: transparent; color: var(--color-text-secondary); cursor: pointer; }
    .conv__icon-btn:hover { background: var(--color-surface-secondary); color: var(--color-text-primary); }
    .conv__icon-btn:focus-visible, .conv__link:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
    .conv__icon-btn svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .conv { position: relative; }
    /* The two controls that had no other home float over the chat, and only show when they are needed. */
    .conv__float { position: absolute; top: 8px; right: 8px; left: 8px; z-index: 2; display: flex; justify-content: space-between; pointer-events: none; }
    .conv__float .conv__icon-btn { pointer-events: auto; border: 1px solid var(--color-border); background: var(--color-surface); box-shadow: 0 1px 3px rgb(0 0 0 / 8%); }
    .conv__details-toggle { margin-left: auto; }
    .conv:has(.conv__details-toggle--always) .conv__messages { padding-top: 48px; }
    .conv__back { display: none; }
    .conv__details-toggle { display: none; }
    .conv__details-toggle--always { display: inline-flex; }
    .conv__panel { display: flex; flex-direction: column; gap: 6px; margin: 10px 16px 0; padding: 10px 12px; border: 1px solid var(--color-border); border-radius: 10px; background: var(--color-surface); }
    .conv__panel-head { display: flex; align-items: center; justify-content: space-between; color: var(--color-text-secondary); font-size: 12px; font-weight: 650; }
    .conv__panel-actions { display: flex; justify-content: flex-end; gap: 8px; }
    .conv__btn { display: inline-flex; align-items: center; height: 30px; padding: 0 12px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); color: var(--color-text-primary); font: inherit; font-size: 13px; font-weight: 500; cursor: pointer; }
    .conv__btn--primary { border-color: var(--color-accent); background: var(--color-accent); color: var(--color-accent-contrast, #fff); }
    .conv__btn:disabled { opacity: .5; cursor: default; }
    .conv__link { padding: 0; border: 0; background: none; color: var(--color-accent); font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; }
    .conv__link--danger { color: var(--color-danger); }
    .conv__messages { display: flex; min-height: 0; flex: 1; flex-direction: column; gap: 14px; overflow-y: auto; padding: 16px; }
    /* Pushes a short conversation to the bottom, like a messenger: the latest message sits above the composer. */
    .conv__spacer { flex: 1 0 0; }
    .conv__day, .conv__unread { display: flex; align-items: center; gap: 10px; color: var(--color-text-secondary); font-size: 12px; font-weight: 600; }
    .conv__day::before, .conv__day::after, .conv__unread::before, .conv__unread::after { content: ''; flex: 1; height: 1px; background: var(--color-border); }
    .conv__unread { color: var(--color-danger); }
    .conv__unread::before, .conv__unread::after { background: color-mix(in srgb, var(--color-danger) 40%, transparent); }
    .conv__muted { margin: 0; color: var(--color-text-secondary); font-size: 12px; text-align: center; }
    .conv__error { display: flex; align-items: center; gap: 8px; margin: 0; padding: 6px 10px; border-radius: 8px; background: color-mix(in srgb, var(--color-danger) 8%, transparent); color: var(--color-danger); font-size: 12px; }
    .msg { position: relative; display: flex; max-width: 82%; align-items: flex-start; gap: 10px; }
    .msg--own { align-self: flex-end; flex-direction: row-reverse; }
    .msg--system { align-self: center; max-width: 100%; padding: 4px 12px; border-radius: 999px; background: var(--color-surface-secondary); color: var(--color-text-secondary); font-size: 12px; text-align: center; }
    .msg__avatar { flex: 0 0 auto; }
    .msg__content { display: flex; min-width: 0; flex-direction: column; gap: 4px; }
    .msg--own .msg__content { align-items: flex-end; }
    .msg__meta { display: flex; align-items: baseline; gap: 8px; }
    .msg__author { color: var(--color-text-primary); font-size: 13px; font-weight: 650; }
    .msg__time { color: var(--color-text-secondary); font-size: 11px; }
    .msg__bubble { min-width: 0; padding: 9px 12px; border-radius: 4px 12px 12px 12px; background: var(--color-surface-secondary); color: var(--color-text-primary); font-size: 13px; }
    .msg--own .msg__bubble { border-radius: 12px 4px 12px 12px; background: color-mix(in srgb, var(--color-accent) 10%, var(--color-surface)); }
    .msg__body { overflow-wrap: anywhere; line-height: 1.5; }
    .msg__body ::ng-deep p, .msg__body ::ng-deep div { margin: 0; }
    .msg__body ::ng-deep .mention { padding: 0 3px; border-radius: 4px; background: color-mix(in srgb, var(--color-accent) 12%, transparent); color: var(--color-accent); font-weight: 600; }
    .msg__body ::ng-deep .mention--me { background: var(--color-accent); color: var(--color-accent-contrast, #fff); }
    .msg__body--deleted { color: var(--color-text-secondary); font-style: italic; }
    .msg__menu { display: inline-flex; align-items: center; gap: 8px; opacity: 0; transition: opacity .1s; }
    .msg:hover .msg__menu, .msg:focus-within .msg__menu, .msg__menu--open { opacity: 1; }
    .msg__react { position: relative; display: inline-flex; }
    .msg__react-btn { display: inline-flex; width: 22px; height: 22px; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 6px; background: transparent; color: var(--color-text-secondary); cursor: pointer; }
    .msg__react-btn:hover { background: var(--color-surface-secondary); color: var(--color-text-primary); }
    .msg__react-btn:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 1px; }
    .msg__react-btn svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .msg__react-backdrop { position: fixed; inset: 0; z-index: 40; }
    .msg__react-picker { position: absolute; top: calc(100% + 4px); left: 0; z-index: 41; }
    .msg__react-picker--own { right: 0; left: auto; }
    .msg__reactions { display: flex; flex-wrap: wrap; gap: 4px; }
    .msg__reaction { display: inline-flex; align-items: center; gap: 4px; height: 24px; padding: 0 8px; border: 1px solid var(--color-border); border-radius: 999px; background: var(--color-surface); color: var(--color-text-secondary); font: inherit; font-size: 12px; cursor: pointer; }
    .msg__reaction:hover:not(:disabled) { border-color: color-mix(in srgb, var(--color-accent) 40%, var(--color-border)); }
    .msg__reaction:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 1px; }
    .msg__reaction:disabled { cursor: default; }
    .msg__reaction--mine { border-color: var(--color-accent); background: color-mix(in srgb, var(--color-accent) 10%, var(--color-surface)); color: var(--color-accent); font-weight: 600; }
    .msg__reaction-emoji { font-size: 14px; line-height: 1; }
    .msg--highlight .msg__bubble { box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent) 55%, transparent); transition: box-shadow .2s; }
    .msg__bot { display: inline-flex; width: 32px; height: 32px; flex: 0 0 auto; align-items: center; justify-content: center; border-radius: 50%;
      background: color-mix(in srgb, var(--color-danger) 12%, var(--color-surface)); color: var(--color-danger); }
    .msg__bot svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .msg__bot--changes { background: color-mix(in srgb, var(--color-accent) 12%, var(--color-surface)); color: var(--color-accent); }
    .msg--evidence .msg__bubble { padding: 8px; background: color-mix(in srgb, var(--color-surface-secondary) 45%, var(--color-surface)); }
    .msg--evidence .msg__content { min-width: 0; flex: 1; }
    .msg__quote { position: relative; display: flex; width: 100%; min-width: 0; flex-direction: column; gap: 1px; margin-bottom: 6px;
      padding: 5px 8px 5px 14px; border: 0; border-radius: 8px; background: color-mix(in srgb, var(--color-text-primary) 5%, transparent);
      color: var(--color-text-primary); font: inherit; text-align: left; cursor: pointer; }
    .msg__quote::before { content: ''; position: absolute; top: 6px; bottom: 6px; left: 6px; width: 3px; border-radius: 2px; background: var(--color-accent); }
    .msg__quote:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 1px; }
    .msg__quote-author { color: var(--color-accent); font-size: 11px; font-weight: 700; }
    .msg__quote-text { overflow: hidden; color: var(--color-text-secondary); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
    .conv__replying { display: flex; align-items: center; gap: 8px; padding: 6px 6px 6px 12px; border-radius: 10px;
      background: var(--color-surface-secondary); font-size: 12px; }
    .conv__replying-icon { width: 16px; height: 16px; flex: 0 0 auto; fill: none; stroke: var(--color-accent); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .conv__replying-text { min-width: 0; flex: 1; overflow: hidden; color: var(--color-text-secondary); text-overflow: ellipsis; white-space: nowrap; }
    .conv__replying-text strong { margin-right: 4px; color: var(--color-text-primary); font-weight: 650; }
    .conv__replying-close { width: 24px; height: 24px; }
    .msg__tag { margin-bottom: 2px; color: var(--color-accent); font-size: 10px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
    .msg--justification .msg__bubble { border: 1px solid color-mix(in srgb, var(--color-warning, #d97706) 55%, transparent); background: color-mix(in srgb, var(--color-warning, #d97706) 10%, var(--color-surface)); }
    .msg--justification .msg__tag { color: var(--color-warning, #d97706); }
    .msg__files { display: flex; flex-direction: column; gap: 6px; margin-top: 6px; }
    .msg__file { display: flex; min-width: 220px; align-items: center; gap: 10px; padding: 8px 10px; border: 1px solid var(--color-border); border-radius: 10px; background: var(--color-surface); color: var(--color-text-primary); font: inherit; text-align: left; cursor: pointer; }
    .msg__file:hover { border-color: color-mix(in srgb, var(--color-accent) 40%, var(--color-border)); }
    .msg__file-icon { width: 18px; height: 18px; flex: 0 0 auto; fill: none; stroke: var(--color-text-secondary); stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .msg__file-text { display: flex; min-width: 0; flex: 1; flex-direction: column; }
    .msg__file-name { overflow: hidden; font-size: 12px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
    .msg__file-size { color: var(--color-text-secondary); font-size: 11px; }
    .conv__footer { display: flex; flex-direction: column; gap: 8px; padding: 12px 16px; border-top: 1px solid var(--color-border); }
    .conv__removed { padding: 8px; border: 1px dashed var(--color-border); border-radius: 8px; }
    .conv__justify { display: inline-flex; align-items: center; gap: 6px; color: var(--color-text-secondary); font-size: 12px; }
    /* Narrow screens: the chat is its own screen with a back button; the details open as a drawer. */
    @media (max-width: 1023px) {
      .conv__back, .conv__details-toggle { display: inline-flex; }
      .conv__messages { padding-top: 48px; }
      .msg { max-width: 92%; }
    }
  `]
})
export class ConversationPanelComponent implements AfterViewChecked {
  protected readonly store = inject(ConversationStore);
  private readonly auth = inject(AuthStore);
  private readonly conversations = inject(ConversationsApiService);

  /** The inbox item whose conversation this is. */
  itemRef = input.required<InboxItemRef>();
  /** The item itself, for the header (title, reference, status); null while it loads. */
  item = input<InboxItemDto | null>(null);
  /** The item's kind from the registry, for the type icon. */
  descriptor = input<InboxKindDescriptorDto | null>(null);
  /** Whether the ticket details panel is showing; the header offers to show it when it is not. */
  detailsVisible = input(true);
  /** An identity alert's face evidence: fills its "evidence" message (people can reply to it). Null for viewers without it. */
  faceEvidence = input<ExceptionEvidenceResponse | null>(null);
  /** A request's requested changes: fill its "evidence" message instead (the approver can edit them there). */
  changes = input<readonly InboxChangeDto[]>([]);
  /** The approver may edit the changes before approving. */
  changesEditable = input(false);
  /** Per-field problems found on approve. */
  changeErrors = input<Record<string, string>>({});
  /** The approver's edits to the changes; the host keeps them for approve. */
  changesEdited = output<Record<string, string>>();
  /** The item's available actions, offered in the composer's "/" menu. */
  actions = input<readonly InboxActionDto[]>([]);
  /** A "/" action was picked: the host runs it exactly like its action-bar button. */
  action = output<string>();
  /** The item's requester (InboxItem.requestedBy), for the role badge. */
  requesterId = input<string | null>(null);
  toggleDetails = output<void>();
  /** Narrow screens: back to the ticket list. */
  back = output<void>();

  private readonly files = inject(FileApiService);

  /** Chat attachments upload as conversation_attachment: at most 5 per message, 25 MB each. */
  protected readonly uploader: ComposerUploader = {
    upload: (file: File) => this.files.upload(file, CONVERSATION_ATTACHMENT).pipe(
      map((f) => ({ fileId: f.fileId, originalFileName: f.originalFileName, fileSizeBytes: f.fileSizeBytes }))),
    maxFiles: MAX_ATTACHMENTS,
    maxBytes: MAX_ATTACHMENT_BYTES,
    accept: ATTACHMENT_ACCEPT
  };
  /** The message whose emoji picker is open. */
  protected readonly reactPickerFor = signal<string | null>(null);
  /** Ticks so Edit/Delete disappear once a message's 30 minutes are over. */
  private readonly now = signal(Date.now());
  protected readonly editingId = signal<string | null>(null);
  protected readonly justification = signal(false);
  /** The last message that failed to send, kept so it can be retried as it was. */
  protected readonly failed = signal<FailedSend | null>(null);
  /** The message the next send answers (WhatsApp/Teams-style reply); cleared on send and on switching tickets. */
  protected readonly replyingTo = signal<ConversationMessageDto | null>(null);
  /** The message briefly highlighted after jumping to it from a quote. */
  protected readonly highlightedId = signal<string | null>(null);

  protected readonly isSubject = computed(() => !!this.me() && this.me() === this.store.subjectEmployeeId());

  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  private readonly composer = viewChild<CommentComposerComponent>('composer');

  protected readonly me = computed(() => this.auth.employeeId() ?? null);
  protected readonly addOpen = signal(false);
  protected readonly chosen = signal<string[]>([]);
  protected readonly searchResults = signal<PeoplePickerOption[]>([]);
  protected readonly refKey = computed(() => { const r = this.itemRef(); return `${r.source}:${r.kind}:${r.id}`; });
  /** Unsent text per ticket. */
  private readonly drafts = new Map<string, string>();
  private openKey: string | null = null;
  private stickToBottom = true;
  private lastMessageCount = 0;
  private filling = false;


  protected readonly unreadFromId = computed(() => {
    const id = this.store.unreadFromId();
    const message = this.store.messages().find((m) => m.id === id);
    return message && message.authorEmployeeId !== this.me() ? id : null;
  });
  private readonly names = computed(() => new Map(this.store.participants().map((p) => [p.employeeId, p.name])));
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
    const evidence = this.hasEvidence();
    for (const m of this.store.messages()) {
      // The evidence marker is empty: it shows only for viewers who receive the item's evidence.
      if (m.kind === 'evidence' && !evidence) continue;
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
    const tick = setInterval(() => this.now.set(Date.now()), CLOCK_TICK_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(tick));
    effect(() => {
      const ref = this.itemRef();
      const key = this.refKey();
      untracked(() => {
        // Keep what was typed for the ticket being left; its composer is swapped for the next ticket's.
        if (this.openKey && this.openKey !== key) {
          this.drafts.set(this.openKey, this.composer()?.editorHtml() ?? '');
          this.composer()?.clear();
        }
        this.openKey = key;
        this.stickToBottom = true;
        this.lastMessageCount = 0;
        this.failed.set(null);
        this.addOpen.set(false);
        this.editingId.set(null);
        this.reactPickerFor.set(null);
        this.replyingTo.set(null);
        void this.store.open(ref);
      });
    });
  }

  ngAfterViewChecked(): void {
    // A new ticket opens at its latest message; later, follow new messages only when the reader is at the bottom.
    const count = this.store.messages().length;
    if (count !== this.lastMessageCount) {
      const grewAtEnd = count > this.lastMessageCount;
      this.lastMessageCount = count;
      if (grewAtEnd && this.stickToBottom) this.scrollToBottom();
    }
    // Too few messages to scroll: fetch older ones until the view fills (there is no scroll to trigger it).
    const el = this.scroller()?.nativeElement;
    if (el && !this.filling && this.store.hasMore() && !this.store.loading() && !this.store.olderLoading()
      && el.scrollHeight <= el.clientHeight + 1) {
      this.filling = true;
      setTimeout(() => void this.loadOlder().finally(() => (this.filling = false)));
    }
  }

  protected onScroll(): void {
    const el = this.scroller()?.nativeElement;
    if (!el) return;
    this.stickToBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (el.scrollTop < 40 && this.store.hasMore()) void this.loadOlder();
  }

  protected async loadOlder(): Promise<void> {
    if (this.store.olderLoading()) return;
    const el = this.scroller()?.nativeElement;
    const before = el ? el.scrollHeight - el.scrollTop : 0;
    this.stickToBottom = false;
    await this.store.loadOlder();
    // Keep the reader's place after older messages are prepended.
    queueMicrotask(() => { if (el) el.scrollTop = el.scrollHeight - before; });
  }

  protected draftFor(key: string): string {
    return this.drafts.get(key) ?? '';
  }

  protected body(message: ConversationMessageDto): string {
    return decorateMentions(message.bodyHtml, this.me());
  }

  protected avatarUrl(fileId: string | null | undefined): string | null {
    return fileId ? buildFileUrl(fileId) : null;
  }

  protected async send(
    html: string, mentions: string[], attachmentFileIds: string[] = [], replyToId: string | null = this.replyingTo()?.id ?? null
  ): Promise<void> {
    this.stickToBottom = true;
    const key = this.refKey();
    this.drafts.delete(key);
    const tag = this.isSubject() && this.justification() ? 'justification' : null;
    this.replyingTo.set(null);
    const ok = await this.store.send(html, mentions, attachmentFileIds, tag, replyToId);
    // Only the ticket it was written in may keep (and retry) a failed message.
    if (this.refKey() !== key) return;
    if (ok) {
      this.justification.set(false);
      this.failed.set(null);
    } else {
      this.failed.set({ html, mentions, attachmentFileIds, replyToId });
    }
  }

  protected retry(): void {
    const failed = this.failed();
    if (failed) void this.send(failed.html, failed.mentions, failed.attachmentFileIds, failed.replyToId);
  }

  /** The ticket's evidence message has something to show this viewer: face checks, or a request's changes. */
  protected readonly hasEvidence = computed(() => !!this.faceEvidence() || this.changes().length > 0);
  /** What the evidence message is called (its author line and reply quotes). */
  protected readonly evidenceLabel = computed(() => (this.faceEvidence() ? 'Face checks' : 'Requested changes'));
  /** One line for a quote of the evidence message. */
  private readonly evidenceLine = computed(() => {
    if (this.faceEvidence()) return 'Photo and clock-in tries';
    if (this.item()?.source === 'leave') return this.changes().find((c) => c.field === 'leave_type')?.after ?? 'Leave';
    return this.changes().map((c) => c.label).join(', ');
  });

  /** Text messages can be answered, and the evidence message when this viewer can see it. */
  protected canReply(message: ConversationMessageDto): boolean {
    if (message.isDeleted || this.store.removed()) return false;
    return message.kind === 'text' || (message.kind === 'evidence' && this.hasEvidence());
  }

  protected startReply(message: ConversationMessageDto): void {
    this.replyingTo.set(message);
    this.composer()?.expand();
  }

  /** Who a quote is from: "You", the author, or "Face checks" for the evidence card. */
  protected quoteAuthor(quote: { kind: string; authorEmployeeId: string | null; authorName: string | null }): string {
    if (quote.kind === 'evidence') return this.evidenceLabel();
    if (quote.authorEmployeeId && quote.authorEmployeeId === this.me()) return 'You';
    return quote.authorName ?? 'A teammate';
  }

  /** One line of the quoted message, from a reply's preview. */
  protected quoteText(quote: { kind: string; excerpt: string; isDeleted: boolean }): string {
    if (quote.isDeleted) return 'Message deleted';
    if (quote.kind === 'evidence') return this.evidenceLine();
    return quote.excerpt || 'Attachment';
  }

  /** One line of the message being answered, for the bar above the composer. */
  protected replyingText(message: ConversationMessageDto): string {
    if (message.kind === 'evidence') return this.evidenceLine();
    const text = (new DOMParser().parseFromString(message.bodyHtml, 'text/html').body.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (!text) return message.attachments?.length ? 'Attachment' : '';
    return text.length > QUOTE_LENGTH ? text.slice(0, QUOTE_LENGTH - 1).trimEnd() + '…' : text;
  }

  /** Scrolls to the quoted message (when it is loaded) and highlights it for a moment. */
  protected jumpTo(messageId: string): void {
    const target = Array.from(this.scroller()?.nativeElement.querySelectorAll<HTMLElement>('[data-message-id]') ?? [])
      .find((el) => el.dataset['messageId'] === messageId);
    if (!target) return;
    this.stickToBottom = false;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    this.highlightedId.set(messageId);
    setTimeout(() => { if (this.highlightedId() === messageId) this.highlightedId.set(null); }, JUMP_HIGHLIGHT_MS);
  }


  /** The author may still edit or delete: within 30 minutes of sending (the server checks it too). */
  protected canChange(message: ConversationMessageDto): boolean {
    return this.now() - new Date(message.createdAt).getTime() <= EDIT_WINDOW_MS;
  }

  protected isMine(reaction: RealtimeConversationReaction): boolean {
    const me = this.me();
    return !!me && reaction.employeeIds.includes(me);
  }

  protected reactorNames(reaction: RealtimeConversationReaction): string {
    return reaction.employeeIds.map((id) => (id === this.me() ? 'You' : this.names().get(id) ?? 'A teammate')).join(', ');
  }

  protected toggleReactPicker(messageId: string): void {
    this.reactPickerFor.update((open) => (open === messageId ? null : messageId));
  }

  /** One reaction per person: the same emoji again removes it, another one replaces it. */
  protected async react(message: ConversationMessageDto, emoji: string): Promise<void> {
    this.reactPickerFor.set(null);
    const me = this.me();
    const mine = message.reactions?.find((r) => !!me && r.employeeIds.includes(me))?.emoji ?? null;
    await this.store.react(message.id, mine === emoji ? null : emoji);
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
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
}
