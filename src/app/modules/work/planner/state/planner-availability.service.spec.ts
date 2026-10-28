import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { PlannerApiService } from '../data-access/planner-api.service';
import { PlannerAvailabilityService } from './planner-availability.service';

describe('PlannerAvailabilityService', () => {
  const api = { getMyDay: vi.fn() };

  function service(): PlannerAvailabilityService {
    TestBed.configureTestingModule({ providers: [{ provide: PlannerApiService, useValue: api }] });
    return TestBed.inject(PlannerAvailabilityService);
  }

  beforeEach(() => api.getMyDay.mockReset());

  it('is unknown until probed, then on when the day loads, asking only once', async () => {
    api.getMyDay.mockReturnValue(of({}));
    const availability = service();
    expect(availability.state()).toBe('unknown');

    await availability.probe();
    await availability.probe();

    expect(availability.state()).toBe('on');
    expect(api.getMyDay).toHaveBeenCalledTimes(1);
  });

  it('is off when the planner answers 503 planner_disabled', async () => {
    api.getMyDay.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 503, error: { code: 'planner_disabled' } })));
    const availability = service();

    await availability.probe();

    expect(availability.state()).toBe('off');
  });
});
