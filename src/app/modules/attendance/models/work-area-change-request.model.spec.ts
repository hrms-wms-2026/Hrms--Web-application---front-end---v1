import { describe, expect, it } from 'vitest';
import {
  WORK_AREA_OPTIONS,
  workAreaChangeStatusLabel,
  workAreaLabel
} from './work-area-change-request.model';

describe('Work Area Change Request models', () => {
  it('exposes only the supported employee choices with user-facing labels', () => {
    expect(WORK_AREA_OPTIONS).toEqual([
      { value: 'onsite', label: 'On-site' },
      { value: 'remote', label: 'Remote' }
    ]);
  });

  it.each([
    ['onsite', 'On-site'],
    ['remote', 'Remote'],
    ['ON_SITE', 'Work area unavailable'],
    [null, 'Work area unavailable']
  ] as const)('maps %s to a safe display label', (value, label) => {
    expect(workAreaLabel(value)).toBe(label);
  });

  it.each([
    ['pending', 'Pending'],
    ['approved', 'Approved'],
    ['rejected', 'Rejected'],
    ['cancelled', 'Cancelled'],
    [null, 'Request status unavailable'],
    [undefined, 'Request status unavailable'],
    ['', 'Request status unavailable'],
    ['  ', 'Request status unavailable'],
    ['unexpected', 'Request status unavailable']
  ] as const)('maps %s to a user-facing status label', (value, label) => {
    expect(workAreaChangeStatusLabel(value)).toBe(label);
  });

  it.each([
    ['onsite', 'On-site'],
    ['remote', 'Remote'],
    ['onsite_work_area', 'Work area unavailable'],
    ['requested_remote', 'Work area unavailable'],
    ['  ', 'Work area unavailable'],
    [null, 'Work area unavailable']
  ] as const)('never exposes machine work-area value %s', (value, label) => {
    expect(workAreaLabel(value)).toBe(label);
  });
});
