import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { BreadcrumbHeaderComponent } from '../../../../shared/ui/breadcrumb-header/breadcrumb-header.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { NotificationService } from '../../../../core/services/notification.service';
import { SupportTicketsApiService } from '../../data-access/support-tickets-api.service';
import {
  SUPPORT_PRIORITIES,
  SUPPORT_PRIORITY_LABELS,
  SUPPORT_STATUSES,
  SUPPORT_STATUS_LABELS,
  SUPPORT_SUBJECT_MAX,
  SUPPORT_TEXT_MAX,
  SupportTicket,
  SupportTicketPriority,
  SupportTicketStatus
} from '../../models/support-ticket.model';

const PAGE_SIZE = 20;

/**
 * Settings → Support. Lists this company's tickets with CROWNUS support and raises new ones. Replies and files
 * live on the ticket page.
 */
@Component({
  selector: 'app-support-tickets',
  standalone: true,
  imports: [
    BreadcrumbHeaderComponent,
    ButtonComponent,
    CardComponent,
    DatePipe,
    EmptyStateComponent,
    ErrorStateComponent,
    InputComponent,
    RouterLink,
    SelectComponent
  ],
  templateUrl: './support-tickets.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SupportTicketsComponent implements OnInit {
  private readonly api = inject(SupportTicketsApiService);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly statusLabels = SUPPORT_STATUS_LABELS;
  protected readonly priorityLabels = SUPPORT_PRIORITY_LABELS;
  protected readonly subjectMax = SUPPORT_SUBJECT_MAX;
  protected readonly textMax = SUPPORT_TEXT_MAX;

  protected readonly statusOptions: readonly SelectOption[] = [
    { value: '', label: 'All statuses' },
    ...SUPPORT_STATUSES.map((status) => ({ value: status, label: SUPPORT_STATUS_LABELS[status] }))
  ];
  protected readonly priorityOptions: readonly SelectOption[] = SUPPORT_PRIORITIES.map((priority) => ({
    value: priority,
    label: SUPPORT_PRIORITY_LABELS[priority]
  }));

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly tickets = signal<readonly SupportTicket[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly statusFilter = signal<SupportTicketStatus | ''>('');

  readonly showForm = signal(false);
  readonly saving = signal(false);
  readonly submitted = signal(false);
  readonly subject = signal('');
  readonly description = signal('');
  readonly priority = signal<SupportTicketPriority>('medium');
  readonly category = signal('');

  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / PAGE_SIZE)));
  readonly subjectError = computed(() => {
    if (!this.submitted()) return '';
    const value = this.subject().trim();
    if (!value) return 'Subject is required.';
    return value.length > SUPPORT_SUBJECT_MAX ? `Keep the subject under ${SUPPORT_SUBJECT_MAX} characters.` : '';
  });
  readonly descriptionError = computed(() => {
    if (!this.submitted()) return '';
    const value = this.description().trim();
    if (!value) return 'Describe the problem.';
    return value.length > SUPPORT_TEXT_MAX ? `Keep the description under ${SUPPORT_TEXT_MAX} characters.` : '';
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .list(this.statusFilter(), this.page(), PAGE_SIZE)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.tickets.set(page.items);
          this.total.set(page.total);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Support tickets could not be loaded.');
          this.loading.set(false);
        }
      });
  }

  onStatusFilter(value: string): void {
    this.statusFilter.set(value as SupportTicketStatus | '');
    this.page.set(1);
    this.load();
  }

  goToPage(page: number): void {
    this.page.set(page);
    this.load();
  }

  openForm(): void {
    this.showForm.set(true);
  }

  cancelForm(): void {
    this.showForm.set(false);
    this.resetForm();
  }

  submit(): void {
    this.submitted.set(true);
    if (this.subjectError() || this.descriptionError()) {
      return;
    }

    this.saving.set(true);
    this.api
      .create({
        subject: this.subject().trim(),
        description: this.description().trim(),
        priority: this.priority(),
        category: this.category().trim() || null
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (ticket) => {
          this.saving.set(false);
          this.notifications.success('Ticket sent to CROWNUS support.');
          this.resetForm();
          this.showForm.set(false);
          void this.router.navigate(['/settings/support', ticket.id]);
        },
        error: (error: HttpErrorResponse) => {
          this.saving.set(false);
          this.notifications.error(error.error?.detail ?? 'The ticket could not be sent.');
        }
      });
  }

  private resetForm(): void {
    this.submitted.set(false);
    this.subject.set('');
    this.description.set('');
    this.priority.set('medium');
    this.category.set('');
  }
}
