/** Quiet Operations Desk: Screen 7's month view - who's off, colour by type, click for detail. */
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { LeaveCalendarStore } from '../../state/leave-calendar.store';
import { LeaveCalendarGridComponent } from '../../ui/leave-calendar-grid/leave-calendar-grid.component';
import { LeaveCalendarDayDetailComponent } from '../../ui/leave-calendar-day-detail/leave-calendar-day-detail.component';

@Component({
  selector: 'app-team-calendar',
  standalone: true,
  imports: [CommonModule, EmptyStateComponent, ErrorStateComponent, LeaveCalendarGridComponent, LeaveCalendarDayDetailComponent],
  templateUrl: './team-calendar.component.html',
  styleUrl: './team-calendar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TeamCalendarComponent {
  readonly store = inject(LeaveCalendarStore);
  readonly detailOpen = signal(false);
  readonly selectedDate = signal<string | null>(null);
  readonly selectedDay = computed(() =>
    this.store.month()?.days.find((d) => d.date === this.selectedDate()) ?? null
  );

  readonly monthLabel = computed(() => {
    const m = this.store.month();
    if (!m) return '';
    return new Date(m.year, m.month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  });

  constructor() {
    void this.store.load();
  }

  onDayClicked(date: string): void {
    this.selectedDate.set(date);
    this.detailOpen.set(true);
  }

  closeDetail(): void {
    this.detailOpen.set(false);
  }
}
