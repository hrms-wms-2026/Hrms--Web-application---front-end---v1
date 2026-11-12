import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { BreadcrumbHeaderComponent } from '../../../../shared/ui/breadcrumb-header/breadcrumb-header.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { NotificationService } from '../../../../core/services/notification.service';
import { SupportTicketsApiService } from '../../data-access/support-tickets-api.service';
import {
  SUPPORT_ATTACHMENT_ACCEPT,
  SUPPORT_ATTACHMENT_MAX_BYTES,
  SUPPORT_PRIORITY_LABELS,
  SUPPORT_STATUS_LABELS,
  SUPPORT_TEXT_MAX,
  SupportTicketAttachment,
  SupportTicketDetail,
  formatFileSize
} from '../../models/support-ticket.model';

/**
 * Settings → Support → one ticket. Shows the conversation with CROWNUS support, takes replies and files. A reply
 * on a resolved ticket reopens it; a closed ticket is read-only.
 */
@Component({
  selector: 'app-support-ticket-detail',
  standalone: true,
  imports: [BreadcrumbHeaderComponent, ButtonComponent, CardComponent, DatePipe, ErrorStateComponent],
  templateUrl: './support-ticket-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SupportTicketDetailComponent implements OnInit {
  private readonly api = inject(SupportTicketsApiService);
  private readonly notifications = inject(NotificationService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  /** Route parameter; falls back to the snapshot when component input binding is off. */
  readonly id = input<string>('');

  protected readonly statusLabels = SUPPORT_STATUS_LABELS;
  protected readonly priorityLabels = SUPPORT_PRIORITY_LABELS;
  protected readonly accept = SUPPORT_ATTACHMENT_ACCEPT;
  protected readonly textMax = SUPPORT_TEXT_MAX;
  protected readonly fileSize = formatFileSize;

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly detail = signal<SupportTicketDetail | null>(null);
  readonly reply = signal('');
  readonly sending = signal(false);
  readonly uploading = signal(false);
  readonly downloadingId = signal<string | null>(null);

  readonly title = computed(() => {
    const current = this.detail();
    return current ? current.ticket.subject : 'Ticket';
  });
  readonly isClosed = computed(() => {
    const current = this.detail();
    return current !== null && current.ticket.status === 'closed';
  });
  readonly canSend = computed(() => {
    const value = this.reply().trim();
    return value.length > 0 && value.length <= SUPPORT_TEXT_MAX && !this.sending();
  });

  private ticketId = '';

  ngOnInit(): void {
    this.ticketId = this.id() || this.route.snapshot.paramMap.get('id') || '';
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .get(this.ticketId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detail) => {
          this.detail.set(detail);
          this.loading.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.error.set(error.status === 404 ? 'This ticket does not exist.' : 'The ticket could not be loaded.');
          this.loading.set(false);
        }
      });
  }

  sendReply(): void {
    if (!this.canSend()) {
      return;
    }

    this.sending.set(true);
    this.api
      .addComment(this.ticketId, this.reply().trim())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.sending.set(false);
          this.reply.set('');
          // Reload: a reply on a resolved ticket reopens it, so the status may have changed too.
          this.load();
        },
        error: (error: HttpErrorResponse) => {
          this.sending.set(false);
          this.notifications.error(error.error?.detail ?? 'Your reply could not be sent.');
        }
      });
  }

  onFileSelected(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    const file = inputElement.files?.[0];
    inputElement.value = '';
    if (!file) {
      return;
    }
    if (file.size > SUPPORT_ATTACHMENT_MAX_BYTES) {
      this.notifications.error('Files must be 25 MB or smaller.');
      return;
    }

    this.uploading.set(true);
    this.api
      .uploadAttachment(this.ticketId, file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (attachment) => {
          this.uploading.set(false);
          this.notifications.success('File attached.');
          this.detail.update((current) =>
            current ? { ...current, attachments: [...current.attachments, attachment] } : current
          );
        },
        error: (error: HttpErrorResponse) => {
          this.uploading.set(false);
          this.notifications.error(error.error?.detail ?? 'The file could not be attached.');
        }
      });
  }

  download(attachment: SupportTicketAttachment): void {
    this.downloadingId.set(attachment.id);
    this.api
      .getDownloadUrl(this.ticketId, attachment.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (url) => {
          this.downloadingId.set(null);
          window.open(url, '_blank', 'noopener');
        },
        error: () => {
          this.downloadingId.set(null);
          this.notifications.error('The file could not be downloaded.');
        }
      });
  }
}
