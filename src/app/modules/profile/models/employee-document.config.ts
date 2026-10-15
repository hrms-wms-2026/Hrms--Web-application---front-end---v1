import { EmployeeDocumentType } from './profile.model';

export interface EmployeeDocumentCategory {
  readonly type: EmployeeDocumentType;
  readonly title: string;
  readonly description: string;
  /** Short label used in the type chip, filter and upload form. */
  readonly label: string;
}

export const EMPLOYEE_DOCUMENT_CATEGORIES: readonly EmployeeDocumentCategory[] = [
  { type: 'cv', title: 'CV / Resume', label: 'CV / Resume', description: 'Your latest CV or resume files' },
  { type: 'identity', title: 'Identity document', label: 'Identity document', description: 'NIC, Passport or government ID' },
  { type: 'certificate', title: 'Certificates', label: 'Certificate', description: 'Education or training certificates' },
  { type: 'other', title: 'Other documents', label: 'Other', description: 'Any other personal documents' }
];

/** Mirrors the backend employee_document upload rule (UploadPurposeCatalog.EmployeeDocument). */
export const EMPLOYEE_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
export const EMPLOYEE_DOCUMENT_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'] as const;
export const EMPLOYEE_DOCUMENT_ACCEPT = EMPLOYEE_DOCUMENT_EXTENSIONS.join(',');

export function documentTypeLabel(type: EmployeeDocumentType): string {
  return EMPLOYEE_DOCUMENT_CATEGORIES.find((c) => c.type === type)?.label ?? 'Other';
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')} MB`;
}

export type DocumentFileKind = 'pdf' | 'image' | 'word' | 'file';

export function documentFileKind(fileName: string, contentType: string): DocumentFileKind {
  const ext = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
  if (ext === '.pdf' || contentType === 'application/pdf') return 'pdf';
  if (contentType.startsWith('image/')) return 'image';
  if (ext === '.doc' || ext === '.docx') return 'word';
  return 'file';
}

/** Returns an error message, or null when the file can be uploaded as an employee document. */
export function validateDocumentFile(file: File): string | null {
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (!(EMPLOYEE_DOCUMENT_EXTENSIONS as readonly string[]).includes(ext)) {
    return 'Unsupported format. Use PDF, JPG, PNG, DOC or DOCX.';
  }
  if (file.size > EMPLOYEE_DOCUMENT_MAX_BYTES) {
    return 'File is larger than 10 MB.';
  }
  return null;
}

const VIEWABLE_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg'
};

/**
 * Only PDFs and raster images are opened in a tab, re-typed from an allowlist keyed by the
 * file extension - never the server-reported type - so an upload can never render as HTML/SVG
 * script on the app origin. Anything else returns null and should be downloaded instead.
 */
export function toViewableBlob(blob: Blob, fileName: string): Blob | null {
  const ext = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
  const type = VIEWABLE_TYPES[ext];
  return type ? new Blob([blob], { type }) : null;
}
