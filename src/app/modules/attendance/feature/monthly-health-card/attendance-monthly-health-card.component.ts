import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { TimeTrackingStore } from '../../state/time-tracking.store';
import { TimeTrackingRange } from '../../models/time-tracking.model';

@Component({
  selector: 'app-attendance-monthly-health-card',
  standalone: true,
  imports: [CardComponent],
  templateUrl: './attendance-monthly-health-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AttendanceMonthlyHealthCardComponent implements OnInit {
  private readonly store = inject(TimeTrackingStore);

  protected readonly summary = this.store.monthlySummary;
  protected readonly loading = this.store.monthlySummaryLoading;
  protected readonly error = this.store.monthlySummaryError;

  ngOnInit(): void {
    void this.store.loadMonthlySummary(currentMonthRange());
  }

  retry(): void {
    void this.store.loadMonthlySummary(currentMonthRange());
  }
}

function currentMonthRange(reference = new Date()): TimeTrackingRange {
  const from = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const to = new Date(reference.getFullYear(), reference.getMonth() + 1, 0);
  return { from: toDateOnly(from), to: toDateOnly(to) };
}

function toDateOnly(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}
