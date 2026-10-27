import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CalendarEventResponse } from '../../models/calendar-event.model';
import { dateOnlyInTimezone, utcIsoToLocalParts } from '../../../../shared/utils/timezone.util';
import { PlannerRangeBlockView } from '../../../work/planner/models/planner.models';

/** An agenda line: a calendar event, or a planned task block (2026-10-27 Planner = Calendar design). */
type AgendaEntry =
  | { readonly kind: 'event'; readonly event: CalendarEventResponse; readonly start: string }
  | { readonly kind: 'block'; readonly block: PlannerRangeBlockView; readonly start: string };

interface AgendaGroup {
  readonly date: string;
  readonly entries: readonly AgendaEntry[];
}

@Component({
  selector: 'app-calendar-agenda-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './calendar-agenda-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalendarAgendaViewComponent {
  events = input<readonly CalendarEventResponse[]>([]);
  timezone = input<string>('UTC');
  blocks = input<readonly PlannerRangeBlockView[]>([]);
  eventClick = output<string>();
  blockClick = output<PlannerRangeBlockView>();

  clock(iso: string): string {
    return utcIsoToLocalParts(iso, this.timezone()).time;
  }

  readonly groups = computed<readonly AgendaGroup[]>(() => {
    const byDate = new Map<string, AgendaEntry[]>();
    const add = (entry: AgendaEntry) => {
      const dateKey = dateOnlyInTimezone(entry.start, this.timezone());
      byDate.set(dateKey, [...(byDate.get(dateKey) ?? []), entry]);
    };
    this.events().forEach((event) => add({ kind: 'event', event, start: event.startDate }));
    this.blocks().forEach((block) => add({ kind: 'block', block, start: block.startAt }));
    const dates = [...byDate.keys()].sort();
    return dates.map((date) => ({
      date,
      entries: [...byDate.get(date)!].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    }));
  });
}
