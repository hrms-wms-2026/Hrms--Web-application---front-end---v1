import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';

export interface NotificationDestinationMetadata {
  notificationType: string;
  attendanceCorrectionId: string | null;
  workAreaChangeRequestId: string | null;
  legalEntityId: string | null;
  destinationKey: string | null;
  isNavigable: boolean;
}

export interface NotificationDto {

  id: string;
  templateCode: string;
  title: string;
  body: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  destination?: NotificationDestinationMetadata | null;
}

export interface NotificationItem {
  id: string;
  templateCode: string;
  title: string;
  body: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
  notificationType?: string | null;
  attendanceCorrectionId?: string | null;
  workAreaChangeRequestId?: string | null;
  destinationKey?: string | null;
  isNavigable?: boolean;
}

@Injectable({ providedIn: 'root' })
export class NotificationApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/notifications`;

  getMine(unreadOnly = false, page = 1): Observable<NotificationDto[]> {
    const params = new HttpParams()
      .set('unreadOnly', String(unreadOnly))
      .set('page', String(page));
    return this.http.get<NotificationDto[]>(this.baseUrl, { params });
  }

  getUnreadCount(): Observable<{ count: number }> {
    return this.http.get<{ count: number }>(`${this.baseUrl}/unread-count`);
  }

  markRead(id: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${id}/read`, {});
  }

  markAllRead(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/read-all`, {});
  }
}

export function toNotificationItem(dto: NotificationDto): NotificationItem {
  return {
    id: dto.id,
    templateCode: dto.templateCode,
    title: dto.title,
    body: dto.body,
    relatedEntityType: dto.relatedEntityType,
    relatedEntityId: dto.relatedEntityId,
    isRead: dto.isRead,
    readAt: dto.readAt ? new Date(dto.readAt) : null,
        createdAt: new Date(dto.createdAt),
    notificationType: dto.destination?.notificationType ?? null,
    attendanceCorrectionId: dto.destination?.attendanceCorrectionId ?? null,
    workAreaChangeRequestId: dto.destination?.workAreaChangeRequestId ?? null,
    destinationKey: dto.destination?.destinationKey ?? null,
    isNavigable: dto.destination?.isNavigable ?? false

  };
}
