import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { NotificationService } from '../../../../core/services/notification.service';
import { BreadcrumbHeaderComponent } from '../../../../shared/ui/breadcrumb-header/breadcrumb-header.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { ExceptionEvidencePanelComponent } from './exception-evidence-panel/exception-evidence-panel.component';
import {
  EXCEPTION_ALERT_STATUS_LABELS,
  EXCEPTION_ALERT_TYPE_LABELS,
  ExceptionAlertAction,
  ExceptionAlertResponse,
  ExceptionAlertStatus,
  ExceptionAlertType,
  canAcknowledge,
  canEscalate,
  canResolve
} from '../../models/exception-alert.model';
import { ExceptionAlertsStore } from '../../state/exception-alerts.store';

const ACTION_SUCCESS: Record<ExceptionAlertAction, string> = {
  acknowledge: 'Alert acknowledged.',
  resolve: 'Alert resolved.',
  escalate: 'Alert escalated to HR.'
};

/**
 * Flow 09 "Review attendance anomaly": the reporting manager (or HR) sees the alerts raised for the
 * employees they cover, then acknowledges, resolves or escalates each one to HR. The list is
 * scoped server-side; this page only renders it.
 */
@Component({
  selector: 'app-exception-alerts',
  standalone: true,
  imports: [FormsModule, BreadcrumbHeaderComponent, ButtonComponent, ModalComponent, ExceptionEvidencePanelComponent, SelectComponent],
  templateUrl: './exception-alerts.component.html',
  styleUrl: './exception-alerts.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExceptionAlertsComponent implements OnInit {
  readonly store = inject(ExceptionAlertsStore);
  private readonly route = inject(ActivatedRoute);
  private readonly notifications = inject(NotificationService);

  readonly statusOptions = Object.entries(EXCEPTION_ALERT_STATUS_LABELS) as [ExceptionAlertStatus, string][];
  readonly typeOptions = Object.entries(EXCEPTION_ALERT_TYPE_LABELS) as [ExceptionAlertType, string][];
  readonly statusSelectOptions: readonly SelectOption[] = [
    { value: '', label: 'All statuses' },
    ...this.statusOptions.map(([value, label]) => ({ value, label }))
  ];
  readonly typeSelectOptions: readonly SelectOption[] = [
    { value: '', label: 'All types' },
    ...this.typeOptions.map(([value, label]) => ({ value, label }))
  ];
  readonly canAcknowledge = canAcknowledge;
  readonly canResolve = canResolve;
  readonly canEscalate = canEscalate;

  readonly highlightedId = signal<string | null>(null);
  /** The alert whose evidence is open. Closing destroys the panel, so reopening refetches a fresh photo URL. */
  readonly evidenceOpenId = signal<string | null>(null);
  readonly selected = signal<ExceptionAlertResponse | null>(null);
  readonly pendingAction = signal<ExceptionAlertAction | null>(null);
  readonly note = signal('');

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.store.totalCount() / this.store.pageSize())));

  ngOnInit(): void {
    const alertId = this.route.snapshot.queryParamMap.get('alertId');
    this.highlightedId.set(alertId);
    // Opened from a notification: show that alert's evidence straight away.
    this.evidenceOpenId.set(alertId);
    void this.load();
  }

  toggleEvidence(alert: ExceptionAlertResponse): void {
    this.evidenceOpenId.update((open) => (open === alert.id ? null : alert.id));
  }

  async load(page?: number): Promise<void> {
    await this.store.load(page);
    const id = this.highlightedId();
    if (id && this.store.items().some((item) => item.id === id)) {
      setTimeout(() => {
        const target = Array.from(document.querySelectorAll<HTMLElement>('[data-alert-id]'))
          .find((element) => element.dataset['alertId'] === id);
        target?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
      }, 0);
    }
  }

  onStatusFilter(value: string): void {
    void this.store.setFilters((value || null) as ExceptionAlertStatus | null, this.store.typeFilter());
  }

  onTypeFilter(value: string): void {
    void this.store.setFilters(this.store.statusFilter(), (value || null) as ExceptionAlertType | null);
  }

  typeLabel(type: ExceptionAlertType): string {
    return EXCEPTION_ALERT_TYPE_LABELS[type] ?? type;
  }

  statusLabel(status: ExceptionAlertStatus): string {
    return EXCEPTION_ALERT_STATUS_LABELS[status] ?? status;
  }

  async acknowledge(alert: ExceptionAlertResponse): Promise<void> {
    if (!canAcknowledge(alert)) return;
    await this.run(alert.id, 'acknowledge', null);
  }

  /** Resolve and escalate take an optional note, so they open the confirm dialog first. */
  openAction(alert: ExceptionAlertResponse, action: 'resolve' | 'escalate'): void {
    this.selected.set(alert);
    this.pendingAction.set(action);
    this.note.set('');
  }

  closeAction(): void {
    if (this.store.actionLoading()) return;
    this.selected.set(null);
    this.pendingAction.set(null);
  }

  async confirmAction(): Promise<void> {
    const alert = this.selected();
    const action = this.pendingAction();
    if (!alert || !action) return;
    if (await this.run(alert.id, action, this.note())) {
      this.selected.set(null);
      this.pendingAction.set(null);
    }
  }

  private async run(id: string, action: ExceptionAlertAction, note: string | null): Promise<boolean> {
    const ok = await this.store.act(id, action, note);
    if (ok) {
      this.notifications.success(ACTION_SUCCESS[action]);
    } else {
      this.notifications.error(this.store.actionError() ?? 'Could not update this alert.');
    }
    return ok;
  }

  formatDateTime(value: string | null): string {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? '—'
      : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }
}
