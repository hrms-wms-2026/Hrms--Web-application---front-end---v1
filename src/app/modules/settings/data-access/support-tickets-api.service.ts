import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  CreateSupportTicketRequest,
  SupportTicket,
  SupportTicketAttachment,
  SupportTicketComment,
  SupportTicketDetail,
  SupportTicketPage,
  SupportTicketPriority,
  SupportTicketStatus
} from '../models/support-ticket.model';

interface TicketApi {
  id: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  category: string | null;
  created_by_name: string;
  raised_by_support: boolean;
  created_at: string;
  updated_at: string | null;
  resolved_at: string | null;
}

interface CommentApi {
  id: string;
  ticket_id: string;
  author_name: string;
  is_from_support: boolean;
  body: string;
  created_at: string;
}

interface AttachmentApi {
  id: string;
  ticket_id: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  uploaded_by_name: string;
  is_from_support: boolean;
  created_at: string;
}

interface PageApi {
  items: TicketApi[];
  total: number;
  page: number;
  page_size: number;
}

/**
 * Backend: SupportTicketsController - api/v1/support/tickets, guarded by support:manage and always scoped to the
 * caller's tenant. Internal support notes never reach this API. The support endpoints use snake_case fields.
 */
@Injectable({ providedIn: 'root' })
export class SupportTicketsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/support/tickets`;

  list(status: SupportTicketStatus | '', page: number, pageSize: number): Observable<SupportTicketPage> {
    let params = new HttpParams().set('page', page).set('page_size', pageSize);
    if (status) {
      params = params.set('status', status);
    }
    return this.http.get<PageApi>(this.baseUrl, { params }).pipe(
      map((response) => ({
        items: response.items.map(mapTicket),
        total: response.total,
        page: response.page,
        pageSize: response.page_size
      }))
    );
  }

  get(id: string): Observable<SupportTicketDetail> {
    return this.http
      .get<{ ticket: TicketApi; comments: CommentApi[]; attachments: AttachmentApi[] }>(
        `${this.baseUrl}/${encodeURIComponent(id)}`
      )
      .pipe(
        map((response) => ({
          ticket: mapTicket(response.ticket),
          comments: response.comments.map(mapComment),
          attachments: response.attachments.map(mapAttachment)
        }))
      );
  }

  create(request: CreateSupportTicketRequest): Observable<SupportTicket> {
    return this.http.post<TicketApi>(this.baseUrl, request).pipe(map(mapTicket));
  }

  /** Same body as create. 409 once the ticket is resolved or closed. */
  update(id: string, request: CreateSupportTicketRequest): Observable<SupportTicket> {
    return this.http.put<TicketApi>(`${this.baseUrl}/${encodeURIComponent(id)}`, request).pipe(map(mapTicket));
  }

  /** 409 when the ticket is closed. A reply on a resolved ticket reopens it. */
  addComment(id: string, body: string): Observable<SupportTicketComment> {
    return this.http.post<CommentApi>(`${this.baseUrl}/${encodeURIComponent(id)}/comments`, { body }).pipe(map(mapComment));
  }

  uploadAttachment(id: string, file: File): Observable<SupportTicketAttachment> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http
      .post<AttachmentApi>(`${this.baseUrl}/${encodeURIComponent(id)}/attachments`, form)
      .pipe(map(mapAttachment));
  }

  /** A short-lived signed URL for one file. */
  getDownloadUrl(id: string, attachmentId: string): Observable<string> {
    return this.http
      .get<{ url: string; expires_at: string }>(
        `${this.baseUrl}/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}/download-url`
      )
      .pipe(map((response) => response.url));
  }
}

function mapTicket(t: TicketApi): SupportTicket {
  return {
    id: t.id,
    subject: t.subject,
    description: t.description,
    status: t.status as SupportTicketStatus,
    priority: t.priority as SupportTicketPriority,
    category: t.category,
    createdByName: t.created_by_name,
    raisedBySupport: t.raised_by_support,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
    resolvedAt: t.resolved_at
  };
}

function mapComment(c: CommentApi): SupportTicketComment {
  return {
    id: c.id,
    ticketId: c.ticket_id,
    authorName: c.author_name,
    isFromSupport: c.is_from_support,
    body: c.body,
    createdAt: c.created_at
  };
}

function mapAttachment(a: AttachmentApi): SupportTicketAttachment {
  return {
    id: a.id,
    ticketId: a.ticket_id,
    fileName: a.file_name,
    contentType: a.content_type,
    sizeBytes: a.size_bytes,
    uploadedByName: a.uploaded_by_name,
    isFromSupport: a.is_from_support,
    createdAt: a.created_at
  };
}
