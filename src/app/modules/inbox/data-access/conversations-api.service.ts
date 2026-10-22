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

  /** `attachmentFileIds`: files uploaded with purpose conversation_attachment (max 5); `tag`: "justification" (subject only);
   *  `replyToMessageId`: a message of this conversation the new one answers. */
  post(
    conversationId: string, bodyHtml: string, mentionEmployeeIds: string[], attachmentFileIds: string[] = [], tag: string | null = null,
    replyToMessageId: string | null = null
  ): Observable<ConversationMessageDto> {
    const body: Record<string, unknown> = { bodyHtml, mentionEmployeeIds };
    if (attachmentFileIds.length > 0) body['attachmentFileIds'] = attachmentFileIds;
    if (tag) body['tag'] = tag;
    if (replyToMessageId) body['replyToMessageId'] = replyToMessageId;
    return this.http.post<ConversationMessageDto>(`${this.base}/${conversationId}/messages`, body);
  }

  /** The author edits their message; the original stays in the audit and the export. */
  edit(conversationId: string, messageId: string, bodyHtml: string, mentionEmployeeIds: string[]): Observable<ConversationMessageDto> {
    return this.http.put<ConversationMessageDto>(`${this.base}/${conversationId}/messages/${messageId}`, { bodyHtml, mentionEmployeeIds });
  }

  /** Sets the caller's one reaction on a message (replacing an earlier one); returns the updated message. */
  react(conversationId: string, messageId: string, emoji: string): Observable<ConversationMessageDto> {
    return this.http.put<ConversationMessageDto>(`${this.base}/${conversationId}/messages/${messageId}/reaction`, { emoji });
  }

  /** Removes the caller's reaction; returns the updated message. */
  unreact(conversationId: string, messageId: string): Observable<ConversationMessageDto> {
    return this.http.delete<ConversationMessageDto>(`${this.base}/${conversationId}/messages/${messageId}/reaction`);
  }

  deleteMessage(conversationId: string, messageId: string, forEveryone: boolean): Observable<void> {
    const params = new HttpParams().set('forEveryone', forEveryone);
    return this.http.delete<void>(`${this.base}/${conversationId}/messages/${messageId}`, { params });
  }

  /** Removes an added member (base members and whoever added them may). */
  removeParticipant(conversationId: string, employeeId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${conversationId}/participants/${employeeId}`);
  }

  /** An added member leaves the conversation. */
  leave(conversationId: string): Observable<void> {
    return this.http.post<void>(`${this.base}/${conversationId}/leave`, {});
  }

  /** Downloads an attachment through the authenticated endpoint (never a raw storage URL). */
  attachment(conversationId: string, attachmentId: string): Observable<Blob> {
    return this.http.get(`${this.base}/${conversationId}/attachments/${attachmentId}`, { responseType: 'blob' });
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
