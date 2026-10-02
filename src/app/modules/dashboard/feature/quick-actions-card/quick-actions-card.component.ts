import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TimeTrackingStore } from '../../../attendance/state/time-tracking.store';

@Component({
  selector: 'app-quick-actions-card',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './quick-actions-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class QuickActionsCardComponent implements OnInit {
  private readonly store = inject(TimeTrackingStore);

  protected readonly today = this.store.today;
  protected readonly actionLoading = this.store.actionLoading;
  protected readonly activeAction = this.store.activeAction;

  protected readonly onBreak = computed(() => this.today()?.canEndBreak ?? false);
  protected readonly breakDisabled = computed(() => {
    const today = this.today();
    if (!today) return true;
    return !today.canStartBreak && !today.canEndBreak;
  });

  protected readonly breakLabel = computed(() => (this.onBreak() ? 'End Break' : 'Start Break'));
  protected readonly breakBusy = computed(
    () => this.actionLoading() && (this.activeAction() === 'startBreak' || this.activeAction() === 'endBreak')
  );

  ngOnInit(): void {
    void this.store.loadToday();
  }

  protected toggleBreak(): void {
    if (this.actionLoading()) return;
    if (this.onBreak()) {
      void this.store.endBreak();
    } else if (this.today()?.canStartBreak) {
      void this.store.startBreak();
    }
  }
}
