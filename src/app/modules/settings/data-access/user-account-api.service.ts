import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { SignOutUserAccountResponse, UserAccount, UserAccountSessions } from '../models/user-account.model';

/**
 * Targets HRMS-Backend-v1 UserAccountsController (GET /api/v1/users, GET /api/v1/users/{id}/sessions,
 * POST /api/v1/users/{id}/suspend, /reactivate, /sign-out, /sessions/{sessionId}/revoke,
 * /devices/{deviceId}/revoke). Invitation resend/revoke live on the employee endpoints
 * (PeopleApiService.resendInvitation / revokeInvitation), keyed by employee id.
 */
@Injectable({ providedIn: 'root' })
export class UserAccountApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/users`;

  list(): Observable<readonly UserAccount[]> {
    return this.http.get<readonly UserAccount[]>(this.baseUrl);
  }

  suspend(userId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${userId}/suspend`, {});
  }

  reactivate(userId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${userId}/reactivate`, {});
  }

  signOut(userId: string): Observable<SignOutUserAccountResponse> {
    return this.http.post<SignOutUserAccountResponse>(`${this.baseUrl}/${userId}/sign-out`, {});
  }

  sessions(userId: string): Observable<UserAccountSessions> {
    return this.http.get<UserAccountSessions>(`${this.baseUrl}/${userId}/sessions`);
  }

  revokeSession(userId: string, sessionId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${userId}/sessions/${sessionId}/revoke`, {});
  }

  revokeDevice(userId: string, deviceId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${userId}/devices/${deviceId}/revoke`, {});
  }
}
