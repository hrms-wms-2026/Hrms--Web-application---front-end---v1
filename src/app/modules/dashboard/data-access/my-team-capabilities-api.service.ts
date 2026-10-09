import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { MyTeamCapabilitiesResponse } from '../models/my-team-capabilities.model';

@Injectable({ providedIn: 'root' })
export class MyTeamCapabilitiesApiService {
  private readonly http = inject(HttpClient);
  private readonly basePath = `${environment.apiUrl}/dashboard/team`;

  getCapabilities(): Observable<MyTeamCapabilitiesResponse> {
    return this.http.get<MyTeamCapabilitiesResponse>(`${this.basePath}/capabilities`);
  }
}
