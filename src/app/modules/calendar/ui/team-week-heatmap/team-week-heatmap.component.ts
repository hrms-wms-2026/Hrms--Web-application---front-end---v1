import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { TeamPlannerMember } from '../../../work/planner/models/team-planner.models';
import { LOAD_BAND_COLORS, LoadBand, dayLoad, formatHours, loadBand } from '../../utils/team-load';

interface HeatCell { date: string; label: string; sub: string; bg: string; fg: string; }
interface HeatRow {
  employeeId: string; name: string; initials: string; subtitle: string | null; isLead: boolean;
  cells: HeatCell[]; total: string; capacity: string; totalOver: boolean;
}

const LEGEND: readonly { band: LoadBand; label: string }[] = [
  { band: 'none', label: 'Not planned' }, { band: 'under', label: 'Under 50%' }, { band: 'mid', label: '50–89%' },
  { band: 'full', label: 'Full' }, { band: 'over', label: 'Over capacity' }, { band: 'leave', label: 'Leave' },
];

/**
 * The team week as a load heatmap (team planner, 2026-11-03; the approved "Main" artboard): one row per person, one
 * coloured cell per shown day with hours and percent, and the week's load over capacity. Under 768px a row becomes the
 * name plus one small chip per day.
 */
@Component({
  selector: 'app-team-week-heatmap',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (narrow()) {
      <ul class="twh-list">
        @for (row of rows(); track row.employeeId) {
          <li class="twh-mrow">
            <button type="button" class="twh-person" data-testid="heat-person" (click)="personOpen.emit(row.employeeId)">
              <span class="twh-avatar">{{ row.initials }}</span><strong>{{ row.name }}</strong>
            </button>
            <span class="twh-chips">
              @for (cell of row.cells; track cell.date) {
                <button type="button" class="twh-chip" data-testid="heat-chip" [style.background]="cell.bg" [style.color]="cell.fg"
                  [attr.aria-label]="cell.date + ' ' + cell.label" (click)="cellOpen.emit({ employeeId: row.employeeId, date: cell.date })">{{ cell.label }}</button>
              }
            </span>
            <span class="twh-total" data-testid="heat-total" [class.twh-total--over]="row.totalOver">{{ row.total }} / {{ row.capacity }}</span>
          </li>
        }
      </ul>
    } @else {
      <div class="twh-scroll">
        <div class="twh-grid" [style.grid-template-columns]="'230px repeat(' + days().length + ', minmax(84px, 1fr)) 120px'">
          <span class="twh-h">Person</span>
          @for (d of dayLabels(); track d) { <span class="twh-h twh-c">{{ d }}</span> }
          <span class="twh-h twh-r">Week</span>
          @for (row of rows(); track row.employeeId) {
            <div class="twh-who">
              <button type="button" class="twh-person" data-testid="heat-person" (click)="personOpen.emit(row.employeeId)">
                <span class="twh-avatar">{{ row.initials }}</span>
                <span class="twh-name"><strong>{{ row.name }}</strong>
                  @if (row.subtitle) { <span class="twh-sub">{{ row.subtitle }}</span> }</span>
              </button>
              @if (row.isLead) {
                <button type="button" class="twh-drill" data-testid="heat-drill" (click)="drillDown.emit({ employeeId: row.employeeId, name: row.name })">View team ›</button>
              }
            </div>
            @for (cell of row.cells; track cell.date) {
              <button type="button" class="twh-cell" data-testid="heat-cell" [style.background]="cell.bg" [style.color]="cell.fg"
                (click)="cellOpen.emit({ employeeId: row.employeeId, date: cell.date })">
                <strong>{{ cell.label }}</strong><span>{{ cell.sub }}</span>
              </button>
            }
            <span class="twh-total twh-r" data-testid="heat-total" [class.twh-total--over]="row.totalOver">
              <strong>{{ row.total }}</strong> / {{ row.capacity }}
            </span>
          }
        </div>
      </div>
      <div class="twh-legend">
        <span class="twh-legend-title">Load</span>
        @for (l of legend; track l.band) {
          <span class="twh-key"><span class="twh-swatch" [style.background]="colors[l.band].bg"></span>{{ l.label }}</span>
        }
        <span class="twh-hint">Click a cell → that person's day</span>
      </div>
    }
  `,
  styles: [`
    :host { display: block; }
    .twh-scroll { overflow-x: auto; }
    .twh-grid { display: grid; gap: 8px; align-items: center; min-width: 100%; }
    .twh-h { font-size: 13px; color: #52525b; font-weight: 500; }
    .twh-c { text-align: center; }
    .twh-r { text-align: right; }
    .twh-who { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .twh-person { all: unset; cursor: pointer; display: flex; align-items: center; gap: 10px; min-width: 0; }
    .twh-person:focus-visible, .twh-cell:focus-visible, .twh-drill:focus-visible, .twh-chip:focus-visible { outline: 2px solid #1d4ed8; outline-offset: 2px; }
    .twh-avatar { width: 34px; height: 34px; flex: none; border-radius: 50%; background: #1d4ed8; color: #fff; display: grid; place-items: center;
      font-weight: 600; font-size: 12px; }
    .twh-name { display: flex; flex-direction: column; min-width: 0; }
    .twh-name strong { font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .twh-sub { font-size: 12px; color: #52525b; }
    .twh-drill { all: unset; cursor: pointer; margin-left: 44px; font-size: 12px; color: #1d4ed8; }
    .twh-cell { all: unset; cursor: pointer; box-sizing: border-box; height: 62px; border-radius: 10px; display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 2px; }
    .twh-cell strong { font-size: 16px; }
    .twh-cell span { font-size: 11px; }
    .twh-total { font-size: 14px; color: #18181b; }
    .twh-total--over { color: #c2410c; }
    .twh-legend { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 18px; margin-top: 14px; padding-top: 12px; border-top: 1px solid #f4f4f5;
      font-size: 12px; color: #3f3f46; }
    .twh-legend-title { font-weight: 600; }
    .twh-key { display: flex; align-items: center; gap: 6px; }
    .twh-swatch { width: 18px; height: 12px; border-radius: 3px; }
    .twh-hint { margin-left: auto; }
    .twh-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
    .twh-mrow { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 8px; border: 1px solid #e4e4e7; border-radius: 12px; }
    .twh-chips { display: flex; gap: 4px; flex: 1; }
    .twh-chip { all: unset; cursor: pointer; flex: 1; min-width: 36px; height: 28px; border-radius: 6px; display: grid; place-items: center;
      font-size: 11px; font-weight: 600; }
  `],
})
export class TeamWeekHeatmapComponent {
  readonly members = input.required<readonly TeamPlannerMember[]>();
  /** The dates shown, 'YYYY-MM-DD'. */
  readonly days = input.required<readonly string[]>();
  readonly cellOpen = output<{ employeeId: string; date: string }>();
  readonly personOpen = output<string>();
  readonly drillDown = output<{ employeeId: string; name: string }>();

  readonly legend = LEGEND;
  readonly colors = LOAD_BAND_COLORS;
  readonly narrow = signal(false);

  readonly dayLabels = computed(() => this.days().map((d) =>
    new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', timeZone: 'UTC' })));

  readonly rows = computed<HeatRow[]>(() => this.members().map((m) => {
    let load = 0;
    let capacity = 0;
    const cells = this.days().map((date) => {
      const day = m.days.find((d) => d.date === date);
      const minutes = day ? dayLoad(day) : 0;
      const cap = day?.capacityMinutes ?? 0;
      load += minutes;
      capacity += cap;
      const band = loadBand(minutes, cap, day?.onLeave ?? false);
      const { bg, fg } = LOAD_BAND_COLORS[band];
      if (band === 'leave') return { date, label: 'Leave', sub: '', bg, fg };
      if (band === 'none') return { date, label: '—', sub: 'not planned', bg, fg };
      return { date, label: formatHours(minutes), sub: cap > 0 ? `${Math.round((minutes / cap) * 100)}%` : 'no hours', bg, fg };
    });
    const hours = (x: number) => (x > 0 ? formatHours(x) : '0h');
    return {
      employeeId: m.employeeId, name: m.name,
      initials: m.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join(''),
      subtitle: m.directReportCount > 0 ? `Lead · ${m.directReportCount} report${m.directReportCount === 1 ? '' : 's'}` : null,
      isLead: m.directReportCount > 0, cells, total: hours(load), capacity: hours(capacity), totalOver: load > capacity,
    };
  }));

  constructor() {
    const query = globalThis.matchMedia?.('(max-width: 767px)');
    if (query) {
      this.narrow.set(query.matches);
      const onChange = (e: MediaQueryListEvent) => this.narrow.set(e.matches);
      query.addEventListener?.('change', onChange);
      inject(DestroyRef).onDestroy(() => query.removeEventListener?.('change', onChange));
    }
  }
}
