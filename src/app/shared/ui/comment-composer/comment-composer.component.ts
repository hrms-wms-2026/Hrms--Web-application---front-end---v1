import { Component, HostListener, inject, input, output, signal, viewChild } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { TaskApiService } from '../../../modules/work/data-access/task-api.service';
import { TaskAttachmentListComponent, AttachmentPill } from '../../../modules/work/ui/task-attachment-list/task-attachment-list.component';
import { HostSlashCommand, MentionCandidate, RichTextEditorComponent } from '../rich-text-editor/rich-text-editor.component';

/** A host's own upload for composer attachments (e.g. chat files), with optional count and size limits. */
export interface ComposerUploader {
  upload(file: File): Observable<{ fileId: string; originalFileName: string; fileSizeBytes: number }>;
  maxFiles?: number;
  maxBytes?: number;
}

@Component({
  selector: 'app-comment-composer',
  standalone: true,
  imports: [TaskAttachmentListComponent, RichTextEditorComponent],
  template: `
    @if (collapsible() && !isExpanded()) {
      <div class="cc-collapsed-box" (click)="expand()" role="button" tabindex="0" (keydown.enter)="expand()" (keydown.space)="expand()" aria-label="Add a comment">
        <div class="cc-collapsed-placeholder">{{ placeholder() }}</div>
      </div>
      @if (showProTip()) {
        <div class="cc-protip">Pro tip: press <kbd class="cc-kbd">M</kbd> to comment</div>
      }
    } @else {
      <div class="cc-expanded-wrap" [class.cc-chat]="variant() === 'chat'">
        <app-rich-text-editor
          #editor
          [compact]="true"
          [cssStyles]="false"
          [initialHtml]="initialContent()"
          [placeholder]="placeholder() + ' Press / for commands'"
          ariaLabel="Comment"
          imageUploadPurpose="comment_description_image"
          [allowAttachments]="attachments()"
          [extraSlashCommands]="extraSlashCommands()"
          [mentionCandidates]="mentionCandidates()"
          [allowAddAndTag]="allowAddAndTag()"
          [mentionSearch]="mentionSearch()"
          [submitOnEnter]="enterToSend()"
          (submitRequested)="submit()"
          (htmlChange)="editorHtml.set($event)"
          (filesAttached)="onFilesSelected($event)"
          (uploadFailed)="uploadError.set($event)"
          (mentionsChange)="mentions.set($event)"
          (slashCommand)="slashCommand.emit($event)"
          (addAndTag)="addAndTag.emit($event)"
        />

        @if (attachments()) {
          <app-task-attachment-list [files]="attachedFiles()" [showAttachAction]="variant() !== 'chat'"
            (fileSelected)="onFilesSelected($event)" (removed)="removeAttachedFile($event)" />
        }

        @if (uploadError()) {
          <p class="cc-error" role="alert">{{ uploadError() }}</p>
        }

        @if (variant() === 'chat') {
          <!-- Messenger style: attach (+) on the left, a round send arrow on the right. -->
          <div class="cc-chat__bar">
            @if (attachments()) {
              <label class="cc-chat__icon-btn" title="Attach files" data-testid="composer-attach">
                <input type="file" multiple class="cc-chat__file" aria-label="Attach files" (change)="onChatFiles($event)" />
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
              </label>
            }
            <button type="button" class="cc-chat__send" data-testid="composer-send" [disabled]="isEditorEmpty()"
              [attr.aria-label]="submitLabel()" [title]="submitLabel()" (click)="submit()">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
            </button>
          </div>
        } @else {
          <div class="cc-actions">
            @if (showCancel()) {
              <button type="button" class="cc-cancel-btn" (click)="cancel()">Cancel</button>
            }
            <button type="button" class="cc-submit-btn" [disabled]="isEditorEmpty()" (click)="submit()">{{ submitLabel() }}</button>
          </div>
        }
      </div>
    }
  `,
  styles: [`
    .cc-collapsed-box {
      border: 1px solid var(--color-border);
      border-radius: 8px;
      background: var(--color-surface);
      padding: 12px 14px;
      cursor: text;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    .cc-collapsed-box:hover {
      border-color: color-mix(in srgb, var(--color-accent) 40%, var(--color-border));
    }
    .cc-collapsed-placeholder {
      color: var(--color-text-secondary);
      font-size: 14px;
      user-select: none;
    }
    .cc-protip {
      margin-top: 8px;
      font-size: 12px;
      color: var(--color-text-secondary);
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .cc-kbd {
      display: inline-block;
      padding: 1px 5px;
      font-size: 11px;
      font-family: inherit;
      font-weight: 600;
      line-height: 1.2;
      color: var(--color-text-primary);
      background-color: var(--color-surface-secondary);
      border: 1px solid var(--color-border);
      border-radius: 3px;
      box-shadow: 0 1px 1px rgba(0,0,0,0.06);
    }
    .cc-expanded-wrap { display: flex; flex-direction: column; gap: 8px; }
    /* Chat variant: one rounded box - the message on top, attach and send below (no formatting toolbar; / still works). */
    .cc-chat { gap: 4px; padding: 6px 8px; border: 1px solid var(--color-border); border-radius: 22px; background: var(--color-surface); box-shadow: 0 1px 2px rgb(0 0 0 / .04); cursor: text; transition: border-color 150ms ease, box-shadow 150ms ease; }
    .cc-chat:focus-within { border-color: color-mix(in srgb, var(--color-accent) 45%, var(--color-border)); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 12%, transparent); }
    .cc-chat ::ng-deep .tfm-editor__toolbar { display: none; }
    /* app-rich-text-editor in the selectors outranks the editor's own borderless/compact host rules. */
    .cc-chat ::ng-deep app-rich-text-editor.rte--borderless .tfm-editor,
    .cc-chat ::ng-deep app-rich-text-editor.rte--borderless .tfm-editor:focus-within { border: 0; }
    .cc-chat ::ng-deep app-rich-text-editor.rte--borderless.rte--compact .tfm-editor .tfm-editor__content { min-height: 24px; max-height: 200px; overflow-y: auto; padding: 8px 8px 4px; }
    .cc-chat .cc-error { margin: 0 8px; }
    .cc-chat__bar { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .cc-chat__icon-btn, .cc-chat__send { display: inline-flex; width: 32px; height: 32px; flex: 0 0 auto; align-items: center; justify-content: center; border: 0; border-radius: 999px; cursor: pointer; transition: background-color 150ms ease, opacity 150ms ease; }
    .cc-chat__icon-btn { position: relative; background: transparent; color: var(--color-text-primary); }
    .cc-chat__icon-btn:hover { background: var(--color-surface-secondary); }
    .cc-chat__icon-btn:focus-within, .cc-chat__send:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
    .cc-chat__file { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
    .cc-chat__send { margin-left: auto; background: var(--color-accent); color: var(--color-accent-contrast, #fff); }
    .cc-chat__send:hover:not(:disabled) { filter: brightness(.95); }
    .cc-chat__send:disabled { opacity: .4; cursor: not-allowed; }
    .cc-chat__icon-btn svg, .cc-chat__send svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .cc-error { color: var(--color-danger); font-size: 12px; margin-top: 4px; }
    .cc-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
    .cc-cancel-btn { border: 1px solid var(--color-border); background: var(--color-surface); border-radius: 6px; padding: 4px 12px; font-size: 13px; font-weight: 500; cursor: pointer; color: var(--color-text-primary); }
    .cc-cancel-btn:hover { background: var(--color-surface-secondary); }
    .cc-submit-btn { border: 0; background: var(--color-accent); color: #fff; border-radius: 6px; padding: 4px 14px; font-size: 13px; font-weight: 500; cursor: pointer; }
    .cc-submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  `]
})
export class CommentComposerComponent {
  private readonly taskApi = inject(TaskApiService);
  private readonly editor = viewChild<RichTextEditorComponent>('editor');

