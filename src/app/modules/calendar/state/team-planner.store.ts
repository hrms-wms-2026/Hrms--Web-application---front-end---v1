import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { utcIsoToLocalParts } from '../../../shared/utils/timezone.util';
import { PlannerApiService } from '../../work/planner/data-access/planner-api.service';
import {
  PlannerPersonDay, PlannerPersonRangeResponse, TeamPlannerMember, TeamPlannerResponse,
} from '../../work/planner/models/team-planner.models';
import { dayLoad, loadBand } from '../utils/team-load';

export type TeamPlannerMode = 'day' | 'week';
export type TeamFilter = 'over' | 'under' | 'leave' | 'notPlanned';
export type TeamSort = 'name' | 'loadDesc' | 'loadAsc';
export interface TeamTrailStep { managerId: string | null; name: string; }
export interface TeamCounts { over: number; under: number; leave: number; notPlanned: number; }

const LOAD_ERROR = 'Unable to load team plan';

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Monday of the week holding <date>. */
export function mondayOf(date: string): string {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDays(date, -((dow + 6) % 7));
}

/**
 * Team planner, Phase A (2026-11-03 design): the team a manager is looking at (their direct reports, or a report's after
 * drilling down), for a day or a week, plus one person's week. Page-scoped, like the other planner stores.
 */
@Injectable()
export class TeamPlannerStore {
  private readonly api = inject(PlannerApiService);

  readonly mode = signal<TeamPlannerMode>('day');
  readonly date = signal(new Date().toISOString().slice(0, 10));
  readonly trail = signal<readonly TeamTrailStep[]>([{ managerId: null, name: 'My team' }]);
  readonly response = signal<TeamPlannerResponse | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly search = signal('');
  readonly sort = signal<TeamSort>('name');
  readonly filters = signal<ReadonlySet<TeamFilter>>(new Set());

  readonly person = signal<PlannerPersonRangeResponse | null>(null);
  readonly personLoading = signal(false);
  readonly personError = signal<string | null>(null);

  private loadSeq = 0;
  private personSeq = 0;

  /** The dates shown: the day, or the week's days on which anyone works or has planned something. */
  readonly weekDays = computed<readonly string[]>(() => {
    const response = this.response();
    if (this.mode() === 'day' || !response) return [this.date()];
    const days: string[] = [];
    for (let d = response.from; d <= response.to; d = addDays(d, 1)) {
      const used = response.members.some((m) => m.days.some((x) => x.date === d && (x.workingMinutes > 0 || dayLoad(x) > 0)));
      if (used) days.push(d);
    }
    return days;
  });

  private readonly stats = computed(() => {
    const shown = new Set(this.weekDays());
    return new Map((this.response()?.members ?? []).map((m) => {
      const days = m.days.filter((d) => shown.has(d.date));
      const load = days.reduce((s, d) => s + dayLoad(d), 0);
      const capacity = days.reduce((s, d) => s + d.capacityMinutes, 0);
      const bands = days.map((d) => loadBand(dayLoad(d), d.capacityMinutes, d.onLeave));
      return [m.employeeId, {
        load, capacity,
        over: bands.includes('over'),
        leave: days.some((d) => d.onLeave),
        under: load > 0 && capacity > 0 && load / capacity < 0.5,
        // Nothing planned although at least one shown day still has hours (leave seen as busy leaves none).
        notPlanned: load === 0 && days.some((d) => !d.onLeave && d.capacityMinutes > 0),
      }];
    }));
  });

  readonly counts = computed<TeamCounts>(() => {
    const all = [...this.stats().values()];
    return {
      over: all.filter((s) => s.over).length, under: all.filter((s) => s.under).length,
      leave: all.filter((s) => s.leave).length, notPlanned: all.filter((s) => s.notPlanned).length,
    };
  });

  readonly visibleMembers = computed<readonly TeamPlannerMember[]>(() => {
    const stats = this.stats();
    const query = this.search().trim().toLowerCase();
    const filters = this.filters();
    const ratio = (m: TeamPlannerMember) => {
      const s = stats.get(m.employeeId);
      return s && s.capacity > 0 ? s.load / s.capacity : s && s.load > 0 ? Number.POSITIVE_INFINITY : -1;
    };
    let members = (this.response()?.members ?? []).filter((m) => !query || m.name.toLowerCase().includes(query));
    if (filters.size > 0) members = members.filter((m) => [...filters].some((f) => stats.get(m.employeeId)?.[f]));
    if (this.sort() === 'name') return members;
    const sign = this.sort() === 'loadDesc' ? -1 : 1;
    return [...members].sort((a, b) => sign * (ratio(a) - ratio(b)));
  });

  async load(): Promise<void> {
    const seq = ++this.loadSeq;
    const managerId = this.trail()[this.trail().length - 1].managerId;
    this.loading.set(true);
    this.error.set(null);
    try {
      const monday = mondayOf(this.date());
      const response = await firstValueFrom(this.mode() === 'day'
        ? this.api.getTeamDay(this.date(), managerId)
        : this.api.getTeamRange(monday, addDays(monday, 6), managerId));
      if (seq !== this.loadSeq) return;
      this.response.set(response);
    } catch {
      if (seq !== this.loadSeq) return;
      this.error.set(LOAD_ERROR);
    } finally {
      if (seq === this.loadSeq) this.loading.set(false);
    }
  }

  setMode(mode: TeamPlannerMode): Promise<void> {
    this.mode.set(mode);
    return this.load();
  }

  private dateChosen = false;

  /** Sets the date only; the caller loads (setMode, step and the shell do). */
  setDate(date: string): void {
    this.dateChosen = true;
    this.date.set(date);
  }

  /** Until a date is chosen (deep link, navigation), the view opens on today in the viewer's zone. */
  ensureToday(timezone: string): void {
    if (!this.dateChosen) this.date.set(utcIsoToLocalParts(new Date().toISOString(), timezone).date);
  }

  step(direction: 1 | -1): Promise<void> {
    this.dateChosen = true;
    this.date.set(addDays(this.date(), direction * (this.mode() === 'day' ? 1 : 7)));
    return this.load();
  }

  today(timezone: string): Promise<void> {
    this.dateChosen = true;
    this.date.set(utcIsoToLocalParts(new Date().toISOString(), timezone).date);
    return this.load();
  }

  drillDown(managerId: string, name: string): Promise<void> {
    this.trail.update((t) => [...t, { managerId, name }]);
    this.closePerson();
    return this.load();
  }

  backTo(index: number): Promise<void> {
    this.trail.update((t) => t.slice(0, Math.max(1, index + 1)));
    this.closePerson();
    return this.load();
  }

  /** That person's Monday–Sunday week around the current date. */
  async openPerson(employeeId: string): Promise<void> {
    const seq = ++this.personSeq;
    const monday = mondayOf(this.date());
    this.personLoading.set(true);
    this.personError.set(null);
    try {
      const person = await firstValueFrom(this.api.getEmployeeRange(employeeId, monday, addDays(monday, 6)));
      if (seq === this.personSeq) this.person.set(person);
    } catch {
      if (seq === this.personSeq) this.personError.set(LOAD_ERROR);
    } finally {
      if (seq === this.personSeq) this.personLoading.set(false);
    }
  }

  closePerson(): void {
    this.personSeq++;
    this.person.set(null);
    this.personError.set(null);
    this.personLoading.set(false);
  }

  /** A member's day on <date>, if loaded. */
  dayOf(member: TeamPlannerMember, date: string): PlannerPersonDay | undefined {
    return member.days.find((d) => d.date === date);
  }
}
