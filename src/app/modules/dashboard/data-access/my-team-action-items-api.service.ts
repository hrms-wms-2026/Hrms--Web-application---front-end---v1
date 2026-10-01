import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { TeamActionItemsResponse } from '../models/my-team-action-items.model';

@Injectable({ providedIn: 'root' })
export class MyTeamActionItemsApiService {
  private readonly http = inject(HttpClient);
  private readonly basePath = `${environment.apiUrl}/dashboard/team`;

  getActionItems(topPerSource = 5): Observable<TeamActionItemsResponse> {
    return this.http.get<TeamActionItemsResponse>(`${this.basePath}/action-items`, {
      params: new HttpParams().set('topPerSource', topPerSource)
    });
  }
}
