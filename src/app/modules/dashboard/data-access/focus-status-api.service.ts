import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { FocusStatus } from '../models/focus-status.model';

@Injectable({ providedIn: 'root' })
export class FocusStatusApiService {
  private readonly http = inject(HttpClient);
  private readonly basePath = `${environment.apiUrl}/monitoring/activity`;

  getMyFocusStatus(): Observable<FocusStatus> {
    return this.http.get<FocusStatus>(`${this.basePath}/my-focus-status`);
  }
}
