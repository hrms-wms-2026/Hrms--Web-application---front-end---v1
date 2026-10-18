import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { EmployeeDocument, EmployeeDocumentType } from '../../models/profile.model';
import {
  EMPLOYEE_DOCUMENT_CATEGORIES,
  documentFileKind,
  documentTypeLabel,
  formatFileSize
} from '../../models/employee-document.config';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { DataTableCellDirective, DataTableColumn, DataTableComponent } from '../../../../shared/ui/data-table/data-table.component';

export type DocumentRowAction = 'view' | 'download';

/** Profile → My documents: category shortcuts, search/filter and the uploaded-documents table. */
@Component({
  selector: 'app-documents-panel',
  standalone: true,
  imports: [DatePipe, ButtonComponent, SelectComponent, DataTableComponent, DataTableCellDirective],
  templateUrl: './documents-panel.component.html',
  styleUrls: ['../profile-panel.shared.css', './documents-panel.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocumentsPanelComponent {
  readonly documents = input.required<EmployeeDocument[]>();
  readonly loading = input(false);
  readonly loadError = input<string | null>(null);
  readonly actionError = input<string | null>(null);

  readonly uploadRequested = output<EmployeeDocumentType>();
  readonly rowAction = output<{ action: DocumentRowAction; document: EmployeeDocument }>();
  readonly deleteRequested = output<string>();
  readonly retry = output<void>();

  readonly categories = EMPLOYEE_DOCUMENT_CATEGORIES;
  readonly typeOptions: readonly SelectOption[] = [
    { value: 'all', label: 'All types' },
    ...EMPLOYEE_DOCUMENT_CATEGORIES.map((c) => ({ value: c.type, label: c.label }))
  ];

  readonly search = signal('');
  readonly typeFilter = signal<EmployeeDocumentType | 'all'>('all');
  readonly pendingDeleteId = signal<string | null>(null);

  protected readonly columns: readonly DataTableColumn[] = [
    { key: 'name', label: 'Name' },
    { key: 'type', label: 'Type' },
    { key: 'uploaded', label: 'Uploaded on' },
    { key: 'size', label: 'Size' },
    { key: 'actions', label: 'Actions', interactive: true, shrink: true, align: 'end' }
  ];
  protected readonly trackById = (doc: { id: string }): string => doc.id;
  protected readonly rowTestId = (doc: { id: string }): string => 'doc-row-' + doc.id;
  /** Rows waiting on a delete confirmation can't be opened, so only the others get the clickable styling. */
  protected readonly rowClass = (doc: { id: string }): string => (this.pendingDeleteId() === doc.id ? '' : 'data-table__row--clickable');

  readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    const type = this.typeFilter();
    return this.documents().filter(
      (d) =>
        (type === 'all' || d.documentType === type) &&
        (!term || d.name.toLowerCase().includes(term) || d.fileName.toLowerCase().includes(term))
    );
  });

  readonly typeLabel = documentTypeLabel;
  readonly fileSize = formatFileSize;

  fileKind(doc: EmployeeDocument): string {
    return documentFileKind(doc.fileName, doc.contentType);
  }

  displayName(doc: EmployeeDocument): string {
    const ext = doc.fileName.includes('.') ? doc.fileName.slice(doc.fileName.lastIndexOf('.')) : '';
    return ext && !doc.name.toLowerCase().endsWith(ext.toLowerCase()) ? `${doc.name}${ext}` : doc.name;
  }

  onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  onTypeFilter(value: string): void {
    this.typeFilter.set(value as EmployeeDocumentType | 'all');
  }

  openDocument(doc: EmployeeDocument): void {
    if (this.pendingDeleteId() !== doc.id) this.rowAction.emit({ action: 'view', document: doc });
  }

  confirmDelete(id: string): void {
    this.pendingDeleteId.set(null);
    this.deleteRequested.emit(id);
  }
}
