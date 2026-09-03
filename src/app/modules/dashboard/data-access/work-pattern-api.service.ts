import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { WorkPatternResponse } from '../models/work-pattern.model';

@Injectable({ providedIn: 'root' })
export class WorkPatternApiService {
  private readonly http = inject(HttpClient);
  private readonly basePath = `${environment.apiUrl}/monitoring/activity`;

  getMyWorkPattern(from: string, to: string): Observable<WorkPatternResponse> {
    return this.http.get<WorkPatternResponse>(`${this.basePath}/my-work-pattern`, {
      params: new HttpParams().set('from', from).set('to', to)
    });
  }
}
