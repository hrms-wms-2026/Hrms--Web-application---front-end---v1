/**
 * Team Availability (hub "View Team" / "View Calendar"): who is off this month, coverage today, and the
 * team list that filters the calendar. Managers see their team, HR sees everyone (the API scopes it).
 */
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { BreadcrumbHeaderComponent } from '../../../../shared/ui/breadcrumb-header/breadcrumb-header.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { LeaveBalanceResponse } from '../../models/leave-balance.model';
import { LeaveCalendarDayResponse } from '../../models/leave-calendar.model';
import { LeaveBalanceStore } from '../../state/leave-balance.store';
import { LeaveCalendarStore } from '../../state/leave-calendar.store';
import { LeaveCalendarDayDetailComponent } from '../../ui/leave-calendar-day-detail/leave-calendar-day-detail.component';
import { NewLeaveRequestHostComponent } from '../../ui/new-leave-request-host/new-leave-request-host.component';
import {
  AvailabilityWeek,
  absentOn,
  buildAvailabilityWeeks,
  coverageConflictDays,
  isoDay,
  upcomingAbsenceCount
} from '../../utils/team-availability.util';

export interface TeamMemberRow {
  employeeId: string;
  name: string;
  departmentId: string | null;
  departmentName: string | null;
  status: 'available' | 'on-leave' | 'pending';
}

const MEMBER_PREVIEW = 6;
const STATUS_LABEL: Record<TeamMemberRow['status'], string> = { available: 'Available', 'on-leave': 'On leave', pending: 'Pending' };

/** One row per person from the balance list (it has one row per person and leave type). */
export function rosterFromBalances(rows: readonly LeaveBalanceResponse[]): Omit<TeamMemberRow, 'status'>[] {
  const people = new Map<string, Omit<TeamMemberRow, 'status'>>();
  for (const row of rows) {
    if (!people.has(row.employeeId)) {
      people.set(row.employeeId, { employeeId: row.employeeId, name: row.employeeName, departmentId: row.departmentId, departmentName: row.departmentName });
    }
  }
  return [...people.values()].sort((a, b) => a.name.localeCompare(b.name));
}

