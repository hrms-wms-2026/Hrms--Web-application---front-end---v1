import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { EmployeeDocument } from '@modules/profile/models/profile.model';
import { documentFileKind, documentTypeLabel, formatFileSize, toViewableBlob } from '@modules/profile/models/employee-document.config';
import { EmployeeDocumentsApiService } from '../../data-access/employee-documents-api.service';
import { FileApiService } from '../../../../shared/data-access/file-api.service';
import { toSafeErrorMessage } from '../../../../core/services/error-handler.service';

/**
 * Personal tab card: the employee's own uploaded documents (CV, ID, certificates), read-only for
 * HR / managers. The server enforces employees:read + management coverage; a 403 shows as a quiet
 * "no access" state rather than an error.
 */
@Component({
  selector: 'app-employee-documents',
  standalone: true,
  imports: [DatePipe],
  host: { class: 'block' },
  template: `
    <section class="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs" data-testid="employee-documents-card">
      <header class="mb-3 flex items-center gap-2.5">
        <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600" aria-hidden="true">
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          </svg>
        </span>
        <div>
          <h2 class="text-sm font-bold text-slate-900">Documents</h2>
          <p class="text-[11px] text-slate-500">Uploaded by the employee from their profile</p>
        </div>
      </header>

      @if (loading()) {
        <p class="py-4 text-center text-xs text-slate-500">Loading documents…</p>
      } @else if (forbidden()) {
        <p class="py-4 text-center text-xs text-slate-500" data-testid="employee-documents-forbidden">You don't have access to this employee's documents.</p>
      } @else if (error()) {
        <p class="py-4 text-center text-xs text-rose-600" role="alert">{{ error() }}</p>
      } @else if (documents().length === 0) {
        <p class="py-4 text-center text-xs text-slate-500" data-testid="employee-documents-empty">No documents uploaded.</p>
      } @else {
        <ul class="divide-y divide-slate-100">
          @for (doc of documents(); track doc.id) {
            <li class="flex items-center gap-3 py-2" [attr.data-testid]="'employee-document-' + doc.id">
              <span
                class="flex h-7 w-6 shrink-0 items-center justify-center rounded text-[8px] font-bold text-white"
                [class.bg-red-600]="kind(doc) === 'pdf'"
                [class.bg-green-600]="kind(doc) === 'image'"
                [class.bg-blue-600]="kind(doc) === 'word'"
                [class.bg-slate-500]="kind(doc) === 'file'"
                aria-hidden="true"
              >{{ kind(doc) === 'pdf' ? 'PDF' : kind(doc) === 'image' ? 'IMG' : kind(doc) === 'word' ? 'DOC' : 'FILE' }}</span>
              <div class="min-w-0 flex-1">
                <p class="truncate text-[13px] font-semibold text-slate-900" [title]="doc.fileName">{{ doc.name }}</p>
                <p class="text-[11px] text-slate-500">
                  {{ typeLabel(doc.documentType) }} · {{ doc.uploadedAt | date: 'yyyy-MM-dd' }} · {{ fileSize(doc.fileSizeBytes) }}
                </p>
              </div>
              <button type="button" class="rounded-md px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50" (click)="open(doc, 'view')">View</button>
              <button type="button" class="rounded-md px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100" (click)="open(doc, 'download')">Download</button>
            </li>
          }
        </ul>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeDocumentsComponent {
  private readonly api = inject(EmployeeDocumentsApiService);
  private readonly fileApi = inject(FileApiService);

  readonly employeeId = input.required<string>();

  readonly documents = signal<EmployeeDocument[]>([]);
  readonly loading = signal(false);
  readonly forbidden = signal(false);
  readonly error = signal<string | null>(null);

  readonly typeLabel = documentTypeLabel;
  readonly fileSize = formatFileSize;

  constructor() {
    effect(() => {
      const id = this.employeeId();
      untracked(() => void this.load(id));
    });
  }

  kind(doc: EmployeeDocument): string {
    return documentFileKind(doc.fileName, doc.contentType);
  }

  async load(employeeId: string): Promise<void> {
    this.loading.set(true);
    this.forbidden.set(false);
    this.error.set(null);
    try {
      this.documents.set(await firstValueFrom(this.api.list(employeeId)));
    } catch (err) {
      if ((err as { status?: number })?.status === 403) {
        this.forbidden.set(true);
      } else {
        this.error.set(toSafeErrorMessage(err, 'Failed to load documents.'));
      }
    } finally {
      this.loading.set(false);
    }
  }

  async open(doc: EmployeeDocument, action: 'view' | 'download'): Promise<void> {
    try {
      const blob = await firstValueFrom(this.fileApi.download(doc.fileId));
      const viewable = action === 'view' ? toViewableBlob(blob, doc.fileName) : null;
      const url = URL.createObjectURL(viewable ?? blob);
      if (viewable) {
        window.open(url, '_blank', 'noopener');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        return;
      }
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = doc.fileName || doc.name;
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      this.error.set(toSafeErrorMessage(err, `Failed to open ${doc.name}.`));
    }
  }
}
