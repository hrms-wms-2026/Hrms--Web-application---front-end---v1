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

/**
 * Published CROWNUS announcements (GET api/v1/announcements/active, any signed-in user). Dismissing hides one for
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

  readonly visible = computed(() => this.announcements().filter((a) => !this.dismissed().has(a.id)));

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

  toneClass(severity: ActiveAnnouncement['severity']): string {
    switch (severity) {
      case 'critical':
        return 'border-[var(--color-danger)] bg-[var(--color-danger-subtle)] text-[var(--color-danger-text)]';
      case 'warning':
        return 'border-[var(--color-warning)] bg-[var(--color-warning-subtle)] text-[var(--color-warning-text)]';
      default:
        return 'border-[var(--color-info)] bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]';
    }
  }
}
