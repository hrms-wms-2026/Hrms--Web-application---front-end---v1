import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input } from '@angular/core';
import { TeamFilter, TeamPlannerStore, TeamSort, mondayOf } from '../../state/team-planner.store';
import { PlanColumnsGridComponent } from '../../ui/plan-columns-grid/plan-columns-grid.component';
import { memberColumn, personDayColumn } from '../../ui/plan-columns-grid/plan-columns';
import { TeamWeekHeatmapComponent } from '../../ui/team-week-heatmap/team-week-heatmap.component';
import { dayLoad } from '../../utils/team-load';

const FILTERS: readonly { key: TeamFilter; label: string }[] = [
  { key: 'over', label: 'Over capacity' }, { key: 'under', label: 'Under-planned' },
  { key: 'leave', label: 'On leave' }, { key: 'notPlanned', label: 'Not planned' },
];

function fmt(date: string, options: Intl.DateTimeFormatOptions): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { ...options, timeZone: 'UTC' });
}

/**
 * The Planner's "My team" view (team planner, Phase A, 2026-11-03): the team day as columns, the week as a heatmap, one
 * person's week, and the reporting-line drill-down. Read-only. The calendar page provides the store and shows this in
 * place of its own grid while its scope is "team".
 */
@Component({
  selector: 'app-team-planner',
  standalone: true,
  imports: [PlanColumnsGridComponent, TeamWeekHeatmapComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- The team's controls; a person's week has only "Back to team". -->
    @if (!store.person()) {
    <div class="tp-toolbar">
      <div class="tp-seg" role="group" aria-label="View">
        <button type="button" data-testid="team-mode-day" [attr.aria-pressed]="store.mode() === 'day'" [class.tp-on]="store.mode() === 'day'"
          (click)="store.setMode('day')">Day</button>
        <button type="button" data-testid="team-mode-week" [attr.aria-pressed]="store.mode() === 'week'" [class.tp-on]="store.mode() === 'week'"
          (click)="store.setMode('week')">Week</button>
      </div>
      <button type="button" class="tp-btn" aria-label="Previous" (click)="store.step(-1)">‹</button>
      <strong class="tp-date" data-testid="team-date">{{ dateLabel() }}</strong>
      <button type="button" class="tp-btn" aria-label="Next" (click)="store.step(1)">›</button>
      <button type="button" class="tp-btn" (click)="store.today(timezone())">Today</button>
      <span class="tp-grow"></span>
      <input class="tp-search" type="search" placeholder="Search people…" aria-label="Search people" [value]="store.search()"
        (input)="store.search.set($any($event.target).value)" />
      <select class="tp-sort" aria-label="Sort" (change)="store.sort.set($any($event.target).value)">
        @for (s of sorts; track s.key) { <option [value]="s.key" [selected]="store.sort() === s.key">{{ s.label }}</option> }
      </select>
    </div>
    <div class="tp-filters" role="group" aria-label="Filter">
      @for (f of filters; track f.key) {
        <button type="button" class="tp-chip" [attr.data-testid]="'team-filter-' + f.key" [attr.aria-pressed]="store.filters().has(f.key)"
          [class.tp-chip--on]="store.filters().has(f.key)" (click)="toggle(f.key)">{{ f.label }} {{ store.counts()[f.key] }}</button>
      }
    </div>
    @if (store.trail().length > 1) {
      <nav class="tp-trail" aria-label="Team">
        @for (step of store.trail(); track $index; let last = $last) {
          <button type="button" data-testid="team-crumb" [disabled]="last" (click)="store.backTo($index)">{{ step.name }}</button>
          @if (!last) { <span aria-hidden="true">›</span> }
        }
      </nav>
    }
    }

    @if (store.person(); as person) {
      <div class="tp-person">
        <button type="button" class="tp-btn" data-testid="team-person-back" (click)="store.closePerson()">‹ Back to team</button>
        <strong data-testid="team-person-title">{{ person.name }}'s plan</strong>
        <span class="tp-muted">Read-only</span>
      </div>
      <app-plan-columns-grid [columns]="personColumns()" [timezone]="timezone()" />
    } @else if (store.error()) {
      <div class="tp-state" data-testid="team-error" role="alert">
        <strong>Unable to load team plan</strong>
        <span>Check your connection and try again.</span>
        <button type="button" class="tp-primary" data-testid="team-retry" (click)="store.load()">Retry</button>
      </div>
    } @else if (store.loading() && !store.response()) {
      <div class="tp-skeletons" aria-busy="true">
        @for (i of [1, 2, 3]; track i) { <div class="tp-skeleton" data-testid="team-skeleton"></div> }
      </div>
    } @else if (store.response(); as response) {
      @if (response.members.length === 0) {
        <div class="tp-state" data-testid="team-empty">
          <strong>No direct reports</strong>
          <span>Team view is available to managers with direct reports.</span>
        </div>
      } @else {
        @if (nobodyPlanned()) {
          <p class="tp-note" data-testid="team-unplanned">{{ store.mode() === 'day' ? 'No one has planned this day' : 'No one has planned this week' }}</p>
        }
        @if (store.mode() === 'day') {
          <app-plan-columns-grid [columns]="dayColumns()" [timezone]="timezone()" (columnOpen)="store.openPerson($event)" />
        } @else {
          <app-team-week-heatmap [members]="store.visibleMembers()" [days]="store.weekDays()"
            (cellOpen)="openDay($event.date)" (personOpen)="store.openPerson($event)"
            (drillDown)="store.drillDown($event.employeeId, $event.name)" />
        }
      }
    }
  `,
  styles: [`
    :host { display: flex; flex-direction: column; gap: 12px; }
    .tp-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    .tp-seg { display: inline-flex; border: 1px solid var(--color-border-strong); border-radius: 8px; overflow: hidden; }
    .tp-seg button { all: unset; cursor: pointer; padding: 6px 14px; color: var(--color-text-primary); font-size: 14px; }
    .tp-seg .tp-on { background: var(--color-accent); color: var(--color-text-on-solid); font-weight: 600; }
    .tp-btn { border: 1px solid var(--color-border-strong); background: var(--color-surface); border-radius: 8px; padding: 6px 10px; font: inherit; font-size: 14px; cursor: pointer; }
    .tp-date { font-size: 15px; }
    .tp-grow { flex: 1; }
    .tp-search, .tp-sort { border: 1px solid var(--color-border-strong); border-radius: 8px; padding: 6px 10px; font: inherit; font-size: 14px; min-width: 0; }
    .tp-filters { display: flex; flex-wrap: wrap; gap: 6px; }
    .tp-chip { border: 1px solid var(--color-border-strong); background: var(--color-surface); border-radius: 999px; padding: 4px 10px; font: inherit; font-size: 13px; cursor: pointer; color: var(--color-text-primary); }
    .tp-chip--on { background: var(--color-accent-subtle); border-color: var(--color-focus-ring); color: var(--color-accent-hover); font-weight: 600; }
    .tp-trail { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--color-text-secondary); }
    .tp-trail button { all: unset; cursor: pointer; color: var(--color-accent-hover); }
    .tp-trail button:disabled { cursor: default; color: var(--color-text-primary); font-weight: 600; }
    .tp-person { display: flex; align-items: center; gap: 12px; }
    .tp-muted { color: var(--color-text-secondary); font-size: 13px; }
    .tp-state { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 48px 16px; border: 1px solid var(--color-border);
      border-radius: 12px; text-align: center; color: var(--color-text-secondary); }
    .tp-state strong { color: var(--color-text-primary); }
    .tp-primary { border: 0; border-radius: 8px; background: var(--color-accent-hover); color: var(--color-text-on-solid); font: inherit; font-weight: 600; padding: 8px 16px; cursor: pointer; }
    .tp-skeletons { display: flex; flex-direction: column; gap: 10px; }
    .tp-skeleton { height: 56px; border-radius: 10px; background: var(--color-surface-secondary); }
    .tp-note { margin: 0; padding: 8px 12px; border-radius: 8px; background: var(--color-surface-secondary); color: var(--color-text-primary); font-size: 13px; }
    @media (max-width: 767px) { .tp-grow { display: none; } .tp-search { flex: 1 1 100%; } }
  `],
})
export class TeamPlannerComponent implements OnInit {
  readonly store = inject(TeamPlannerStore);
  /** The viewer's zone. */
  readonly timezone = input.required<string>();

  readonly filters = FILTERS;
  readonly sorts: readonly { key: TeamSort; label: string }[] = [
    { key: 'name', label: 'Name' }, { key: 'loadDesc', label: 'Load high → low' }, { key: 'loadAsc', label: 'Load low → high' },
  ];

  readonly dateLabel = computed(() => {
    const date = this.store.date();
    if (this.store.mode() === 'day') return fmt(date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    const monday = mondayOf(date);
    const sunday = new Date(`${monday}T00:00:00Z`);
    sunday.setUTCDate(sunday.getUTCDate() + 6);
    return `${fmt(monday, { day: 'numeric' })} – ${fmt(sunday.toISOString().slice(0, 10), { day: 'numeric', month: 'short', year: 'numeric' })}`;
  });

  readonly dayColumns = computed(() =>
    this.store.visibleMembers().map((m) => memberColumn(m, this.store.date(), this.timezone())));

  readonly personColumns = computed(() =>
    (this.store.person()?.days ?? []).filter((d) => d.workingMinutes > 0 || dayLoad(d) > 0).map(personDayColumn));

  readonly nobodyPlanned = computed(() => {
    const shown = new Set(this.store.weekDays());
    return (this.store.response()?.members ?? []).every((m) => m.days.filter((d) => shown.has(d.date)).every((d) => dayLoad(d) === 0));
  });

  ngOnInit(): void {
    this.store.ensureToday(this.timezone());
    if (!this.store.response() && !this.store.loading()) void this.store.load();
  }

  toggle(filter: TeamFilter): void {
    this.store.filters.update((set) => {
      const next = new Set(set);
      if (next.has(filter)) next.delete(filter);
      else next.add(filter);
      return next;
    });
  }

  /** A heatmap cell: that day, as columns. */
  openDay(date: string): void {
    this.store.setDate(date);
    void this.store.setMode('day');
  }
}
