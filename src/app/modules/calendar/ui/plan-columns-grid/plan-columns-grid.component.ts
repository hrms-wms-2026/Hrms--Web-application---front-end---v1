import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { localPartsToUtcIso, utcIsoToLocalParts } from '../../../../shared/utils/timezone.util';
import { LOAD_BAND_COLORS } from '../../utils/team-load';
import { PlanColumn, PlanItem } from './plan-columns';

const HOUR_PX = 72;

const ITEM_STYLE: Record<PlanItem['kind'], string> = {
  block: 'background:var(--color-accent-subtle);color:var(--color-text-primary);border-left:3px solid var(--color-accent)',
  meeting: 'background:var(--color-cat-violet-subtle);color:var(--color-text-primary);border-left:3px solid var(--color-cat-violet)',
  busy: 'background:repeating-linear-gradient(45deg,var(--color-border),var(--color-border) 6px,var(--color-surface-secondary) 6px,var(--color-surface-secondary) 12px);color:var(--color-text-primary);border-left:3px solid var(--color-text-muted)',
  leave: 'background:var(--color-warning-subtle);color:var(--color-warning-text);border:1px dashed var(--color-warning-text)',
  leavePending: 'background:color-mix(in srgb, var(--color-warning-subtle) 55%, var(--color-surface));color:var(--color-warning-text);border:1px dashed var(--color-warning)',
};

interface PlacedItem extends PlanItem { top: number; height: number; style: string; time: string; }
interface PlacedColumn extends PlanColumn { placed: PlacedItem[]; off: { top: number; height: number }[]; initials: string; barColor: string; }

/**
 * Columns of timed items on one hour grid (team planner, 2026-11-03): people on the team day, or days of one person's week.
 * Read-only. Items sit at their instant in the viewer's zone; time outside the column's work window is hatched. Under 768px
 * each column becomes a card listing its items.
 */
