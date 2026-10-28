import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { buildFileUrl } from '../../../../shared/data-access/file-api.service';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { KpiTile, KpiTilesComponent } from '../../../../shared/ui/kpi-tiles/kpi-tiles.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { downloadCsv, toCsv } from '../../../../shared/utils/csv.util';
import { TeamScheduleItem, TeamScheduleMember } from '../../models/team-schedule.model';
import { TeamScheduleStore } from '../../state/team-schedule.store';
import { clockTime, minutesText } from '../../utils/team-presence-format.util';
import {
  completionText,
  hasPlan,
  hourTicks,
  itemColor,
  itemStatusLabel,
  notRankedText,
  percentText,
  spanPosition,
  timelineSpan,
  unscheduledMinutes
} from '../../utils/team-schedule-format.util';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Today's team schedule popup, in the Team Progress popup's shell: a date navigator (today and past days only - Planner v1
 * plans today), one KPI tile row, the timeline with planned / clocked / score columns, the execution ranking with both
 * parts, unscheduled work, conflicts and CSV export. Titles arrive masked ("Private meeting") from the backend and are
 * used as they are everywhere, CSV included. The ranking keeps the backend's order, so it only re-sorts on a reload.
 */
@Component({
  selector: 'app-team-schedule-detail-dialog',
  standalone: true,
  imports: [ModalComponent, KpiTilesComponent, AvatarComponent],
  templateUrl: './team-schedule-detail-dialog.component.html',
  styleUrl: './team-schedule-detail-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TeamScheduleDetailDialogComponent {
  readonly open = input(false);
  readonly closed = output<void>();

  protected readonly store = inject(TeamScheduleStore);
  /** The file download; a field so a test can stand in for the browser download. */
  downloadFile = downloadCsv;

  protected readonly isToday = computed(() => this.store.date() === null);

  protected readonly dateLabel = computed(() => {
    const date = this.store.data()?.date;
    if (!date) return '';
    const [y, m, d] = date.split('-').map(Number);
    return `${this.isToday() ? 'Today · ' : ''}${d} ${MONTHS[m - 1]} ${y}`;
  });

  protected readonly tiles = computed<KpiTile[]>(() => {
    const s = this.store.data()?.summary;
    if (!s) return [];
    return [
      { label: 'Tasks planned', value: s.tasksPlanned, icon: 'clipboard-list', tone: 'neutral', testId: 'tsd-tile-planned' },
      { label: 'Completed', value: s.tasksCompleted, icon: 'check-circle', tone: 'success', testId: 'tsd-tile-completed' },
      { label: 'In progress', value: s.tasksInProgress, icon: 'clock', tone: 'accent', testId: 'tsd-tile-progress' },
      { label: 'Pending', value: s.tasksPending, icon: 'layers', tone: 'neutral', testId: 'tsd-tile-pending' },
      { label: 'Meetings', value: s.meetings, icon: 'users', tone: 'neutral', testId: 'tsd-tile-meetings' },
      {
        label: 'Unscheduled people',
        value: s.peopleWithUnscheduledWork,
        hint: s.peopleWithUnscheduledWork > 0 ? `${minutesText(s.unscheduledMinutes)} worked without a slot` : undefined,
        icon: 'alert-triangle',
        tone: s.peopleWithUnscheduledWork > 0 ? 'warning' : 'neutral',
        testId: 'tsd-tile-unscheduled'
      }
    ];
  });

  protected readonly span = computed(() => {
    const data = this.store.data();
    return timelineSpan(data?.members ?? [], data?.date ?? '1970-01-01');
  });
  protected readonly ticks = computed(() => hourTicks(this.span()));

  protected readonly unscheduledRows = computed(() =>
    (this.store.data()?.members ?? []).flatMap((m) => m.unscheduled.map((u) => ({ member: m, row: u })))
  );
  protected readonly conflictRows = computed(() =>
    (this.store.data()?.members ?? []).flatMap((m) => m.conflicts.map((c) => ({ member: m, row: c })))
  );

  protected position(startIso: string, endIso: string): { left: number; width: number } | null {
    return spanPosition(startIso, endIso, this.span());
  }

  protected itemColor(item: TeamScheduleItem): string {
    return itemColor(item);
  }

  protected itemTitle(item: TeamScheduleItem): string {
    return `${item.title} · ${clockTime(item.start)}-${clockTime(item.end)} · ${itemStatusLabel(item)}`;
  }

  protected range(startIso: string, endIso: string): string {
    return `${clockTime(startIso)}–${clockTime(endIso)}`;
  }

  protected minutes(m: number): string {
    return minutesText(m);
  }

  protected percent(value: number | null): string {
    return percentText(value);
  }

  protected completion(m: TeamScheduleMember): string {
    return completionText(m);
  }

  protected hasPlan(m: TeamScheduleMember): boolean {
    return hasPlan(m);
  }

  protected unscheduled(m: TeamScheduleMember): number {
    return unscheduledMinutes(m);
  }

  protected reason(m: TeamScheduleMember): string {
    return notRankedText(m.notRankedReason);
  }

  protected avatarUrl(m: TeamScheduleMember): string | null {
    return m.avatarFileId ? buildFileUrl(m.avatarFileId) : null;
  }

  shiftDay(step: -1 | 1): void {
    if (step === 1 && this.isToday()) return;
    this.store.shiftDay(step);
  }

  close(): void {
    this.closed.emit();
  }

  /** One row per person; item titles as the backend sent them (private meetings already "Private meeting"). */
  exportCsv(): void {
    const data = this.store.data();
    if (!data) return;
    const header = [
      'Name', 'Planned task min', 'Planned meeting min', 'Clocked min', 'Scheduled min', 'Outside slot min', 'No plan min',
      'Item completion %', 'Time coverage %', 'Execution score (today)', 'Rank', 'Not ranked', 'Items'
    ];
    const lines = data.members.map((m) => [
      m.displayName,
      String(m.plannedTaskMinutes),
      String(m.plannedMeetingMinutes),
      String(m.clockedMinutes),
      data.plannerEnabled ? String(m.scheduledMinutes) : '',
      data.plannerEnabled ? String(m.outsideSlotMinutes) : '',
      data.plannerEnabled ? String(m.noPlanMinutes) : '',
      m.itemCompletionPercent === null ? '' : String(m.itemCompletionPercent),
      m.timeCoveragePercent === null ? '' : String(m.timeCoveragePercent),
      m.score === null ? '' : String(m.score),
      m.rank === null ? '' : String(m.rank),
      notRankedText(m.notRankedReason),
      m.items.map((i) => `${i.title} (${itemStatusLabel(i)})`).join('; ')
    ]);
    this.downloadFile(`team-schedule-${data.date}.csv`, toCsv([header, ...lines]));
  }
}
