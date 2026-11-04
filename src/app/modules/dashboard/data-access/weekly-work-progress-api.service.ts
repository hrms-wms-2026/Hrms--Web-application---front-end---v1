import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { WeeklyWorkProgressResponse } from '../models/weekly-work-progress.model';

/** The Weekly Work Progress widget's read. On the dashboard the current week arrives through the bootstrap. */
@Injectable({ providedIn: 'root' })
export class WeeklyWorkProgressApiService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/work/my-weekly-progress`;

  /** A week by its Monday (yyyy-MM-dd); no argument = the current week in the employee's zone. */
  get(weekStart?: string): Observable<WeeklyWorkProgressResponse> {
    const params = weekStart ? new HttpParams().set('weekStart', weekStart) : new HttpParams();
    return this.http.get<WeeklyWorkProgressResponse>(this.url, { params });
  }
}
