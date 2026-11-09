import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  EmployeeForecastQuery,
  EmployeeForecastResponse,
} from '../models/team-employee-forecast.model';
import { forecastParams } from './overtime-forecast-params.util';

/** The My Team "Employee overtime forecast" widget's one read. Unset filters are left out of the query string. */
@Injectable({ providedIn: 'root' })
export class TeamEmployeeForecastApiService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/work/forecast/employees`;

  get(query: EmployeeForecastQuery): Observable<EmployeeForecastResponse> {
    return this.http.get<EmployeeForecastResponse>(this.url, { params: forecastParams(query) });
  }
}
