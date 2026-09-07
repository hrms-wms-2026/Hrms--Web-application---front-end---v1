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

@Component({
  selector: 'app-approvals-list',
  standalone: true,
  imports: [DatePipe, BreadcrumbHeaderComponent, ButtonComponent, ErrorStateComponent, LoaderComponent],
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
      <div class="mt-6 overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <table class="w-full text-left text-sm">
          <thead class="bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]">
            <tr>
              <th class="px-4 py-3 font-medium">Employee</th>
              <th class="px-4 py-3 font-medium">Position</th>
              <th class="px-4 py-3 font-medium">Reason</th>
              <th class="px-4 py-3 font-medium">Requested by</th>
              <th class="px-4 py-3 font-medium">Requested at</th>
              <th class="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (request of requests(); track request.id) {
              <tr class="border-t border-[var(--color-border)]">
                <td class="px-4 py-3">{{ displayName(request) }}</td>
                <td class="px-4 py-3">{{ request.targetPositionName }}</td>
                <td class="px-4 py-3">{{ request.changeReason || '—' }}</td>
                <td class="px-4 py-3">{{ request.requestedByName }}</td>
                <td class="px-4 py-3">{{ request.requestedAt | date: 'medium' }}</td>
                <td class="px-4 py-3">
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
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ApprovalsListComponent {
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
