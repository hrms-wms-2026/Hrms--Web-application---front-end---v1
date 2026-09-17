import { Component, input, output } from '@angular/core';

export interface AttachmentPill {
  fileId: string;
  name: string;
  sizeBytes: number;
  uploading?: boolean;
}

@Component({
  selector: 'app-task-attachment-list',
  standalone: true,
  template: `
    <label class="tal-attach-box" title="Attach files">
      <input type="file" multiple class="tal-file-input" (change)="onFilesSelected($event)" />
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
      <span>{{ files().length > 0 ? files().length + ' attached' : '+ Add files' }}</span>
    </label>

    @if (files().length > 0) {
      <div class="tal-list">
        @for (file of files(); track file.fileId) {
          <span class="tal-pill" [class.tal-pill--uploading]="file.uploading">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
            <span>{{ file.name }}</span>
            <button type="button" class="tal-pill-remove" (click)="removed.emit(file.fileId)">×</button>
          </span>
        }
      </div>
    }
  `,
  styles: [`
    :host { display: block; }
    .tal-attach-box { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border: 1px dashed var(--color-border); border-radius: 8px; cursor: pointer; font-size: 13px; color: var(--color-text-primary); }
    .tal-attach-box svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; }
    .tal-file-input { display: none; }
    .tal-list { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
    .tal-pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: 6px; background: var(--color-surface-secondary); color: var(--color-text-primary); font-size: 12px; }
    .tal-pill--uploading { opacity: 0.6; }
    .tal-pill svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2; }
    .tal-pill-remove { border: none; background: none; cursor: pointer; font-size: 14px; line-height: 1; padding: 0 2px; color: var(--color-text-secondary); }
  `]
})
export class TaskAttachmentListComponent {
  files = input.required<AttachmentPill[]>();
  fileSelected = output<FileList>();
  removed = output<string>();

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.fileSelected.emit(input.files);
      input.value = '';
    }
  }
}
