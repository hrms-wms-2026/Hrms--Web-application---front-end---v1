import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { NotificationSetting, UpdateNotificationSettingRequest } from '../models/notification-setting.model';

/**
 * Backend: NotificationSettingsController - GET/PUT/DELETE api/v1/settings/notifications[/{eventKey}],
 * guarded by notifications:manage and always scoped to the caller's tenant.
 */
@Injectable({ providedIn: 'root' })
export class NotificationSettingsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/settings/notifications`;

  list(): Observable<NotificationSetting[]> {
    return this.http.get<NotificationSetting[]>(this.baseUrl);
  }

  /** 409 when `revision` is stale (someone else saved or reset the event meanwhile). */
  update(eventKey: string, request: UpdateNotificationSettingRequest): Observable<NotificationSetting> {
    return this.http.put<NotificationSetting>(`${this.baseUrl}/${encodeURIComponent(eventKey)}`, request);
  }

  reset(eventKey: string): Observable<NotificationSetting> {
    return this.http.delete<NotificationSetting>(`${this.baseUrl}/${encodeURIComponent(eventKey)}`);
  }
}
