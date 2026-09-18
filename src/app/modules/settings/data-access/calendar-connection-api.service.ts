import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  CalendarConnectionsResponse,
  CalendarOAuthProviderSlug,
  CalendarSyncDirection,
  StartCalendarConnectionResponse
} from '../models/calendar-connection.model';

@Injectable({ providedIn: 'root' })
export class CalendarConnectionApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/calendar/connections`;

  list(): Observable<CalendarConnectionsResponse> {
    return this.http.get<CalendarConnectionsResponse>(this.baseUrl);
  }

  connect(provider: CalendarOAuthProviderSlug): Observable<StartCalendarConnectionResponse> {
    return this.http.post<StartCalendarConnectionResponse>(`${this.baseUrl}/${provider}/connect`, {});
  }

  updateSyncDirection(id: string, syncDirection: CalendarSyncDirection): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${id}`, { syncDirection });
  }

  disconnect(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  triggerSync(id: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${id}/sync`, {});
  }
}
