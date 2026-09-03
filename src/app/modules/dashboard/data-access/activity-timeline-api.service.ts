import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ActivityTimelineResponse } from '../models/activity-timeline.model';

@Injectable({ providedIn: 'root' })
export class ActivityTimelineApiService {
  private readonly http = inject(HttpClient);
  private readonly basePath = `${environment.apiUrl}/monitoring/activity`;

  getMyTimeline(): Observable<ActivityTimelineResponse> {
    return this.http.get<ActivityTimelineResponse>(`${this.basePath}/my-timeline`);
  }
}
