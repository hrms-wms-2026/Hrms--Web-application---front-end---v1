import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  afterNextRender,
  inject,
  input,
  output,
  signal
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { EmployeeDocumentType, UploadEmployeeDocumentRequest } from '../../models/profile.model';
import {
  EMPLOYEE_DOCUMENT_ACCEPT,
  EMPLOYEE_DOCUMENT_CATEGORIES,
  formatFileSize,
  validateDocumentFile
} from '../../models/employee-document.config';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';

/**
 * "Upload document" popup shown centred on top of the Profile popup. The host is moved to <body> on
 * render: inside the dialog its fixed positioning would be relative to the dialog (the dialog keeps
 * a transform from its pop-in animation).
 */
@Component({
  selector: 'app-document-upload-panel',
  standalone: true,
  imports: [ButtonComponent, InputComponent],
  templateUrl: './document-upload-panel.component.html',
  styleUrl: './document-upload-panel.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'doc-upload-host',
    'animate.leave': 'ui-popup-leave',
    '(document:keydown.escape)': 'onEscape()'
  }
})
export class DocumentUploadPanelComponent implements OnInit {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);

  readonly initialType = input<EmployeeDocumentType>('cv');
  readonly uploading = input(false);
  readonly error = input<string | null>(null);

  readonly submitted = output<UploadEmployeeDocumentRequest>();
  readonly closed = output<void>();

  readonly categories = EMPLOYEE_DOCUMENT_CATEGORIES;
  readonly accept = EMPLOYEE_DOCUMENT_ACCEPT;
  readonly fileSize = formatFileSize;

  readonly type = signal<EmployeeDocumentType>('cv');
  readonly name = signal('');
  readonly file = signal<File | null>(null);
  readonly fileError = signal<string | null>(null);
  readonly dragOver = signal(false);
  readonly submittedOnce = signal(false);

  constructor() {
    afterNextRender(() => {
      this.document.body.appendChild(this.host.nativeElement);
      this.host.nativeElement.querySelector<HTMLElement>('input[type="radio"]:checked')?.focus();
    });
  }

  ngOnInit(): void {
    this.type.set(this.initialType());
  }

  onEscape(): void {
    if (!this.uploading()) this.closed.emit();
  }

  onFileInput(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const file = inputEl.files?.[0];
    inputEl.value = '';
    if (file) this.pick(file);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(true);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) this.pick(file);
  }

  clearFile(): void {
    this.file.set(null);
    this.fileError.set(null);
  }

  submit(): void {
    this.submittedOnce.set(true);
    const file = this.file();
    if (!file) {
      this.fileError.set('Choose a file to upload.');
      return;
    }
    if (this.fileError()) return;
    this.submitted.emit({ file, type: this.type(), name: this.name().trim() });
  }

  private pick(file: File): void {
    const error = validateDocumentFile(file);
    this.fileError.set(error);
    this.file.set(error ? null : file);
    if (!error && !this.name().trim()) {
      const dot = file.name.lastIndexOf('.');
      this.name.set(dot > 0 ? file.name.slice(0, dot) : file.name);
    }
  }
}
