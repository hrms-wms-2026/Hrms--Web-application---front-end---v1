import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { Observable, Subscription } from 'rxjs';
import { TeamModuleForecastApiService } from '../data-access/team-module-forecast-api.service';
import { ModuleForecastQuery, ModuleForecastResponse } from '../models/team-module-forecast.model';
import { FORECAST_EXPORT_PAGE_SIZE, FORECAST_TABLE_PAGE_SIZE, forecastErrorText, nextTableQuery } from './overtime-forecast-store.util';

/** The card's read: the 10 modules that need the most overtime. */
export const MODULE_FORECAST_CARD_QUERY: ModuleForecastQuery = {
  status: null,
  projectId: null,
  search: '',
  sort: 'overtime',
  page: 1,
  pageSize: 10,
};

interface TeamModuleForecastState {
  /** The card's response: totals, trend, projects and the top modules. */
  readonly data: ModuleForecastResponse | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly loadedAt: Date | null;
  /** The popup table's page (status filter, search, sort and page are server-side). */
  readonly tableQuery: ModuleForecastQuery;
  readonly table: ModuleForecastResponse | null;
  readonly tableLoading: boolean;
  readonly tableError: string | null;
}

const initialState: TeamModuleForecastState = {
  data: null,
  loading: false,
  error: null,
  loadedAt: null,
  tableQuery: { ...MODULE_FORECAST_CARD_QUERY, pageSize: FORECAST_TABLE_PAGE_SIZE },
  table: null,
  tableLoading: false,
  tableError: null,
};

/** Shared by the card and its popup, so a resize or the popup never resets the table's filter. */
export const TeamModuleForecastStore = signalStore(
  { providedIn: 'root' },
  withState<TeamModuleForecastState>(initialState),
  withMethods((store, api = inject(TeamModuleForecastApiService)) => {
    // Only the latest request of each kind may land.
    let cardFlight: Subscription | null = null;
    let tableFlight: Subscription | null = null;

    const fetchTable = (tableQuery: ModuleForecastQuery): void => {
      tableFlight?.unsubscribe();
      patchState(store, { tableQuery, tableLoading: true, tableError: null });
      tableFlight = api.get(tableQuery).subscribe({
        next: (table) => patchState(store, { table, tableLoading: false }),
        error: (err) => patchState(store, { tableError: forecastErrorText(err, 'Failed to load the modules.'), tableLoading: false }),
      });
    };

    return {
      /** A dashboard bootstrap payload: the card's own read. */
      seed(data: ModuleForecastResponse): void {
        cardFlight?.unsubscribe();
        patchState(store, { data, loading: false, error: null, loadedAt: new Date() });
      },
      markLoading(): void {
        patchState(store, { loading: true, error: null });
      },
      load(): void {
        cardFlight?.unsubscribe();
        patchState(store, { loading: true, error: null });
        cardFlight = api.get(MODULE_FORECAST_CARD_QUERY).subscribe({
          next: (data) => patchState(store, { data, loading: false, loadedAt: new Date() }),
          error: (err) => patchState(store, { error: forecastErrorText(err, 'Failed to load the module forecast.'), loading: false }),
        });
      },
      /** Reloads the table; a filter, search or sort change goes back to page 1. */
      loadTable(patch: Partial<Omit<ModuleForecastQuery, 'pageSize'>> = {}): void {
        fetchTable(nextTableQuery<ModuleForecastQuery>(store.tableQuery(), patch));
      },
      /** Every row of the current filter, for the CSV. */
      fetchAll(): Observable<ModuleForecastResponse> {
        return api.get({ ...store.tableQuery(), page: 1, pageSize: FORECAST_EXPORT_PAGE_SIZE });
      },
    };
  }),
);
