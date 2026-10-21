import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { InboxChatRefDto, InboxChatRowDto } from '../models/inbox-chat.dto';
import { InboxItemRef } from '../models/inbox.dto';

/** The inbox as chats (api/v1/inbox/chats). Messages go through ConversationsApiService. */
@Injectable({ providedIn: 'root' })
export class InboxChatsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/inbox/chats`;

  /** The caller's chats; loading it also places new case cards into them. */
  list(): Observable<InboxChatRowDto[]> {
    return this.http.get<InboxChatRowDto[]>(this.base);
  }

  /** The chat where the caller works on a request or alert (its group, or the 1-on-1 chat with its card). */
  forItem(ref: InboxItemRef): Observable<InboxChatRowDto> {
    return this.http.get<InboxChatRowDto>(`${this.base}/for-item/${encodeURIComponent(ref.source)}/${encodeURIComponent(ref.kind)}/${encodeURIComponent(ref.id)}`);
  }

  openDirect(employeeId: string): Observable<InboxChatRefDto> {
    return this.http.post<InboxChatRefDto>(`${this.base}/direct`, { employeeId });
  }

  createGroup(name: string, employeeIds: string[]): Observable<InboxChatRefDto> {
    return this.http.post<InboxChatRefDto>(`${this.base}/groups`, { name, employeeIds });
  }

  renameGroup(conversationId: string, name: string): Observable<void> {
    return this.http.put<void>(`${this.base}/groups/${conversationId}/name`, { name });
  }

  /** Pins (or unpins) a chat to the top of its section, for the caller only. */
  setFavorite(conversationId: string, favorite: boolean): Observable<void> {
    return this.http.put<void>(`${this.base}/${conversationId}/favorite`, { favorite });
  }

  /** Moves a case to its own group and adds people to it. */
  startCaseGroup(ref: InboxItemRef, employeeIds: string[]): Observable<InboxChatRefDto> {
    return this.http.post<InboxChatRefDto>(`${this.base}/case-group`, { source: ref.source, kind: ref.kind, id: ref.id, employeeIds });
  }
}
