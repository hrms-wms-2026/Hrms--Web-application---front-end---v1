import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { LedTimePeriod, LedUnscheduledKind, LedUnscheduledPage } from '../../models/team-progress-detail.model';
import { clockTime } from '../../utils/team-presence-format.util';
import { minutesText } from '../../utils/team-progress-time-format.util';

interface UnscheduledTabView {
  readonly key: LedUnscheduledKind;
  readonly label: string;
  readonly count: number;
  readonly minutes: number;
}

/**
 * The Team Progress popup's Unscheduled work panel: time worked without a matching Planner slot, split into
 * All / No plan / Outside slot tabs, each entry a card (person, task, when, minutes), paged on the server.
 * The dialog fetches the page; this component only shows it and asks for another kind or page.
 * Minutes of worked time only - never estimate hours.
 */
@Component({
  selector: 'app-team-progress-time-detail',
  standalone: true,
  templateUrl: './team-progress-time-detail.component.html',
  styleUrl: './team-progress-time-detail.component.css',
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamProgressTimeDetailComponent {
  /** The page shown; kept while the next one loads. */
  readonly page = input<LedUnscheduledPage | null>(null);
  readonly status = input<'loading' | 'ready' | 'error'>('loading');
  readonly kind = input<LedUnscheduledKind>('all');
  readonly period = input<LedTimePeriod>('week');
  /** True while the CSV export fetches every page. */
  readonly exporting = input(false);
  readonly kindChange = output<LedUnscheduledKind>();
  readonly pageChange = output<number>();
  readonly retried = output<void>();
  readonly exported = output<void>();

  protected readonly periodLabel = computed(() => (this.period() === 'month' ? 'This month' : 'This week'));
  protected readonly loading = computed(() => this.status() === 'loading');

  protected readonly tabs = computed<UnscheduledTabView[]>(() => {
    const p = this.page();
    const zero = { count: 0, minutes: 0 };
    return [
      { key: 'all', label: 'All', ...(p?.all ?? zero) },
      { key: 'no_plan', label: 'No plan', ...(p?.noPlan ?? zero) },
      { key: 'outside_slot', label: 'Outside slot', ...(p?.outsideSlot ?? zero) },
    ];
  });

  protected readonly canExport = computed(() => {
    const p = this.page();
    return !!p && p.plannerEnabled && p.all.count > 0;
  });

  protected readonly rangeLabel = computed(() => {
    const p = this.page();
    if (!p || p.totalCount === 0) return '0 of 0';
    const start = (p.pageNumber - 1) * p.pageSize + 1;
    return `${start}–${start + p.items.length - 1} of ${p.totalCount}`;
  });

  protected minutes(m: number): string {
    return minutesText(m);
  }

  protected day(start: string): string {
    return new Date(start).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  }

  protected clock(start: string, end: string): string {
    return `${clockTime(start)}–${clockTime(end)}`;
  }

  protected initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '';
    return ((parts[0][0] ?? '') + last).toUpperCase();
  }

  selectTab(kind: LedUnscheduledKind): void {
    if (kind !== this.kind()) this.kindChange.emit(kind);
  }
}
