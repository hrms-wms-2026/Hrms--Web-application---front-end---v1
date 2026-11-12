import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ModuleForecastQuery, ModuleForecastResponse } from '../models/team-module-forecast.model';
import { forecastParams } from './overtime-forecast-params.util';

/** The My Team "Module overtime forecast" widget's one read. Unset filters are left out of the query string. */
@Injectable({ providedIn: 'root' })
export class TeamModuleForecastApiService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/work/forecast/modules`;

  get(query: ModuleForecastQuery): Observable<ModuleForecastResponse> {
    return this.http.get<ModuleForecastResponse>(this.url, { params: forecastParams(query) });
  }
}
