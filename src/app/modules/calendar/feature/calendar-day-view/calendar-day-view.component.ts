import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CalendarEventResponse } from '../../models/calendar-event.model';
import { CalendarHourGridComponent, PlannerDayLoad } from '../../ui/calendar-hour-grid/calendar-hour-grid.component';
import { PlannerRangeBlockView, PlannerWorkWindow } from '../../../work/planner/models/planner.models';

@Component({
  selector: 'app-calendar-day-view',
  standalone: true,
  imports: [CommonModule, CalendarHourGridComponent],
  templateUrl: './calendar-day-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalendarDayViewComponent {
  date = input.required<string>();
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

  readonly days = computed<readonly string[]>(() => [this.date()]);
}
