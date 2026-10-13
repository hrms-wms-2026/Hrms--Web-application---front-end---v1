import { Component, HostListener, inject, input, output, signal, viewChild } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { TaskApiService } from '../../../modules/work/data-access/task-api.service';
import { TaskAttachmentListComponent, AttachmentPill } from '../../../modules/work/ui/task-attachment-list/task-attachment-list.component';
import { HostSlashCommand, MentionCandidate, RichTextEditorComponent } from '../rich-text-editor/rich-text-editor.component';

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
      <div class="cc-expanded-wrap">
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
          <app-task-attachment-list [files]="attachedFiles()" (fileSelected)="onFilesSelected($event)" (removed)="removeAttachedFile($event)" />
        }

        @if (uploadError()) {
          <p class="cc-error" role="alert">{{ uploadError() }}</p>
        }

        <div class="cc-actions">
          @if (showCancel()) {
            <button type="button" class="cc-cancel-btn" (click)="cancel()">Cancel</button>
          }
          <button type="button" class="cc-submit-btn" [disabled]="isEditorEmpty()" (click)="submit()">{{ submitLabel() }}</button>
        </div>
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
  extraSlashCommands = input<readonly HostSlashCommand[]>([]);
  /** People who can be @mentioned; null turns mentions off. */
  mentionCandidates = input<readonly MentionCandidate[] | null>(null);
  allowAddAndTag = input<boolean>(false);
  mentionSearch = input<((query: string) => Observable<readonly MentionCandidate[]>) | null>(null);
  /** Enter sends, Shift+Enter adds a line (chat). */
  enterToSend = input<boolean>(false);

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
    for (const file of Array.from(files)) {
      try {
        const uploaded = await firstValueFrom(this.taskApi.uploadPendingFile(file, 'comment_attachment'));
        this.attachedFiles.update(current => [...current, { fileId: uploaded.fileId, name: uploaded.originalFileName, sizeBytes: uploaded.fileSizeBytes }]);
      } catch {
        this.uploadError.set(`Could not attach "${file.name}". Try again.`);
      }
    }
  }

  removeAttachedFile(fileId: string): void {
    this.attachedFiles.update(current => current.filter(f => f.fileId !== fileId));
    firstValueFrom(this.taskApi.deletePendingFile(fileId)).catch(() => {});
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
