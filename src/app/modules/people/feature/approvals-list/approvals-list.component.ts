import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSafeErrorMessage } from '../../../../core/services/error-handler.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { BreadcrumbHeaderComponent } from '../../../../shared/ui/breadcrumb-header/breadcrumb-header.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { PeopleApiService } from '../../data-access/people-api.service';
import { PendingAccessGrantRequestResponse } from '../../models/access-grant-request.model';
import { DataTableCellDirective, DataTableColumn, DataTableComponent } from '../../../../shared/ui/data-table/data-table.component';

@Component({
  selector: 'app-approvals-list',
  standalone: true,
  imports: [DatePipe, DataTableComponent, DataTableCellDirective, BreadcrumbHeaderComponent, ButtonComponent, ErrorStateComponent, LoaderComponent],
  template: `
    <header class="al-page-header">
      <div class="al-header-row">
        <app-breadcrumb-header parentLabel="People" currentLabel="Approvals" icon="people" parentUrl="/people/employees" />
      </div>
    </header>

    @if (loading()) {
      <app-loader label="Loading approvals…" />
    } @else if (error(); as errorMessage) {
      <app-error-state [message]="errorMessage" [retryable]="true" (retry)="load()" />
    } @else if (requests().length === 0) {
      <p class="mt-6 text-sm text-[var(--color-text-secondary)]">No pending approvals.</p>
    } @else {
      <app-data-table class="mt-6 block" [columns]="columns" [rows]="requests()" [trackBy]="trackById" caption="Pending position change approvals">
        <ng-template appDataTableCell="employee" let-request>{{ displayName(request) }}</ng-template>
        <ng-template appDataTableCell="position" let-request>{{ request.targetPositionName }}</ng-template>
        <ng-template appDataTableCell="reason" let-request>{{ request.changeReason || '—' }}</ng-template>
        <ng-template appDataTableCell="requestedBy" let-request>{{ request.requestedByName }}</ng-template>
        <ng-template appDataTableCell="requestedAt" let-request>{{ request.requestedAt | date: 'medium' }}</ng-template>
        <ng-template appDataTableCell="actions" let-request>
          <div class="flex flex-col gap-2">
            <div class="flex gap-2">
              <app-button
                [loading]="actingId() === request.id"
                [disabled]="actingId() === request.id"
                (pressed)="approve(request.id)"
              >
                Approve
              </app-button>
              <app-button
                variant="secondary"
                [disabled]="actingId() === request.id"
                (pressed)="rejectingId.set(request.id)"
              >
                Reject
              </app-button>
            </div>
            @if (rejectingId() === request.id) {
              <div class="flex flex-col gap-2">
                <textarea
                  class="rounded-md border border-[var(--color-border)] p-2 text-sm"
                  rows="2"
                  placeholder="Decision note"
                  [value]="rejectNote()"
                  (input)="rejectNote.set($any($event.target).value)"
                ></textarea>
                <app-button
                  variant="secondary"
                  [loading]="actingId() === request.id"
                  [disabled]="actingId() === request.id"
                  (pressed)="reject(request.id)"
                >
                  Confirm reject
                </app-button>
              </div>
            }
          </div>
        </ng-template>
      </app-data-table>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ApprovalsListComponent {
  protected readonly columns: readonly DataTableColumn[] = [
    { key: 'employee', label: 'Employee' },
    { key: 'position', label: 'Position' },
    { key: 'reason', label: 'Reason', wrap: true },
    { key: 'requestedBy', label: 'Requested by' },
    { key: 'requestedAt', label: 'Requested at' },
    { key: 'actions', label: 'Actions', interactive: true, shrink: true }
  ];
  protected readonly trackById = (request: { id: string }): string => request.id;

  private readonly api = inject(PeopleApiService);
  private readonly notifications = inject(NotificationService);

  readonly requests = signal<readonly PendingAccessGrantRequestResponse[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly actingId = signal<string | null>(null);
  readonly rejectingId = signal<string | null>(null);
  readonly rejectNote = signal('');

  constructor() {
    this.load();
  }

  displayName(request: PendingAccessGrantRequestResponse): string {
    return request.employeeName ?? request.invitedFullName ?? 'New hire';
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.listPendingApprovals().subscribe({
      next: (items) => {
        this.requests.set(items);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(toSafeErrorMessage(err, 'Could not load pending approvals.'));
      }
    });
  }

  approve(id: string): void {
    this.actingId.set(id);
    this.api.approveAccessGrantRequest(id).subscribe({
      next: () => {
        this.actingId.set(null);
        this.notifications.success('Request approved.');
        this.load();
      },
      error: (err) => {
        this.actingId.set(null);
        this.notifications.error(toSafeErrorMessage(err, 'Could not approve this request.'));
      }
    });
  }

  reject(id: string): void {
    this.actingId.set(id);
    this.api.rejectAccessGrantRequest(id, { decisionNote: this.rejectNote() }).subscribe({
      next: () => {
        this.actingId.set(null);
        this.rejectingId.set(null);
        this.rejectNote.set('');
        this.notifications.success('Request rejected.');
        this.load();
      },
      error: (err) => {
        this.actingId.set(null);
        this.notifications.error(toSafeErrorMessage(err, 'Could not reject this request.'));
      }
    });
  }
}