  initialContent = input<string>('');
  initialAttachments = input<AttachmentPill[]>([]);
  placeholder = input<string>('Write a comment...');
  submitLabel = input<string>('Comment');
  showCancel = input<boolean>(false);
  /** Starts as a one-line placeholder box that expands into the editor on click. */
  collapsible = input<boolean>(false);
  showProTip = input<boolean>(false);
  /** File attachments (attachment list + the "/attach" command). Chat turns them off. */
  attachments = input<boolean>(true);
  /** "chat": one rounded messenger box with + (attach) and a round send button; "default": the comment layout. */
  variant = input<'default' | 'chat'>('default');
  extraSlashCommands = input<readonly HostSlashCommand[]>([]);
  /** People who can be @mentioned; null turns mentions off. */
  mentionCandidates = input<readonly MentionCandidate[] | null>(null);
  allowAddAndTag = input<boolean>(false);
  mentionSearch = input<((query: string) => Observable<readonly MentionCandidate[]>) | null>(null);
  /** Enter sends, Shift+Enter adds a line (chat). */
  enterToSend = input<boolean>(false);
  /** Uploads attachments the host's way (e.g. chat files) instead of task pending uploads, with its limits. */
  uploader = input<ComposerUploader | null>(null);

  submitted = output<{ content: string; attachmentFileIds: string[]; mentions: string[] }>();
  cancelled = output<void>();
  slashCommand = output<string>();
  addAndTag = output<MentionCandidate>();

