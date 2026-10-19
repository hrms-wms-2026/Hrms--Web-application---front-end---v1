import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { InboxApiService } from '../data-access/inbox-api.service';
import { InboxItemDto, InboxPersonCaseDto } from '../models/inbox.dto';
import {
  PERSON_CASE_SOURCES,
  localMonthBounds,
  localOffsetMinutes,
  localYearMonth,
  orderPersonCases,
  personCaseSubjectId,
  redDotMonths
} from '../utils/person-cases.util';

/** Rows the ticket details panel shows before "View all". */
export const PERSON_CASES_COMPACT_LIMIT = 5;

interface PersonCasesState {
  readonly current: InboxItemDto | null;
  readonly hidden: boolean;
  readonly compact: readonly InboxPersonCaseDto[];
  readonly compactLoading: boolean;
  readonly viewOpen: boolean;
  readonly year: number;
  readonly month: number;
  readonly monthCases: readonly InboxPersonCaseDto[];
  readonly monthLoading: boolean;
  readonly dots: ReadonlySet<number>;
  /** The year `dots` belong to (the month grid may browse a year other than the one shown). */
  readonly dotsYear: number;
  readonly hireDate: string | null;
}

const initialState: PersonCasesState = {
  current: null,
  hidden: true,
  compact: [],
  compactLoading: false,
  viewOpen: false,
  year: 0,
  month: 0,
  monthCases: [],
  monthLoading: false,
  dots: new Set<number>(),
  dotsYear: 0,
  hireDate: null
};

/**
 * The open ticket's "Past cases": the subject's other alerts (or requests) from the ticket's month, and the full
 * month-by-month view behind View all. Provided by the inbox page, one per page. Any failure (403 included: the caller
 * can't see the person) hides the section rather than showing an error.
 */
export const InboxPersonCasesStore = signalStore(
  withState(initialState),
  withComputed((store) => ({
    compactRows: computed(() => store.compact().slice(0, PERSON_CASES_COMPACT_LIMIT)),
    moreCount: computed(() => store.compact().length > PERSON_CASES_COMPACT_LIMIT ? store.compact().length : 0)
  })),
  withMethods((store) => {
    const api = inject(InboxApiService);
    // Bumped on every load: responses for an older ticket (or an older month) are dropped.
    let ticket = 0;
    let monthRequest = 0;

    async function fetchMonth(current: InboxItemDto, year: number, month: number): Promise<InboxPersonCaseDto[]> {
      const { from, to } = localMonthBounds(year, month);
      const rows = await firstValueFrom(api.personCases(personCaseSubjectId(current)!, current.category, from, to));
      return orderPersonCases(rows, current);
    }

    async function fetchDots(current: InboxItemDto, year: number, mine: number): Promise<void> {
      const result = await firstValueFrom(api.personCaseMonths(personCaseSubjectId(current)!, current.category, year, localOffsetMinutes()));
      if (mine !== ticket) return;
      patchState(store, { dots: redDotMonths(result.months, year, current), dotsYear: year, hireDate: result.hireDate });
    }

    function fail(mine: number): void {
      if (mine === ticket) patchState(store, { hidden: true, viewOpen: false, compactLoading: false, monthLoading: false });
    }

    return {
      async load(current: InboxItemDto | null, selfEmployeeId: string | null): Promise<void> {
        const mine = ++ticket;
        const subject = current ? personCaseSubjectId(current) : null;
        const hidden = !current || !PERSON_CASE_SOURCES.has(current.source) || !subject || subject === selfEmployeeId;
        patchState(store, { ...initialState, current, hidden });
        if (hidden) return;

        const { year, month } = localYearMonth(current.createdAt);
        patchState(store, { compactLoading: true, year, month });
        try {
          const rows = await fetchMonth(current, year, month);
          if (mine === ticket) patchState(store, { compact: rows, compactLoading: false });
        } catch {
          fail(mine);
        }
      },

      async openView(): Promise<void> {
        const current = store.current();
        if (!current || store.hidden()) return;
        const { year, month } = localYearMonth(current.createdAt);
        patchState(store, { viewOpen: true, year, month, monthCases: store.compact(), monthLoading: false });
        const mine = ticket;
        try {
          await fetchDots(current, year, mine);
        } catch {
          fail(mine);
        }
      },

      /** The month grid moved to another year: load that year's red dots; the shown month stays. */
      async browseYear(year: number): Promise<void> {
        const current = store.current();
        if (!current || store.hidden() || year === store.dotsYear()) return;
        const mine = ticket;
        try {
          await fetchDots(current, year, mine);
        } catch {
          fail(mine);
        }
      },

      closeView(): void {
        patchState(store, { viewOpen: false });
      },

      async goToMonth(year: number, month: number): Promise<void> {
        const current = store.current();
        if (!current || store.hidden()) return;
        const mine = ticket;
        const request = ++monthRequest;
        const yearChanged = year !== store.dotsYear();
        patchState(store, { year, month, monthLoading: true });
        try {
          const [rows] = await Promise.all([
            fetchMonth(current, year, month),
            yearChanged ? fetchDots(current, year, mine) : Promise.resolve()
          ]);
          if (mine === ticket && request === monthRequest) patchState(store, { monthCases: rows, monthLoading: false });
        } catch {
          fail(mine);
        }
      }
    };
  })
);
