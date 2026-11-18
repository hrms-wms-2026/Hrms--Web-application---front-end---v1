import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { environment } from '../../../../environments/environment';

export interface ActiveAnnouncement {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly severity: 'info' | 'warning' | 'critical';
}

const SEVERITY_ORDER: Record<ActiveAnnouncement['severity'], number> = { critical: 0, warning: 1, info: 2 };
const LONG_BODY_CHARS = 90;

/**
 * Published CROWNUS announcements (GET api/v1/announcements/active, any signed-in user), shown as solid strips
 * above the top navbar on every page (DEC-053): critical first, then warning, then info. Dismissing hides one for
 * the rest of this page session only; nothing is written to browser storage.
 */
@Component({
  selector: 'app-announcement-banner',
  standalone: true,
  templateUrl: './announcement-banner.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnnouncementBannerComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);

  private readonly announcements = signal<readonly ActiveAnnouncement[]>([]);
  private readonly dismissed = signal<ReadonlySet<string>>(new Set());
  private readonly expanded = signal<ReadonlySet<string>>(new Set());

  readonly visible = computed(() =>
    this.announcements()
      .filter((a) => !this.dismissed().has(a.id))
      .slice()
      .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
  );

  ngOnInit(): void {
    this.http
      .get<ActiveAnnouncement[]>(`${environment.apiUrl}/announcements/active`)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => this.announcements.set(items),
        // A banner is never worth an error message: show nothing if the feed fails.
        error: () => this.announcements.set([])
      });
  }

  dismiss(id: string): void {
    this.dismissed.update((current) => new Set([...current, id]));
  }

  /** A body that may not fit on the strip's single line gets a More/Less toggle. */
  isLong(announcement: ActiveAnnouncement): boolean {
    return announcement.body.length > LONG_BODY_CHARS || announcement.body.includes('\n');
  }

  isExpanded(id: string): boolean {
    return this.expanded().has(id);
  }

  toggle(id: string): void {
    this.expanded.update((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  toneClass(severity: ActiveAnnouncement['severity']): string {
    switch (severity) {
      case 'critical':
        return 'bg-[var(--color-notice-critical-bg)] text-[var(--color-notice-on-dark)]';
      case 'warning':
        return 'bg-[var(--color-notice-warning-bg)] text-[var(--color-notice-on-warning)]';
      default:
        return 'bg-[var(--color-notice-info-bg)] text-[var(--color-notice-on-dark)]';
    }
  }
}
