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
    @if (files().length > 0) {
      <div class="tal-list">
        @for (file of files(); track file.fileId) {
          <span class="tal-pill" [class.tal-pill--uploading]="file.uploading">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
            <span>{{ file.name }}</span>
            <button type="button" class="tal-pill-remove" (click)="removed.emit(file.fileId)" aria-label="Remove attachment">×</button>
          </span>
        }
      </div>
    }

    <label class="tal-action-row" title="Attach file">
      <input type="file" multiple class="tal-file-input" (change)="onFilesSelected($event)" />
      <span class="tal-action-icon">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
      </span>
      <span>Attach file</span>
    </label>
  `,
  styles: [`
    :host { display: block; width: 100%; margin: 0; padding: 0; }
    .tal-action-row {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      margin: 0;
      padding: 6px 10px;
      border-radius: 6px;
      border: none;
      background: transparent;
      color: var(--color-text-secondary);
      font-size: 13px;
      font-weight: 500;
      font-family: inherit;
      cursor: pointer;
      box-sizing: border-box;
      transition: background-color 140ms ease, color 140ms ease;
    }
    .tal-action-row:hover {
      background: var(--color-surface-secondary);
      color: var(--color-text-primary);
    }
    .tal-action-icon {
      width: 15px;
      height: 15px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      color: inherit;
    }
    .tal-action-icon svg {
      width: 15px;
      height: 15px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .tal-file-input { display: none; }
    .tal-list { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; }
    .tal-pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: 6px; background: var(--color-surface-secondary); color: var(--color-text-primary); font-size: 12px; }
    .tal-pill--uploading { opacity: 0.6; }
    .tal-pill svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.8; }
    .tal-pill-remove { border: none; background: none; cursor: pointer; font-size: 14px; line-height: 1; padding: 0 2px; color: var(--color-text-secondary); }
    .tal-pill-remove:hover { color: var(--color-danger); }
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
