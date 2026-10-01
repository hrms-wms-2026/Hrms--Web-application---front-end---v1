import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { buildFileUrl } from '../../../../shared/data-access/file-api.service';
import { MyTeamTodayStore } from '../../state/my-team-today.store';
import { TeamTodayMember } from '../../models/my-team-today.model';

const REFRESH_INTERVAL_MS = 60_000;

const STATUS_PILL_CLASS: Record<string, string> = {
  working: 'team-status-pill--working',
  on_break: 'team-status-pill--on-break',
  clocked_out: 'team-status-pill--clocked-out',
  absent: 'team-status-pill--absent',
  late: 'team-status-pill--absent',
  not_started: 'team-status-pill--not-started',
  on_leave: 'team-status-pill--on-leave',
  not_scheduled: 'team-status-pill--not-scheduled'
};

const STATUS_DOT_CLASS: Record<string, string> = {
  working: 'team-status-dot--working',
  on_break: 'team-status-dot--on-break',
  absent: 'team-status-dot--absent',
  late: 'team-status-dot--absent',
  on_leave: 'team-status-dot--on-leave',
  not_started: 'team-status-dot--not-started'
};

@Component({
  selector: 'app-team-status-card',
  standalone: true,
  imports: [NgClass, AvatarComponent, EmptyStateComponent, ErrorStateComponent],
  templateUrl: './team-status-card.component.html',
  styleUrl: './team-status-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TeamStatusCardComponent implements OnInit {
  protected readonly store = inject(MyTeamTodayStore);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private pollId: ReturnType<typeof setInterval> | null = null;
  private visibilityHandler = (): void => this.onVisibilityChange();

  protected readonly summaryStats = computed(() => {
    const summary = this.store.data()?.summary;
    if (!summary) return [];
    return [
      { key: 'working', label: 'Working', count: summary.working },
      { key: 'on_break', label: 'On Break', count: summary.onBreak },
      { key: 'late', label: 'Late', count: summary.late },
      { key: 'absent', label: 'Absent', count: summary.absent },
      { key: 'on_leave', label: 'On Leave', count: summary.onLeave },
      { key: 'not_started', label: 'Not Started', count: summary.notStarted }
    ];
  });

  ngOnInit(): void {
    void this.store.load();
    document.addEventListener('visibilitychange', this.visibilityHandler);
    if (document.visibilityState === 'visible') this.startPolling();
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.stopPolling();
    });
  }

  private onVisibilityChange(): void {
    if (document.visibilityState === 'visible') {
      void this.store.load();
      this.startPolling();
    } else {
      this.stopPolling();
    }
  }

  private startPolling(): void {
    if (this.pollId) return;
    this.pollId = setInterval(() => void this.store.load(), REFRESH_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (this.pollId) {
      clearInterval(this.pollId);
      this.pollId = null;
    }
  }

  retry(): void {
    void this.store.load();
  }

  avatarUrl(member: TeamTodayMember): string | null {
    return member.avatarFileId ? buildFileUrl(member.avatarFileId) : null;
  }

  pillClass(status: string): string {
    return STATUS_PILL_CLASS[status] ?? 'team-status-pill--not-scheduled';
  }

  dotClass(status: string): string {
    return STATUS_DOT_CLASS[status] ?? 'team-status-dot--not-started';
  }

  sinceOrEndsLabel(member: TeamTodayMember): string | null {
    if (member.leave) return `ends ${member.leave.endsOn}`;
    if (member.status === 'working' || member.status === 'on_break') {
      return member.clockInAt ? `since ${formatTime(member.clockInAt)}` : null;
    }
    if (member.status === 'clocked_out' && member.clockOutAt) {
      return `until ${formatTime(member.clockOutAt)}`;
    }
    return null;
  }

  openMember(member: TeamTodayMember): void {
    void this.router.navigate(['/attendance/time-tracking'], {
      queryParams: { view: 'team', employeeId: member.employeeId }
    });
  }

  viewAll(): void {
    void this.router.navigate(['/attendance/time-tracking'], { queryParams: { view: 'team' } });
  }
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