@Component({
  selector: 'app-plan-columns-grid',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (narrow()) {
      <div class="pcg-cards">
        @for (col of placed(); track col.key) {
          <section class="pcg-card" data-testid="plan-card">
            <button type="button" class="pcg-head" data-testid="plan-col-open" (click)="columnOpen.emit(col.key)">
              <span class="pcg-avatar">{{ col.initials }}</span>
              <span class="pcg-who"><strong data-testid="plan-col-title">{{ col.title }}</strong>
                @if (col.subtitle) { <span class="pcg-sub">{{ col.subtitle }}</span> }</span>
              <span class="pcg-load" data-testid="plan-col-load">{{ col.loadLabel }}</span>
            </button>
            <ul class="pcg-list">
              @for (item of col.placed; track item.key) {
                <li data-testid="plan-card-item" [style]="item.style"><span>{{ item.time }}</span> {{ item.label }}</li>
              } @empty { <li class="pcg-empty">Nothing planned</li> }
            </ul>
          </section>
        }
      </div>
    } @else {
      <div class="pcg-scroll">
        <div class="pcg-grid" [style.grid-template-columns]="'64px repeat(' + placed().length + ', minmax(180px, 1fr))'">
          <div class="pcg-time">
            <div class="pcg-corner">{{ zoneName() }}</div>
            @for (h of hours(); track h) { <div class="pcg-hour">{{ h }}</div> }
          </div>
          @for (col of placed(); track col.key) {
            <div class="pcg-col">
              <button type="button" class="pcg-head" data-testid="plan-col-open" (click)="columnOpen.emit(col.key)">
                <span class="pcg-avatar">{{ col.initials }}</span>
                <span class="pcg-who"><strong data-testid="plan-col-title">{{ col.title }}</strong>
                  @if (col.subtitle) { <span class="pcg-sub">{{ col.subtitle }}</span> }</span>
                <span class="pcg-bar"><span [style.width.%]="col.loadPct" [style.background]="col.barColor"></span></span>
                <span class="pcg-load" data-testid="plan-col-load">{{ col.loadLabel }}</span>
              </button>
              <div class="pcg-body" [style.height.px]="bodyHeight()">
                @for (o of col.off; track $index) {
                  <span class="pcg-off" data-testid="plan-off" [style.top.px]="o.top" [style.height.px]="o.height"></span>
                }
                @for (item of col.placed; track item.key) {
                  <span class="pcg-item" data-testid="plan-item" [style]="item.style" [style.top.px]="item.top" [style.height.px]="item.height"
                    [attr.title]="item.time + ' ' + item.label">{{ item.label }}</span>
                }
              </div>
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display: block; }
    .pcg-scroll { overflow-x: auto; border: 1px solid var(--color-border, #e4e4e7); border-radius: 12px; }
    .pcg-grid { display: grid; min-width: 100%; }
    .pcg-time { position: sticky; left: 0; z-index: 2; background: var(--color-surface-muted, #fafafa); border-right: 1px solid var(--color-border, #e4e4e7); }
    .pcg-corner { height: 92px; box-sizing: border-box; border-bottom: 1px solid var(--color-border, #e4e4e7); display: flex; align-items: flex-end;
      justify-content: center; padding-bottom: 8px; font-size: 11px; color: var(--color-text-secondary); }
    .pcg-hour { height: 72px; box-sizing: border-box; padding: 4px 8px 0 0; text-align: right; font-size: 11px; color: var(--color-text-secondary); border-bottom: 1px solid var(--color-border); }
    .pcg-col { border-right: 1px solid var(--color-border, #e4e4e7); min-width: 0; }
    .pcg-head { all: unset; cursor: pointer; box-sizing: border-box; width: 100%; height: 92px; padding: 10px; display: grid;
      grid-template-columns: 28px 1fr; grid-template-rows: auto auto; gap: 4px 8px; align-items: center;
      border-bottom: 1px solid var(--color-border, #e4e4e7); background: var(--color-surface, #fff); }
    .pcg-head:focus-visible { outline: 2px solid var(--color-accent-hover); outline-offset: -2px; }
    .pcg-avatar { width: 28px; height: 28px; border-radius: 50%; background: var(--color-accent-hover); color: var(--color-text-on-solid); display: grid; place-items: center;
      font-weight: 600; font-size: 11px; }
    .pcg-who { display: flex; flex-direction: column; min-width: 0; }
    .pcg-who strong { font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .pcg-sub { font-size: 11px; color: var(--color-text-secondary); }
    .pcg-bar { grid-column: 1 / span 2; height: 6px; border-radius: 3px; background: var(--color-surface-secondary); overflow: hidden; display: flex; }
    .pcg-load { grid-column: 1 / span 2; font-size: 11px; font-weight: 600; color: var(--color-text-primary); }
    .pcg-body { position: relative; background-image: repeating-linear-gradient(to bottom, transparent 0, transparent 71px, var(--color-surface-secondary) 71px, var(--color-surface-secondary) 72px); }
    .pcg-off { position: absolute; left: 0; right: 0; background: repeating-linear-gradient(45deg, var(--color-surface-secondary), var(--color-surface-secondary) 6px, var(--color-app-bg) 6px, var(--color-app-bg) 12px); }
    .pcg-item { position: absolute; left: 6px; right: 6px; box-sizing: border-box; border-radius: 6px; padding: 3px 7px; font-size: 11px;
      font-weight: 600; overflow: hidden; }
    .pcg-cards { display: flex; flex-direction: column; gap: 10px; }
    .pcg-card { border: 1px solid var(--color-border, #e4e4e7); border-radius: 12px; overflow: hidden; background: var(--color-surface, #fff); }
    .pcg-card .pcg-head { height: auto; grid-template-columns: 28px 1fr auto; grid-template-rows: auto; }
    .pcg-card .pcg-load { grid-column: auto; }
    .pcg-list { list-style: none; margin: 0; padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; font-size: 12px; }
    .pcg-list li { border-radius: 6px; padding: 4px 8px; }
    .pcg-empty { color: var(--color-text-secondary); }
  `],
})
export class PlanColumnsGridComponent {
  readonly columns = input.required<readonly PlanColumn[]>();
  /** The viewer's zone: every item is drawn at its instant in it. */
  readonly timezone = input.required<string>();
  readonly fromHour = input(7);
  readonly toHour = input(20);
  readonly columnOpen = output<string>();

  readonly narrow = signal(false);

  /** fromHour–toHour, widened to every item and work window in the viewer's zone so nothing falls off the grid. */
  readonly range = computed(() => {
    const zone = this.timezone();
    let from = this.fromHour();
    let to = this.toHour();
    for (const col of this.columns()) {
      const hourOf = (iso: string) => {
        const parts = utcIsoToLocalParts(iso, zone);
        if (parts.date < col.date) return 0;
        if (parts.date > col.date) return 24;
        const [h, m] = parts.time.split(':').map(Number);
        return h + m / 60;
      };
      const starts = [...col.items.map((i) => i.startIso), ...(col.workStartIso ? [col.workStartIso] : [])];
      const ends = [...col.items.map((i) => i.endIso), ...(col.workEndIso ? [col.workEndIso] : [])];
      for (const s of starts) from = Math.min(from, Math.floor(hourOf(s)));
      for (const e of ends) to = Math.max(to, Math.ceil(hourOf(e)));
    }
    return { from: Math.max(0, from), to: Math.min(24, to) };
  });
  readonly hours = computed(() => Array.from({ length: this.range().to - this.range().from }, (_, i) => `${this.range().from + i}:00`));
  readonly bodyHeight = computed(() => (this.range().to - this.range().from) * HOUR_PX);
  readonly zoneName = computed(() => (this.timezone().split('/').pop() ?? '').replace(/_/g, ' '));

  readonly placed = computed<PlacedColumn[]>(() => {
    const zone = this.timezone();
    const total = this.bodyHeight();
    const pad = (h: number) => `${String(h).padStart(2, '0')}:00`;
    return this.columns().map((col) => {
      const start = Date.parse(localPartsToUtcIso(col.date, pad(this.range().from), zone));
      const px = (iso: string) => Math.min(total, Math.max(0, ((Date.parse(iso) - start) / 60000) * (HOUR_PX / 60)));
      const placed = col.items.map((item) => {
        const top = px(item.startIso);
        return { ...item, top, height: px(item.endIso) - top, style: ITEM_STYLE[item.kind],
          time: utcIsoToLocalParts(item.startIso, zone).time };
      }).filter((i) => i.height > 0 || this.narrow());
      const off = col.workStartIso && col.workEndIso
        ? [{ top: 0, height: px(col.workStartIso) }, { top: px(col.workEndIso), height: total - px(col.workEndIso) }]
        : [{ top: 0, height: total }];
      const initials = col.title.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
      return { ...col, placed, off: off.filter((o) => o.height > 0), initials, barColor: LOAD_BAND_COLORS[col.band].bg };
    });
  });

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
