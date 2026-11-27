import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';

/** Previous/Next footer shared by the attendance history list and the my-requests tables. */
@Component({
  selector: 'app-attendance-list-pager',
  imports: [ButtonComponent],
  templateUrl: './attendance-list-pager.component.html',
  styleUrl: './attendance-list-pager.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AttendanceListPagerComponent {
  readonly page = input.required<number>();
  readonly pageSize = input.required<number>();
  readonly totalCount = input.required<number>();
  /** Disables both buttons while a page request is in flight. */
  readonly busy = input(false);

  readonly pageChanged = output<number>();

  protected readonly visible = computed(() => this.totalCount() > this.pageSize());
  protected readonly pageCount = computed(() => Math.ceil(this.totalCount() / this.pageSize()));
  protected readonly atStart = computed(() => this.page() <= 1 || this.busy());
  protected readonly atEnd = computed(() => this.page() * this.pageSize() >= this.totalCount() || this.busy());
}
