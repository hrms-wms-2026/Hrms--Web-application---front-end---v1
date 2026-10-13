import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  ConversationDto,
  ConversationMessageDto,
  ConversationMessagesPageDto,
  ConversationParticipantDto,
  ConversationPersonDto,
  InboxItemRef
} from '../models/inbox.dto';

@Injectable({ providedIn: 'root' })
export class ConversationsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/conversations`;

  /** Gets or creates the item's conversation with its newest page of messages. */
  open(ref: InboxItemRef): Observable<ConversationDto> {
    return this.http.post<ConversationDto>(`${this.base}/open`, { source: ref.source, kind: ref.kind, id: ref.id });
  }

  /** Messages older than `before` (ISO), oldest first. */
  messages(conversationId: string, before: string | null): Observable<ConversationMessagesPageDto> {
    const params = before ? new HttpParams().set('before', before) : undefined;
    return this.http.get<ConversationMessagesPageDto>(`${this.base}/${conversationId}/messages`, { params });
  }

  post(conversationId: string, bodyHtml: string, mentionEmployeeIds: string[]): Observable<ConversationMessageDto> {
    return this.http.post<ConversationMessageDto>(`${this.base}/${conversationId}/messages`, { bodyHtml, mentionEmployeeIds });
  }

  addParticipants(conversationId: string, employeeIds: string[]): Observable<ConversationParticipantDto[]> {
    return this.http.post<ConversationParticipantDto[]>(`${this.base}/${conversationId}/participants`, { employeeIds });
  }

  /** Active colleagues to add or tag, by name (tenant-wide; name and avatar only). */
  searchPeople(search: string): Observable<ConversationPersonDto[]> {
    return this.http.get<ConversationPersonDto[]>(`${this.base}/people`, { params: new HttpParams().set('search', search) });
  }

  markRead(conversationId: string): Observable<void> {
    return this.http.post<void>(`${this.base}/${conversationId}/read`, {});
  }
}
