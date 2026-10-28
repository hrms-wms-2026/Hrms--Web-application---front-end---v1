import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { FileApiService } from '../../../shared/data-access/file-api.service';
import { ChatMediaKind, ChatMediaPageDto, ChatSearchResultDto, InboxChatRefDto, InboxChatRowDto } from '../models/inbox-chat.dto';
import { InboxItemRef } from '../models/inbox.dto';

/** The inbox as chats (api/v1/inbox/chats). Messages go through ConversationsApiService. */
@Injectable({ providedIn: 'root' })
export class InboxChatsApiService {
  private readonly http = inject(HttpClient);
  private readonly files = inject(FileApiService);
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

  createGroup(name: string, employeeIds: string[], avatarFileId: string | null = null): Observable<InboxChatRefDto> {
    return this.http.post<InboxChatRefDto>(`${this.base}/groups`, { name, employeeIds, avatarFileId });
  }

  /** Uploads a group's photo; the returned file id goes with createGroup / startCaseGroup. */
  uploadGroupPhoto(file: File): Observable<string> {
    return this.files.upload(file, 'conversation_avatar').pipe(map((f) => f.fileId));
  }

  renameGroup(conversationId: string, name: string): Observable<void> {
    return this.http.put<void>(`${this.base}/groups/${conversationId}/name`, { name });
  }

  /** Pins (or unpins) a chat to the top of its section, for the caller only. */
  setFavorite(conversationId: string, favorite: boolean): Observable<void> {
    return this.http.put<void>(`${this.base}/${conversationId}/favorite`, { favorite });
  }

  /** Mutes (or unmutes) a chat for the caller only. */
  setMuted(conversationId: string, muted: boolean): Observable<void> {
    return this.http.put<void>(`${this.base}/${conversationId}/mute`, { muted });
  }

  /** A group's description; empty clears it. */
  setDescription(conversationId: string, description: string): Observable<void> {
    return this.http.put<void>(`${this.base}/${conversationId}/description`, { description });
  }

  /** A group's photo from an uploaded file (uploadGroupPhoto); null removes it. */
  setPhoto(conversationId: string, fileId: string | null): Observable<void> {
    return fileId
      ? this.http.put<void>(`${this.base}/${conversationId}/photo`, { fileId })
      : this.http.delete<void>(`${this.base}/${conversationId}/photo`);
  }

  /** A page of the files posted in a chat, newest first; `kind` narrows to one type. */
  media(conversationId: string, kind: ChatMediaKind | null, page: number, pageSize: number): Observable<ChatMediaPageDto> {
    const params: Record<string, string | number> = { page, pageSize };
    if (kind) params['kind'] = kind;
    return this.http.get<ChatMediaPageDto>(`${this.base}/${conversationId}/media`, { params });
  }

  /** The chat's text messages that contain the text, newest first. */
  search(conversationId: string, text: string): Observable<ChatSearchResultDto[]> {
    return this.http.get<ChatSearchResultDto[]>(`${this.base}/${conversationId}/search`, { params: { q: text } });
  }

  /** Forwards a case card into chats the caller is in; returns how many got it. */
  forward(ref: InboxItemRef, conversationIds: string[]): Observable<number> {
    return this.http.post<number>(`${this.base}/forward`, { source: ref.source, kind: ref.kind, id: ref.id, conversationIds });
  }

  /** Forwards a copy of a chat message (text and files) into chats the caller is in; returns how many got it. */
  forwardMessage(messageId: string, conversationIds: string[]): Observable<number> {
    return this.http.post<number>(`${this.base}/forward-message`, { messageId, conversationIds });
  }

  /** Moves a case to its own group and adds people to it. `name`: only when it should differ from the case title. */
  startCaseGroup(ref: InboxItemRef, employeeIds: string[], name: string | null = null, avatarFileId: string | null = null): Observable<InboxChatRefDto> {
    return this.http.post<InboxChatRefDto>(`${this.base}/case-group`, { source: ref.source, kind: ref.kind, id: ref.id, employeeIds, name, avatarFileId });
  }
}
