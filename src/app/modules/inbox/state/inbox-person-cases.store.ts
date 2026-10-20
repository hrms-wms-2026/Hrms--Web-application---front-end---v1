import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { InboxApiService } from '../data-access/inbox-api.service';
import { InboxCategory, InboxPersonCaseDto, InboxPersonCaseMonthDto } from '../models/inbox.dto';
import { localMonthBounds, localOffsetMinutes } from '../utils/person-cases.util';

/** Both kinds of history: a person's requests and the alerts about them, together. */
const CATEGORIES: readonly InboxCategory[] = ['request', 'alert'];

interface PersonCasesState {
  readonly personId: string | null;
  readonly personName: string;
  readonly hidden: boolean;
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
  personId: null,
  personName: '',
  hidden: true,
  year: 0,
  month: 0,
  monthCases: [],
  monthLoading: false,
  dots: new Set<number>(),
  dotsYear: 0,
  hireDate: null
};

/** Newest first. */
function newestFirst(rows: InboxPersonCaseDto[]): InboxPersonCaseDto[] {
  return [...rows].sort((a, b) => Date.parse(b.item.createdAt) - Date.parse(a.item.createdAt));
}

/** Months that hold any history, requests and alerts added together. */
export function monthsWithHistory(lists: readonly (readonly InboxPersonCaseMonthDto[])[]): Set<number> {
  const counts = new Map<number, number>();
  for (const list of lists) for (const m of list) counts.set(m.month, (counts.get(m.month) ?? 0) + m.count);
  return new Set([...counts].filter(([, count]) => count > 0).map(([month]) => month));
}

/**
 * One person's cases, month by month, across every type (leave, attendance, face checks, exceptions, ...) - the details
 * panel of their 1-on-1 chat. Provided by the inbox page. Any failure (403 included: the caller can't see the person)
 * hides it rather than showing an error.
 */
export const InboxPersonCasesStore = signalStore(
  withState(initialState),
  withMethods((store) => {
    const api = inject(InboxApiService);
    // Bumped on every load: responses for an older person (or an older month) are dropped.
    let person = 0;
    let monthRequest = 0;

    async function fetchMonth(personId: string, year: number, month: number): Promise<InboxPersonCaseDto[]> {
      const { from, to } = localMonthBounds(year, month);
      const lists = await Promise.all(CATEGORIES.map((c) => firstValueFrom(api.personCases(personId, c, from, to))));
      return newestFirst(lists.flat());
    }

    async function fetchDots(personId: string, year: number, mine: number): Promise<void> {
      const results = await Promise.all(CATEGORIES.map((c) => firstValueFrom(api.personCaseMonths(personId, c, year, localOffsetMinutes()))));
      if (mine !== person) return;
      patchState(store, { dots: monthsWithHistory(results.map((r) => r.months)), dotsYear: year, hireDate: results[0]?.hireDate ?? null });
    }

    function fail(mine: number): void {
      if (mine === person) patchState(store, { hidden: true, monthLoading: false });
    }

    return {
      /** Shows this month of the person's history; hidden for the caller themself and for nobody. */
      async load(personId: string | null, personName: string, selfEmployeeId: string | null, today: Date = new Date()): Promise<void> {
        const mine = ++person;
        const hidden = !personId || personId === selfEmployeeId;
        const year = today.getFullYear();
        const month = today.getMonth() + 1;
        patchState(store, { ...initialState, personId, personName, hidden, year, month, monthLoading: !hidden });
        if (hidden) return;
        try {
          const [rows] = await Promise.all([fetchMonth(personId!, year, month), fetchDots(personId!, year, mine)]);
          if (mine === person) patchState(store, { monthCases: rows, monthLoading: false });
        } catch {
          fail(mine);
        }
      },

      /** The month grid moved to another year: load that year's dots; the shown month stays. */
      async browseYear(year: number): Promise<void> {
        const personId = store.personId();
        if (!personId || store.hidden() || year === store.dotsYear()) return;
        const mine = person;
        try {
          await fetchDots(personId, year, mine);
        } catch {
          fail(mine);
        }
      },

      async goToMonth(year: number, month: number): Promise<void> {
        const personId = store.personId();
        if (!personId || store.hidden()) return;
        const mine = person;
        const request = ++monthRequest;
        const yearChanged = year !== store.dotsYear();
        patchState(store, { year, month, monthLoading: true });
        try {
          const [rows] = await Promise.all([
            fetchMonth(personId, year, month),
            yearChanged ? fetchDots(personId, year, mine) : Promise.resolve()
          ]);
          if (mine === person && request === monthRequest) patchState(store, { monthCases: rows, monthLoading: false });
        } catch {
          fail(mine);
        }
      }
    };
  })
);
