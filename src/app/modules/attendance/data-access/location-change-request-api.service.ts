import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PagedResultDto } from '../models/time-tracking.model';
import {
  LocationChangeRequestQuery,
  LocationChangeRequestResponse,
  ReviewLocationChangeRequestPayload
} from '../models/location-change-request.model';

@Injectable({ providedIn: 'root' })
export class LocationChangeRequestApiService {
  private readonly http = inject(HttpClient);
  private readonly basePath = `${environment.apiUrl}/attendance/location-change-requests`;

  getApprovalInbox(query: LocationChangeRequestQuery): Observable<PagedResultDto<LocationChangeRequestResponse>> {
    return this.http.get<PagedResultDto<LocationChangeRequestResponse>>(`${this.basePath}/approvals`, {
      params: this.queryParams(query)
    });
  }

  approve(id: string, reviewComment?: string | null): Observable<LocationChangeRequestResponse> {
    return this.http.post<LocationChangeRequestResponse>(`${this.basePath}/${id}/approve`, {
      reviewComment: reviewComment ?? null
    } satisfies ReviewLocationChangeRequestPayload);
  }

  reject(id: string, reviewComment: string): Observable<LocationChangeRequestResponse> {
    return this.http.post<LocationChangeRequestResponse>(`${this.basePath}/${id}/reject`, {
      reviewComment
    } satisfies ReviewLocationChangeRequestPayload);
  }

  private queryParams(query: LocationChangeRequestQuery): HttpParams {
    let params = new HttpParams().set('pageNumber', query.pageNumber).set('pageSize', query.pageSize);
    if (query.status) params = params.set('status', query.status);
    return params;
  }
}
