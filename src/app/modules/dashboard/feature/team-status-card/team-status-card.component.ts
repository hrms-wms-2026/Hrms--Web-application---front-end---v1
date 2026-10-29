import { NgClass, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { PopoutHeaderActionsComponent } from '../../../../shared/ui/popout-header-actions/popout-header-actions.component';
import { PopoutPanelComponent } from '../../../../shared/ui/popout-panel/popout-panel.component';
import { WidgetCardComponent, WidgetState } from '../../../../shared/ui/widget-card/widget-card.component';
import { buildFileUrl } from '../../../../shared/data-access/file-api.service';
import { MyTeamTodayStore } from '../../state/my-team-today.store';
import { injectWidgetDataFeed } from '../../widgets/widget-data-feed';
import { TeamTodayMember, TeamTodayResponse } from '../../models/my-team-today.model';
import { TeamStatusFilter, TeamStatusGroup, partitionTeamMembers } from '../../utils/team-status-groups.util';
import { injectHostSize, isCompactSize } from '../../utils/host-size.util';

const REFRESH_INTERVAL_MS = 60_000;
/** Rows shown per exception group before "+N more" - keeps a 25-absent day scannable. */
const GROUP_PREVIEW_LIMIT = 5;

const OTHERS_STATUS_LABEL: Record<string, string> = {
  working: 'working',
  on_break: 'on break',
  clocked_out: 'clocked out',
  on_leave: 'on leave',
  not_scheduled: 'not scheduled'
};

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
  late: 'team-status-dot--late',
  on_leave: 'team-status-dot--on-leave',
  not_started: 'team-status-dot--not-started'
};

/** Below this width or height (between 3 and 4 grid columns or rows; the full view needs 4 rows) the card shows only the
 * head-count, the strip and the exception counts. */
const MINI_MIN_WIDTH_PX = 360;
const MINI_MIN_HEIGHT_PX = 370;

/** People previewed on the compact card before "View team" opens the full list. */
const CARD_PREVIEW_LIMIT = 3;

export interface TeamStripSegment {
  key: 'present' | 'absent' | 'on_leave' | 'not_started';
  label: string;
  count: number;
}

/** Card + pop-out in the Employee Detail style (widget-card / popout-panel / popout-header-actions):
 * the card answers "who is in today" in four numbers and the first few people to follow up on; the
 * pop-out holds the filterable, exceptions-first list of everyone. */
