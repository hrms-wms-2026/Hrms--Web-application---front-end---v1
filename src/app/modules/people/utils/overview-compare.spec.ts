import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { EmployeePeriodStore } from '../state/employee-period.store';
import { createCompareLoader, deltaIf } from './overview-compare';

describe('deltaIf', () => {
  it('is null when not comparing', () => {
    expect(deltaIf(false, 5, 3, 'higher-better')).toBeNull();
  });

  it('is null when the compare value is missing', () => {
    expect(deltaIf(true, 5, null, 'higher-better')).toBeNull();
  });

  it('treats a missing current value as 0', () => {
    expect(deltaIf(true, undefined, 2, 'lower-better')!.tone).toBe('good');
  });
});

const load = vi.fn((_from: string, _to: string) => of(1));

@Component({ standalone: true, template: '', providers: [EmployeePeriodStore] })
class HostComponent {
  readonly store = inject(EmployeePeriodStore);
  readonly loader = createCompareLoader(this.store, load);
}

describe('createCompareLoader', () => {
  beforeEach(() => load.mockClear());

  it('does not call the API while compare is off and calls it with the compare bounds when on', () => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    const host = fixture.componentInstance;
    host.store.setBounds('2026-01-01', null, new Date(2026, 8, 30));
    fixture.detectChanges();
    expect(load).not.toHaveBeenCalled();

    host.store.setCompareMonth('2026-06');
    fixture.detectChanges();

    expect(load).toHaveBeenCalledWith('2026-06-01', '2026-06-30');
    expect(host.loader.data()).toBe(1);
  });
});
