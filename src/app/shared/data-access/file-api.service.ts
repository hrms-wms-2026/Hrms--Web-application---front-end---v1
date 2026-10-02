import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export function buildFileUrl(fileId: string): string {
  return `${environment.apiUrl}/files/${fileId}`;
}

export interface UploadedFile {
  fileId: string;
  originalFileName: string;
  fileSizeBytes: number;
  contentType: string;
}

@Injectable({ providedIn: 'root' })
export class FileApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/files`;

  /** Pure helper - no request. Streams through our own API, never object storage directly. */
  getFileUrl(fileId: string): string {
    return buildFileUrl(fileId);
  }

  upload(file: File, purpose: string): Observable<UploadedFile> {
    const formData = new FormData();
    formData.append('purpose', purpose);
    formData.append('file', file);
    return this.http.post<UploadedFile>(this.base, formData);
  }

  delete(fileId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${fileId}`);
  }
}
