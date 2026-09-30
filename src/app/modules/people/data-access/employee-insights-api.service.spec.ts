import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { EMPLOYEE_INSIGHTS_PREVIEW, EmployeeInsightsApiService } from './employee-insights-api.service';

describe('EmployeeInsightsApiService', () => {
  it('serves sample data only in the development environment', async () => {
    const service = TestBed.inject(EmployeeInsightsApiService);

    // Specs run against src/environments/environment.ts (development).
    expect(EMPLOYEE_INSIGHTS_PREVIEW).toBe(true);
    const overview = await firstValueFrom(service.getOverview('emp-1', '2025-02'));
    expect(overview?.attendance.days.length).toBe(28);
    const work = await firstValueFrom(service.getWorkActivity('emp-1', '2025-02'));
    expect(work?.delivery.monthly.map((m) => m.month)).toEqual(['2024-09', '2024-10', '2024-11', '2024-12', '2025-01', '2025-02']);
  });

  it('returns null when preview is disabled', async () => {
    const service = TestBed.inject(EmployeeInsightsApiService);
    (service as { previewEnabled: boolean }).previewEnabled = false;

    expect(await firstValueFrom(service.getOverview('emp-1', '2025-02'))).toBeNull();
    expect(await firstValueFrom(service.getWorkActivity('emp-1', '2025-02'))).toBeNull();
  });
});
