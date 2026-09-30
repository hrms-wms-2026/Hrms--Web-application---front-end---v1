import { Injectable } from '@angular/core';
import { Observable, delay, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { EmployeeOverviewInsightsResponse, EmployeeWorkActivityInsightsResponse } from '../models/employee-insights.model';
import { mockOverviewInsights, mockWorkActivityInsights } from './employee-insights.mock';

/** Only the local development build serves sample insights; every other environment gets null. */
export const EMPLOYEE_INSIGHTS_PREVIEW = (environment.environmentName as string) === 'development';

/**
 * Employee-scoped period aggregates for the Overview and Work & Activity tabs.
 *
 * Targets the Phase 3 backend endpoints that are designed but NOT built yet
 * (GET /api/v1/employees/{id}/overview-insights?month=YYYY-MM and
 * GET /api/v1/employees/{id}/work-activity-insights?month=YYYY-MM - see
 * docs/superpowers/plans/next/2026-09-30-employee-detail-tabs.md). Until they exist this returns
 * same-shaped sample data in development and `null` (rendered as "no data yet") elsewhere, so
 * real users never see invented numbers. Swap the bodies for HttpClient calls in Phase 3.
 */
@Injectable({ providedIn: 'root' })
export class EmployeeInsightsApiService {
  readonly previewEnabled = EMPLOYEE_INSIGHTS_PREVIEW;

  getOverview(_employeeId: string, month: string): Observable<EmployeeOverviewInsightsResponse | null> {
    return this.previewEnabled ? of(mockOverviewInsights(month)).pipe(delay(120)) : of(null);
  }

  getWorkActivity(_employeeId: string, month: string): Observable<EmployeeWorkActivityInsightsResponse | null> {
    return this.previewEnabled ? of(mockWorkActivityInsights(month)).pipe(delay(120)) : of(null);
  }
}