@Component({
  selector: 'app-team-status-card',
  standalone: true,
  imports: [
    NgClass,
    NgTemplateOutlet,
    AvatarComponent,
    WidgetCardComponent,
    PopoutPanelComponent,
    PopoutHeaderActionsComponent
  ],
  templateUrl: './team-status-card.component.html',
  styleUrl: './team-status-card.component.css',
  host: { class: 'block h-full' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TeamStatusCardComponent implements OnInit {
  protected readonly store = inject(MyTeamTodayStore);
  /** Inside a dashboard frame the first payload comes from the bootstrap and reloads go through the
   * widget context; outside one (or when that data isn't available) the store fetches as before. */
  private readonly feed = injectWidgetDataFeed<TeamTodayResponse>({
    apply: (data) => this.store.seed(data),
    fetch: () => void this.store.load(),
    refreshing: () => this.store.markLoading()
  });
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private pollId: ReturnType<typeof setInterval> | null = null;
  private visibilityHandler = (): void => this.onVisibilityChange();

  protected readonly showAll = signal(false);
  private readonly size = injectHostSize();
  /** A 2-row or narrow card: the mini view (the pop-out still opens the full list). */
  protected readonly compact = computed(() => isCompactSize(this.size(), MINI_MIN_WIDTH_PX, MINI_MIN_HEIGHT_PX));

  /** Polls set `loading` every minute; only a first load (no data yet) shows the skeleton. */
  protected readonly widgetState = computed<WidgetState>(() => {
    const data = this.store.data();
    if (!data) return this.store.error() ? 'error' : 'loading';
    return data.totalMembers === 0 ? 'empty' : 'ready';
  });
  protected readonly refreshing = computed(() => this.store.loading() && !!this.store.data());

  protected readonly presentCount = computed(() => {
    const s = this.store.data()?.summary;
    return s ? s.working + s.onBreak + s.clockedOut : 0;
  });
  protected readonly expectedCount = computed(() => {
    const s = this.store.data()?.summary;
    return s ? Math.max(0, s.total - s.onLeave - s.notScheduled) : 0;
  });

  /** One bar for the whole team, sized by head-count (late people are inside "present"). */
  protected readonly stripSegments = computed<TeamStripSegment[]>(() => {
    const s = this.store.data()?.summary;
    if (!s) return [];
    const segments: TeamStripSegment[] = [
      { key: 'present', label: 'Present', count: s.working + s.onBreak + s.clockedOut },
      { key: 'absent', label: 'Absent', count: s.absent },
      { key: 'on_leave', label: 'On leave', count: s.onLeave },
      { key: 'not_started', label: 'Not started', count: s.notStarted }
    ];
    return segments.filter((segment) => segment.count > 0);
  });

  /** The first few people needing follow-up, in the backend's attention order. */
  protected readonly previewMembers = computed(() =>
    partitionTeamMembers(this.store.data()?.members ?? [], null)
      .exceptionGroups.flatMap((group) => group.members)
      .slice(0, CARD_PREVIEW_LIMIT)
  );
  protected readonly followUpCount = computed(() =>
    partitionTeamMembers(this.store.data()?.members ?? [], null)
      .exceptionGroups.reduce((sum, group) => sum + group.members.length, 0)
  );

  protected readonly filter = signal<TeamStatusFilter | null>(null);
  protected readonly othersExpanded = signal(false);
  private readonly expandedGroups = signal<ReadonlySet<string>>(new Set());

  protected readonly summaryStats = computed<{ key: TeamStatusFilter; label: string; count: number }[]>(() => {
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

  protected readonly partition = computed(() => {
    const filter = this.filter();
    const label = this.summaryStats().find((stat) => stat.key === filter)?.label ?? '';
    return partitionTeamMembers(this.store.data()?.members ?? [], filter, label);
  });

  /** With no exceptions there is nothing to fold - show everyone. */
  protected readonly showOthers = computed(
    () => this.othersExpanded() || this.partition().exceptionGroups.length === 0
  );

  protected readonly othersCaption = computed(() => {
    const counts = new Map<string, number>();
    for (const member of this.partition().others) {
      const label = OTHERS_STATUS_LABEL[member.status] ?? member.statusLabel.toLowerCase();
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    if (counts.size === 1) return [...counts.keys()][0];
    return `others · ${[...counts.entries()].map(([label, count]) => `${count} ${label}`).join(' · ')}`;
  });

  toggleFilter(key: TeamStatusFilter, event?: Event): void {
    event?.stopPropagation();
    this.filter.update((current) => (current === key ? null : key));
  }

  visibleGroupMembers(group: TeamStatusGroup): TeamTodayMember[] {
    if (this.filter() || this.expandedGroups().has(group.key)) return group.members;
    return group.members.slice(0, GROUP_PREVIEW_LIMIT);
  }

  hiddenGroupCount(group: TeamStatusGroup): number {
    return group.members.length - this.visibleGroupMembers(group).length;
  }

  expandGroup(key: string, event?: Event): void {
    event?.stopPropagation();
    this.expandedGroups.update((keys) => new Set([...keys, key]));
  }

  /** Time context first; otherwise the backend's attention reason when it adds something the pill
   * doesn't already say (replaces the old duplicate red dot). */
  rowCaption(member: TeamTodayMember): string | null {
    const timing = this.sinceOrEndsLabel(member);
    if (timing) return timing;
    if (member.attentionLabel && member.attentionLabel.toLowerCase() !== member.statusLabel.toLowerCase()) {
      return member.attentionLabel;
    }
    return null;
  }

  ngOnInit(): void {
    this.feed.start();
    document.addEventListener('visibilitychange', this.visibilityHandler);
    if (document.visibilityState === 'visible') this.startPolling();
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.stopPolling();
    });
  }

  private onVisibilityChange(): void {
    if (document.visibilityState === 'visible') {
      this.feed.reload();
      this.startPolling();
    } else {
      this.stopPolling();
    }
  }

  private startPolling(): void {
    if (this.pollId) return;
    this.pollId = setInterval(() => this.feed.reload(), REFRESH_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (this.pollId) {
      clearInterval(this.pollId);
      this.pollId = null;
    }
  }

  retry(): void {
    this.feed.reload();
  }

  /** A click anywhere on the card pops out the full team list. */
  expand(): void {
    if (this.showAll() || !this.store.data()) return;
    this.showAll.set(true);
  }

  collapse(): void {
    this.showAll.set(false);
  }

  onToggleClick(event: Event): void {
    event.stopPropagation();
    if (this.showAll()) this.collapse();
    else this.expand();
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

  openMember(member: TeamTodayMember, event?: Event): void {
    event?.stopPropagation();
    void this.router.navigate(['/attendance/time-tracking'], {
      queryParams: { view: 'team', employeeId: member.employeeId }
    });
  }

  viewAll(event?: Event): void {
    event?.stopPropagation();
    void this.router.navigate(['/attendance/time-tracking'], { queryParams: { view: 'team' } });
  }
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
