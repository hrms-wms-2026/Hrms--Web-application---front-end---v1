import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PagedResultDto } from '../models/time-tracking.model';
import {
  DeviceChangeRequestQuery,
  DeviceChangeRequestResponse,
  ReviewDeviceChangeRequestPayload
} from '../models/device-change-request.model';

@Injectable({ providedIn: 'root' })
export class DeviceChangeRequestApiService {
  private readonly http = inject(HttpClient);
  private readonly basePath = `${environment.apiUrl}/monitoring/device-change-requests`;

  getApprovalInbox(query: DeviceChangeRequestQuery): Observable<PagedResultDto<DeviceChangeRequestResponse>> {
    return this.http.get<PagedResultDto<DeviceChangeRequestResponse>>(`${this.basePath}/approvals`, {
      params: this.queryParams(query)
    });
  }

  approve(id: string, reviewComment?: string | null): Observable<DeviceChangeRequestResponse> {
    return this.http.post<DeviceChangeRequestResponse>(`${this.basePath}/${id}/approve`, {
      reviewComment: reviewComment ?? null
    } satisfies ReviewDeviceChangeRequestPayload);
  }

  reject(id: string, reviewComment: string): Observable<DeviceChangeRequestResponse> {
    return this.http.post<DeviceChangeRequestResponse>(`${this.basePath}/${id}/reject`, {
      reviewComment
    } satisfies ReviewDeviceChangeRequestPayload);
  }

  private queryParams(query: DeviceChangeRequestQuery): HttpParams {
    return new HttpParams().set('pageNumber', query.pageNumber).set('pageSize', query.pageSize);
  }
}
