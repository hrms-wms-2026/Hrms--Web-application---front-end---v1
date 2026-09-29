import { AfterViewInit, Component, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TaskApiService } from '../../data-access/task-api.service';
import { TaskAttachmentListComponent, AttachmentPill } from '../task-attachment-list/task-attachment-list.component';
import { ColorSwatchPopoverComponent } from '../color-swatch-popover/color-swatch-popover.component';

const TEXT_SWATCHES = [
  { name: 'Red', hex: '#e03131' }, { name: 'Orange', hex: '#e8590c' }, { name: 'Yellow', hex: '#f08c00' },
  { name: 'Green', hex: '#2f9e44' }, { name: 'Blue', hex: '#1971c2' }, { name: 'Purple', hex: '#9c36b5' }, { name: 'Pink', hex: '#e64980' }
];

@Component({
  selector: 'app-comment-composer',
  standalone: true,
  imports: [TaskAttachmentListComponent, ColorSwatchPopoverComponent],
  template: `
    <div class="cc-toolbar">
      <button type="button" (mousedown)="$event.preventDefault()" (click)="format('bold')" aria-label="Bold"><b>B</b></button>
      <button type="button" (mousedown)="$event.preventDefault()" (click)="format('italic')" aria-label="Italic"><i>I</i></button>
      <button type="button" (mousedown)="$event.preventDefault()" (click)="format('underline')" aria-label="Underline"><u>U</u></button>
      <span class="cc-toolbar-popover-anchor">
        <button type="button" (mousedown)="$event.preventDefault()" (click)="colorPopoverOpen.set(!colorPopoverOpen())" aria-label="Text color">A</button>
        @if (colorPopoverOpen()) {
          <app-color-swatch-popover label="Remove color" [swatches]="swatches" (colorSelected)="applyColor($event)" />
        }
      </span>
      <span class="cc-toolbar-popover-anchor">
        <button type="button" (mousedown)="$event.preventDefault()" (click)="highlightPopoverOpen.set(!highlightPopoverOpen())" aria-label="Highlight">H</button>
        @if (highlightPopoverOpen()) {
          <app-color-swatch-popover label="Remove highlight" [swatches]="swatches" (colorSelected)="applyHighlight($event)" />
        }
      </span>
      <label class="cc-toolbar-image-btn" aria-label="Insert image">
        <input type="file" accept="image/png,image/jpeg,image/webp" class="cc-hidden-input" (change)="onImageSelected($event)" />
        🖼
      </label>
    </div>

    <div
      #editor
      class="cc-editor"
      contenteditable="true"
      [attr.data-placeholder]="placeholder()"
      (input)="onEditorInput()"
    ></div>

    <app-task-attachment-list [files]="attachedFiles()" (fileSelected)="onFilesSelected($event)" (removed)="removeAttachedFile($event)" />

    @if (uploadError()) {
      <p class="cc-error" role="alert">{{ uploadError() }}</p>
    }

    <div class="cc-actions">
      @if (showCancel()) {
        <button type="button" class="cc-cancel-btn" (click)="cancel()">Cancel</button>
      }
      <button type="button" class="cc-submit-btn" [disabled]="isEditorEmpty()" (click)="submit()">{{ submitLabel() }}</button>
    </div>
  `,
  styles: [`
    .cc-toolbar { display: flex; align-items: center; gap: 4px; margin-bottom: 4px; }
    .cc-toolbar button { border: 1px solid transparent; background: none; border-radius: 6px; width: 26px; height: 26px; cursor: pointer; }
    .cc-toolbar button:hover { background: var(--color-surface-secondary); }
    .cc-toolbar-popover-anchor { position: relative; }
    .cc-toolbar-image-btn { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 6px; cursor: pointer; }
    .cc-toolbar-image-btn:hover { background: var(--color-surface-secondary); }
    .cc-hidden-input { display: none; }
    .cc-editor { min-height: 56px; border: 1px solid var(--color-border); border-radius: 8px; padding: 8px; }
    .cc-editor:empty::before { content: attr(data-placeholder); color: var(--color-text-secondary); }
    .cc-error { color: var(--color-danger); font-size: 12px; }
    .cc-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 6px; }
  `]
})
export class CommentComposerComponent implements AfterViewInit {
  private readonly taskApi = inject(TaskApiService);
  private readonly editorRef = viewChild<ElementRef<HTMLDivElement>>('editor');
  private savedRange: Range | null = null;

  readonly swatches = TEXT_SWATCHES;

  initialContent = input<string>('');
  initialAttachments = input<AttachmentPill[]>([]);
  placeholder = input<string>('Write a comment...');
  submitLabel = input<string>('Comment');
  showCancel = input<boolean>(false);

  submitted = output<{ content: string; attachmentFileIds: string[] }>();
  cancelled = output<void>();

  editorHtml = signal('');
  attachedFiles = signal<AttachmentPill[]>([]);
  colorPopoverOpen = signal(false);
  highlightPopoverOpen = signal(false);
  uploadError = signal<string | null>(null);

  constructor() {
    this.attachedFiles.set(this.initialAttachments());
  }

  ngAfterViewInit(): void {
    const el = this.editorRef()?.nativeElement;
    if (el) {
      el.innerHTML = this.initialContent();
    }
    this.editorHtml.set(this.initialContent());
  }

  isEditorEmpty(): boolean {
    return this.editorHtml().replace(/<[^>]*>/g, '').trim().length === 0 && this.attachedFiles().length === 0;
  }

  onEditorInput(): void {
    const el = this.editorRef()?.nativeElement;
    this.editorHtml.set(el ? el.innerHTML : '');
  }

  format(command: 'bold' | 'italic' | 'underline'): void {
    document.execCommand(command, false);
    this.onEditorInput();
  }

  applyColor(hex: string | null): void {
    document.execCommand('foreColor', false, hex ?? undefined);
    this.colorPopoverOpen.set(false);
    this.onEditorInput();
  }

  applyHighlight(hex: string | null): void {
    document.execCommand('hiliteColor', false, hex ?? undefined);
    this.highlightPopoverOpen.set(false);
    this.onEditorInput();
  }

  private saveSelection(): void {
    const selection = window.getSelection();
    this.savedRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
  }

  private restoreSelection(): void {
    if (!this.savedRange) return;
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(this.savedRange);
  }

  async onImageSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.saveSelection();
    try {
      const uploaded = await firstValueFrom(this.taskApi.uploadPendingFile(file, 'comment_description_image'));
      this.restoreSelection();
      document.execCommand('insertImage', false, this.taskApi.getFileUrl(uploaded.fileId));
      this.onEditorInput();
    } catch {
      this.uploadError.set('Could not insert that image. Try again.');
    }
  }

  async onFilesSelected(files: FileList): Promise<void> {
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

  submit(): void {
    if (this.isEditorEmpty()) return;
    this.submitted.emit({ content: this.editorHtml(), attachmentFileIds: this.attachedFiles().map(f => f.fileId) });
    this.editorHtml.set('');
    this.attachedFiles.set([]);
    const el = this.editorRef()?.nativeElement;
    if (el) el.innerHTML = '';
  }

  cancel(): void {
    this.cancelled.emit();
  }
}
