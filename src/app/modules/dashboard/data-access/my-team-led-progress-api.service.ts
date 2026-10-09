import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { LedWorkProgressResponse } from '../models/my-team-led-progress.model';

@Injectable({ providedIn: 'root' })
export class MyTeamLedProgressApiService {
  private readonly http = inject(HttpClient);
  private readonly basePath = `${environment.apiUrl}/work`;

  getLedProgress(overdueLimit = 10): Observable<LedWorkProgressResponse> {
    return this.http.get<LedWorkProgressResponse>(`${this.basePath}/led-progress`, {
      params: new HttpParams().set('overdueLimit', overdueLimit)
    });
  }
}
