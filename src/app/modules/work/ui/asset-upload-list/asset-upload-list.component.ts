import { Component, input, output } from '@angular/core';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';

export interface AssetRowView {
  id: string;
  fileName: string;
  sizeBytes: number;
  status: 'staged' | 'uploading' | 'uploaded' | 'error';
  errorMessage?: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

@Component({
  selector: 'app-asset-upload-list',
  standalone: true,
  imports: [ButtonComponent],
  template: `
    <div class="flex flex-col gap-2">
      <div class="relative flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--color-border)] px-4 py-6">
        <span class="text-xs text-[var(--color-text-secondary)]">Drop files here or click to browse</span>
        <input
          data-testid="asset-file-input"
          type="file"
          multiple
          [disabled]="disabled()"
          class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          (change)="onFileInputChange($event)"
        />
      </div>

      @for (row of rows(); track row.id) {
        <div data-testid="asset-row" class="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] px-2.5 py-2">
          <div class="flex flex-col">
            <span class="text-xs font-medium text-[var(--color-text-primary)]">{{ row.fileName }}</span>
            <span class="text-[10px] text-[var(--color-text-secondary)]">
              {{ formatSize(row.sizeBytes) }}
              @if (row.status === 'staged') { · Pending upload }
              @if (row.status === 'uploading') { · Uploading… }
              @if (row.status === 'error') { · {{ row.errorMessage ?? 'Upload failed.' }} }
            </span>
          </div>
          <div class="flex items-center gap-1">
            @if (row.status === 'error') {
              <span data-testid="asset-retry-button" (click)="retryRequested.emit(row.id)">
                <app-button variant="secondary" size="sm">Retry</app-button>
              </span>
            }
            <span data-testid="asset-remove-button" (click)="removeRequested.emit(row.id)">
              <app-button variant="secondary" size="sm">Remove</app-button>
            </span>
          </div>
        </div>
      }
    </div>
  `
})
export class AssetUploadListComponent {
  rows = input<readonly AssetRowView[]>([]);
  disabled = input(false);

  filesPicked = output<File[]>();
  removeRequested = output<string>();
  retryRequested = output<string>();

  protected readonly formatSize = formatSize;

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    if (files.length > 0) {
      this.filesPicked.emit(files);
    }
    input.value = '';
  }
}