@Component({
  selector: 'app-team-availability',
  standalone: true,
  imports: [AvatarComponent, BreadcrumbHeaderComponent, ErrorStateComponent, LoaderComponent, SelectComponent, LeaveCalendarDayDetailComponent, NewLeaveRequestHostComponent],
  templateUrl: './team-availability.component.html',
  styleUrls: ['../../ui/time-off-chrome.css', './team-availability.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TeamAvailabilityComponent {
  readonly store = inject(LeaveCalendarStore);
  readonly balanceStore = inject(LeaveBalanceStore);
  private readonly permissions = inject(PermissionService);

  readonly weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  readonly statusLabel = STATUS_LABEL;
  readonly today = isoDay(new Date());
  readonly canRequestLeave = computed(() => this.permissions.hasPermission('leave:read-own'));
  /** Managers list their team; HR without a team scope lists everyone. */
  private readonly usesTeamScope = this.permissions.hasPermission('leave:read-team');

  readonly view = signal<'month' | 'week'>('month');
  readonly weekIndex = signal(0);
  readonly memberSearch = signal('');
  readonly showAllMembers = signal(false);
  /** People unticked in the list; their leave is hidden from the calendar. */
  readonly hiddenMembers = signal<ReadonlySet<string>>(new Set());
  readonly selectedDate = signal<string | null>(null);
  readonly requestDate = signal<string | null>(null);

  readonly monthLabel = computed(() => new Date(this.store.year(), this.store.monthNumber() - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
  readonly showingCurrentMonth = computed(() => this.today.startsWith(`${this.store.year()}-${String(this.store.monthNumber()).padStart(2, '0')}`));

  private readonly roster = computed(() => rosterFromBalances(this.usesTeamScope ? this.balanceStore.team() : this.balanceStore.all()));
  readonly rosterLoading = computed(() => (this.usesTeamScope ? this.balanceStore.teamLoading() : this.balanceStore.allLoading()));

  readonly departmentOptions = computed<SelectOption[]>(() => {
    const departments = new Map<string, string>();
    for (const person of this.roster()) if (person.departmentId && person.departmentName) departments.set(person.departmentId, person.departmentName);
    return [{ value: '', label: 'All departments' }, ...[...departments.entries()].map(([value, label]) => ({ value, label }))];
  });

  /** Today's leave, kept from the month that contains today so paging months doesn't change the KPIs. */
  private readonly todayDays = signal<readonly LeaveCalendarDayResponse[]>([]);

  readonly members = computed<TeamMemberRow[]>(() => {
    const departmentId = this.store.departmentId();
    const search = this.memberSearch().trim().toLowerCase();
    const { approved, pending } = absentOn(this.todayDays(), this.today);
    return this.roster()
      .filter((person) => !departmentId || person.departmentId === departmentId)
      .filter((person) => !search || person.name.toLowerCase().includes(search))
      .map((person) => ({
        ...person,
        status: approved.has(person.employeeId) ? ('on-leave' as const) : pending.has(person.employeeId) ? ('pending' as const) : ('available' as const)
      }));
  });
  readonly visibleMembers = computed(() => (this.showAllMembers() ? this.members() : this.members().slice(0, MEMBER_PREVIEW)));
  readonly hiddenMemberCount = computed(() => Math.max(0, this.members().length - MEMBER_PREVIEW));

  readonly teamSize = computed(() => {
    const departmentId = this.store.departmentId();
    return this.roster().filter((person) => !departmentId || person.departmentId === departmentId).length;
  });
  readonly coverage = computed(() => {
    const size = this.teamSize();
    const { approved } = absentOn(this.todayDays(), this.today);
    const available = Math.max(0, size - approved.size);
    return { available, size, percent: size > 0 ? Math.round((available / size) * 100) : 100 };
  });
  readonly upcomingAbsences = computed(() => upcomingAbsenceCount(this.todayDays(), this.today, 7));
  readonly conflictDays = computed(() => coverageConflictDays(this.store.month()?.days ?? [], this.teamSize()));

  readonly weeks = computed<AvailabilityWeek[]>(() => {
    const month = this.store.month();
    if (!month) return [];
    const hidden = this.hiddenMembers();
    return buildAvailabilityWeeks(month.year, month.month, month.days, (id) => !hidden.has(id));
  });
  readonly shownWeeks = computed(() => {
    const weeks = this.weeks();
    if (this.view() === 'month') return weeks;
    const index = Math.min(this.weekIndex(), weeks.length - 1);
    return index >= 0 ? [weeks[index]] : [];
  });
  readonly selectedDay = computed(() => this.store.month()?.days.find((day) => day.date === this.selectedDate()) ?? null);

  constructor() {
    void this.loadMonth(() => this.store.openCurrentMonth(true), true);
    if (this.usesTeamScope) void this.balanceStore.loadTeam(new Date().getFullYear());
    else void this.balanceStore.loadAll(new Date().getFullYear());
  }

  setView(view: 'month' | 'week'): void {
    this.view.set(view);
    if (view === 'week') this.weekIndex.set(this.weekContaining(this.showingCurrentMonth() ? this.today : null));
  }

  previous(): void {
    if (this.view() === 'week' && this.weekIndex() > 0) {
      this.weekIndex.update((index) => index - 1);
      return;
    }
    void this.loadMonth(() => this.store.goToPreviousMonth()).then(() => this.weekIndex.set(Math.max(0, this.weeks().length - 1)));
  }

  next(): void {
    if (this.view() === 'week' && this.weekIndex() < this.weeks().length - 1) {
      this.weekIndex.update((index) => index + 1);
      return;
    }
    void this.loadMonth(() => this.store.goToNextMonth()).then(() => this.weekIndex.set(0));
  }

  goToToday(): void {
    void this.loadMonth(() => this.store.goToToday()).then(() => this.weekIndex.set(this.weekContaining(this.today)));
  }

  onDepartmentChange(departmentId: string): void {
    void this.loadMonth(() => this.store.setDepartmentFilter(departmentId || null));
  }

  isShown(employeeId: string): boolean {
    return !this.hiddenMembers().has(employeeId);
  }

  toggleMember(employeeId: string): void {
    this.hiddenMembers.update((hidden) => {
      const next = new Set(hidden);
      if (next.has(employeeId)) next.delete(employeeId);
      else next.add(employeeId);
      return next;
    });
  }

  onSearchInput(event: Event): void {
    this.memberSearch.set((event.target as HTMLInputElement).value);
  }

  openDay(date: string): void {
    this.selectedDate.set(date);
  }

  onRequestLeave(date: string): void {
    this.selectedDate.set(null);
    this.requestDate.set(date);
  }

  private weekContaining(date: string | null): number {
    if (!date) return 0;
    const index = this.weeks().findIndex((week) => week.days.some((day) => day.date === date));
    return Math.max(0, index);
  }

  /** Runs a month change and, when the month holds today, keeps its days for the KPIs. */
  private async loadMonth(change: () => Promise<void>, initial = false): Promise<void> {
    await change();
    if (this.showingCurrentMonth() && this.store.month()) this.todayDays.set(this.store.month()!.days);
    if (initial) this.weekIndex.set(this.weekContaining(this.today));
  }
}
