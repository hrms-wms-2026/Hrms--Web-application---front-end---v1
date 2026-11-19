import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, computed, inject, signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { PopoutHeaderActionsComponent } from '../../../../shared/ui/popout-header-actions/popout-header-actions.component';
import { LOAD_BAND_COLORS, dayLoad, formatHours, loadBand } from '../../../calendar/utils/team-load';
import { PlannerApiService } from '../../../work/planner/data-access/planner-api.service';
import { TeamPlannerResponse } from '../../../work/planner/models/team-planner.models';

interface PlanRow { id: string; name: string; initials: string; load: string; pct: number; color: string; chip: string | null; }

/** Below this height the card shows its first rows and "+N more". */
const COMPACT_HEIGHT_PX = 300;
const COMPACT_ROWS = 4;

/**
 * "Team plan today" on the My Team dashboard (team planner, Phase A, 2026-11-03): each direct report's planned load for
 * today, with On leave / Not planned. A row opens that person's plan; the header link opens the team planner.
 */
@Component({
  selector: 'app-team-plan-today-card',
  standalone: true,
  imports: [RouterLink, PopoutHeaderActionsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="tpt group">
      <header class="tpt-head">
        <h3>My team plan today</h3>
        <div class="tpt-actions">
          <a data-testid="tpt-open" routerLink="/planner" [queryParams]="{ scope: 'team', teamView: 'day' }">Open team planner ›</a>
          <!-- Refresh in the top-right corner, shown only while the card is hovered (or the button has focus) -->
          <div class="opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
            <app-popout-header-actions
              [refreshing]="loading() && rows().length > 0"
              [expanded]="false"
              [canExpand]="false"
              (refresh)="load()"
            />
          </div>
        </div>
      </header>
      @if (off()) {
        <p class="tpt-state" data-testid="tpt-off">Planner is off</p>
      } @else if (error()) {
        <div class="tpt-state" data-testid="tpt-error" role="alert">
          <span>Unable to load team plan</span>
          <button type="button" data-testid="tpt-retry" (click)="load()">Retry</button>
        </div>
      } @else if (loading() && rows().length === 0) {
        @for (i of [1, 2, 3]; track i) { <div class="tpt-skeleton"></div> }
      } @else {
        <ul class="tpt-list">
          @for (row of shownRows(); track row.id) {
            <li>
              <button type="button" class="tpt-row" data-testid="tpt-row" (click)="open(row.id)">
                <span class="tpt-avatar">{{ row.initials }}</span>
                <span class="tpt-main">
                  <strong data-testid="tpt-name">{{ row.name }}</strong>
                  @if (row.chip) {
                    <span class="tpt-chip" data-testid="tpt-chip">{{ row.chip }}</span>
                  } @else {
                    <span class="tpt-bar"><span [style.width.%]="row.pct" [style.background]="row.color"></span></span>
                  }
                </span>
                <span class="tpt-load" data-testid="tpt-load">{{ row.load }}</span>
              </button>
            </li>
          } @empty {
            <li class="tpt-state">No direct reports</li>
          }
        </ul>
        @if (hiddenCount() > 0) { <p class="tpt-more" data-testid="tpt-more">+{{ hiddenCount() }} more</p> }
      }
    </section>
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .tpt { height: 100%; display: flex; flex-direction: column; gap: 8px; overflow: auto; }
    .tpt-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .tpt-actions { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
    .tpt-head h3 { margin: 0; font-size: 15px; font-weight: 600; }
    .tpt-head a { font-size: 13px; color: var(--color-accent, #1d4ed8); white-space: nowrap; }
    .tpt-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
    .tpt-row { all: unset; cursor: pointer; box-sizing: border-box; width: 100%; display: flex; align-items: center; gap: 10px; padding: 6px 4px;
      border-radius: 8px; }
    .tpt-row:hover { background: var(--color-surface-secondary, #f4f4f5); }
    .tpt-row:focus-visible { outline: 2px solid var(--color-accent-hover); }
    .tpt-avatar { width: 30px; height: 30px; flex: none; border-radius: 50%; background: var(--color-accent-hover); color: var(--color-text-on-solid); display: grid; place-items: center;
      font-size: 11px; font-weight: 600; }
    .tpt-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
    .tpt-main strong { font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .tpt-bar { height: 6px; border-radius: 3px; background: var(--color-surface-secondary); overflow: hidden; display: flex; }
    .tpt-chip { align-self: flex-start; font-size: 11px; font-weight: 600; padding: 1px 8px; border-radius: 999px; background: var(--color-surface-secondary); color: var(--color-text-primary); }
    .tpt-load { font-size: 12px; color: var(--color-text-primary); white-space: nowrap; }
    .tpt-more { margin: 0; font-size: 12px; color: var(--color-text-secondary); }
    .tpt-state { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 16px; color: var(--color-text-secondary); font-size: 13px; }
    .tpt-state button { border: 0; border-radius: 8px; background: var(--color-accent-hover); color: var(--color-text-on-solid); padding: 6px 14px; font: inherit; cursor: pointer; }
    .tpt-skeleton { height: 36px; border-radius: 8px; background: var(--color-surface-secondary); }
  `],
})
export class TeamPlanTodayCardComponent implements OnInit {
  private readonly api = inject(PlannerApiService);
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);

  readonly response = signal<TeamPlannerResponse | null>(null);
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly off = signal(false);
  /** Small card: the first rows and "+N more". Follows the card's rendered height. */
  readonly compact = signal(false);

  readonly rows = computed<PlanRow[]>(() => (this.response()?.members ?? []).map((m) => {
    const day = m.days[0];
    const load = day ? dayLoad(day) : 0;
    const capacity = day?.capacityMinutes ?? 0;
    const hours = (x: number) => (x > 0 ? formatHours(x) : '0h');
    // Leave seen as busy leaves a working day with no capacity: neither on leave nor "not planned".
    const chip = day?.onLeave ? 'On leave' : load === 0 && capacity > 0 ? 'Not planned' : null;
    return {
      id: m.employeeId, name: m.name,
      initials: m.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join(''),
      load: `${hours(load)} / ${hours(capacity)}`,
      pct: capacity > 0 ? Math.min(100, (load / capacity) * 100) : load > 0 ? 100 : 0,
      color: LOAD_BAND_COLORS[loadBand(load, capacity, day?.onLeave ?? false)].bg, chip,
    };
  }));
  readonly shownRows = computed(() => (this.compact() ? this.rows().slice(0, COMPACT_ROWS) : this.rows()));
  readonly hiddenCount = computed(() => this.rows().length - this.shownRows().length);

  ngOnInit(): void {
    void this.load();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => this.compact.set((entries[0]?.contentRect.height ?? 0) < COMPACT_HEIGHT_PX));
    observer.observe(this.host.nativeElement);
    this.destroyRef.onDestroy(() => observer.disconnect());
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(false);
    try {
      this.response.set(await firstValueFrom(this.api.getTeamDay(null, null)));
    } catch (err) {
      if (err instanceof HttpErrorResponse && err.status === 503) this.off.set(true);
      else this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  open(employeeId: string): void {
    void this.router.navigate(['/planner'], { queryParams: { scope: 'team', teamView: 'day', person: employeeId } });
  }
}
