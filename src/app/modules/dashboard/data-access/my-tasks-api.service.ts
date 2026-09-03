import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { MyTasksResponse } from '../models/my-tasks.model';

@Injectable({ providedIn: 'root' })
export class MyTasksApiService {
  private readonly http = inject(HttpClient);
  private readonly basePath = `${environment.apiUrl}/work`;

  getMyTasks(upcomingDays = 7): Observable<MyTasksResponse> {
    return this.http.get<MyTasksResponse>(`${this.basePath}/my-tasks`, {
      params: new HttpParams().set('upcomingDays', upcomingDays)
    });
  }
}