  isExpanded = signal(false);
  editorHtml = signal('');
  mentions = signal<string[]>([]);
  attachedFiles = signal<AttachmentPill[]>([]);
  uploadError = signal<string | null>(null);

  constructor() {
    this.attachedFiles.set(this.initialAttachments());
  }

  isEditorEmpty(): boolean {
    const html = this.editorHtml();
    const hasText = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim().length > 0;
    return !hasText && !/<(img|hr)[\s>/]/i.test(html) && this.attachedFiles().length === 0;
  }

  async onFilesSelected(files: FileList | File[]): Promise<void> {
    const uploader = this.uploader();
    if (uploader) {
      await this.uploadWithHost(uploader, Array.from(files));
      return;
    }
    for (const file of Array.from(files)) {
      try {
        const uploaded = await firstValueFrom(this.taskApi.uploadPendingFile(file, 'comment_attachment'));
        this.attachedFiles.update(current => [...current, { fileId: uploaded.fileId, name: uploaded.originalFileName, sizeBytes: uploaded.fileSizeBytes }]);
      } catch {
        this.uploadError.set(`Could not attach "${file.name}". Try again.`);
      }
    }
  }

  /** The chat variant's own + button picks files, then the input is reset so the same file can be picked again. */
  protected onChatFiles(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) void this.onFilesSelected(Array.from(input.files));
    input.value = '';
  }

  removeAttachedFile(fileId: string): void {
    this.attachedFiles.update(current => current.filter(f => f.fileId !== fileId));
    // Host uploads are only linked when the message is sent; there is no pending task file to delete.
    if (!this.uploader()) firstValueFrom(this.taskApi.deletePendingFile(fileId)).catch(() => {});
  }

  private async uploadWithHost(uploader: ComposerUploader, files: File[]): Promise<void> {
    this.uploadError.set(null);
    for (const file of files) {
      if (uploader.maxFiles !== undefined && this.attachedFiles().length >= uploader.maxFiles) {
        this.uploadError.set(`You can attach up to ${uploader.maxFiles} files.`);
        return;
      }
      if (uploader.maxBytes !== undefined && file.size > uploader.maxBytes) {
        this.uploadError.set(`"${file.name}" is larger than the limit.`);
        continue;
      }
      try {
        const uploaded = await firstValueFrom(uploader.upload(file));
        this.attachedFiles.update(current => [...current, { fileId: uploaded.fileId, name: uploaded.originalFileName, sizeBytes: uploaded.fileSizeBytes }]);
      } catch (err) {
        const e = err as { error?: { detail?: string; message?: string } };
        this.uploadError.set(e?.error?.detail || e?.error?.message || `Could not attach "${file.name}". Try again.`);
      }
    }
  }

  expand(): void {
    this.isExpanded.set(true);
    setTimeout(() => this.editor()?.focus(), 0);
  }

  @HostListener('window:keydown', ['$event'])
  onGlobalKeydown(e: KeyboardEvent): void {
    if (!this.showProTip()) return;
    if (e.key === 'm' || e.key === 'M') {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || (target && target.isContentEditable)) {
        return;
      }
      e.preventDefault();
      this.expand();
    }
  }

  submit(): void {
    if (this.isEditorEmpty()) return;
    this.submitted.emit({ content: this.editorHtml(), attachmentFileIds: this.attachedFiles().map(f => f.fileId), mentions: this.mentions() });
    this.resetEditor();
    if (this.collapsible()) {
      this.isExpanded.set(false);
    }
  }

  cancel(): void {
    if (this.collapsible()) {
      this.resetEditor();
      this.isExpanded.set(false);
    }
    this.cancelled.emit();
  }

  /** Empties the editor, mentions and attachments - e.g. when the host switches to another thread; the editor
   *  then takes the next `initialContent`. */
  clear(): void {
    this.resetEditor();
  }

  /** Inserts a mention chip where the user typed "@..." (used after an add-and-tag completes). */
  insertMention(person: MentionCandidate): void {
    this.editor()?.insertMention(person);
  }

  private resetEditor(): void {
    this.editorHtml.set('');
    this.mentions.set([]);
    this.attachedFiles.set([]);
    this.editor()?.clear();
  }
}
