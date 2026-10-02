import { Observable, catchError, of } from 'rxjs';
import { WidgetLoader } from '../../../shared/ui/widget-card/widget-loader';
import { createWidgetLoader } from '../../../shared/ui/widget-card/widget-loader';
import { EmployeePeriodStore } from '../state/employee-period.store';
import { computeDelta, Delta, DeltaPolarity } from './employee-overview.utils';

export function createCompareLoader<T>(
  store: InstanceType<typeof EmployeePeriodStore>,
  load: (from: string, to: string) => Observable<T>
): WidgetLoader<T | null> {
  return createWidgetLoader<T | null>(() => {
    const from = store.compareFrom();
    const to = store.compareTo();
    return from && to ? load(from, to).pipe(catchError(() => of(null))) : of(null);
  });
}

export function deltaIf(
  comparing: boolean,
  current: number | null | undefined,
  previous: number | null | undefined,
  polarity: DeltaPolarity,
  format: (n: number) => string = String
): Delta | null {
  if (!comparing || previous === null || previous === undefined) return null;
  return computeDelta(current ?? 0, previous, polarity, format);
}
