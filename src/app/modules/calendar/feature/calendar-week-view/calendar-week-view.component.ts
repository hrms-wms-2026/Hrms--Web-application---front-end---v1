import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CalendarEventResponse } from '../../models/calendar-event.model';
import { CalendarHourGridComponent, PlannerDayLoad } from '../../ui/calendar-hour-grid/calendar-hour-grid.component';
import { PlannerRangeBlockView, PlannerWorkWindow } from '../../../work/planner/models/planner.models';

@Component({
  selector: 'app-calendar-week-view',
  standalone: true,
  imports: [CommonModule, CalendarHourGridComponent],
  templateUrl: './calendar-week-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalendarWeekViewComponent {
  weekStart = input.required<string>();
  /** The days to show instead of all seven (the planner hides rest days until "Show weekend"). */
  visibleDays = input<readonly string[] | null>(null);
  events = input<readonly CalendarEventResponse[]>([]);
  timezone = input<string>('UTC');

  eventClick = output<string>();
  slotClick = output<{ date: string; hour: number }>();
  slotRange = output<{ date: string; startMinutes: number; endMinutes: number }>();

  /** Planner layer, passed straight to the hour grid (2026-10-27 Planner = Calendar design). */
  blocks = input<ReadonlyMap<string, readonly PlannerRangeBlockView[]>>(new Map());
  workWindows = input<ReadonlyMap<string, PlannerWorkWindow | null>>(new Map());
  editableDates = input<ReadonlySet<string>>(new Set());
  loads = input<ReadonlyMap<string, PlannerDayLoad>>(new Map());
  employeeId = input<string | null>(null);

  blockCreate = output<{ taskId: string; date: string; startMinutes: number; endMinutes: number }>();
  blockMove = output<{ blockId: string; date: string; startMinutes: number; endMinutes: number }>();
  blockOpen = output<PlannerRangeBlockView>();
  blockMoveAfter = output<{ block: PlannerRangeBlockView; date: string; afterMinute: number }>();
  blockRemove = output<string>();

  readonly days = computed<readonly string[]>(() => this.visibleDays() ?? this.allDays());

  private readonly allDays = computed<readonly string[]>(() => {
    const [y, m, d] = this.weekStart().split('-').map(Number);
    const start = new Date(y, m - 1, d);
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    });
  });
}
