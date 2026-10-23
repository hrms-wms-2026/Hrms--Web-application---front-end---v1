import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NotificationService } from '../../../../core/services/notification.service';
import { BreadcrumbHeaderComponent } from '../../../../shared/ui/breadcrumb-header/breadcrumb-header.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { ConfirmModalComponent } from '../../../../shared/ui/confirm-modal/confirm-modal.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import {
  CalendarConnection,
  CalendarConnectionProvider,
  CalendarConnectionStatus,
  CalendarOAuthProviderSlug,
  CalendarSyncDirection
} from '../../models/calendar-connection.model';
import { CalendarConnectionsStore } from '../../state/calendar-connections.store';

const SYNC_DIRECTION_OPTIONS: readonly SelectOption[] = [
  { value: 'two_way', label: 'Two-way sync' },
  { value: 'pull_only', label: 'Pull only (external → ONEVO)' },
  { value: 'push_only', label: 'Push only (ONEVO → external)' },
  { value: 'disabled', label: 'Paused' }
];

const STATUS_LABELS: Record<CalendarConnectionStatus, string> = {
  active: 'Active',
  reauth_required: 'Needs reconnect',
  paused: 'Paused',
  revoked: 'Revoked',
  failed: 'Failed'
};

const STATUS_CLASSES: Record<CalendarConnectionStatus, string> = {
  active: 'bg-[color-mix(in_srgb,var(--color-success-text)_15%,transparent)] text-[var(--color-success-text)]',
  reauth_required: 'bg-[color-mix(in_srgb,var(--color-warning-text)_15%,transparent)] text-[var(--color-warning-text)]',
  paused: 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]',
  revoked: 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]',
  failed: 'bg-[color-mix(in_srgb,var(--color-danger-text)_15%,transparent)] text-[var(--color-danger-text)]'
};

const PROVIDER_LABELS: Record<CalendarConnectionProvider, string> = {
  google_calendar: 'Google Calendar',
  outlook_calendar: 'Outlook Calendar',
  zoom: 'Zoom'
};

@Component({
  selector: 'app-calendar-connections',
  standalone: true,
  imports: [DatePipe, BreadcrumbHeaderComponent, ButtonComponent, CardComponent, ConfirmModalComponent, EmptyStateComponent, LoaderComponent, SelectComponent],
  template: `
    <header class="app-page-header">
      <app-breadcrumb-header parentLabel="Settings" currentLabel="Calendar Sync" icon="settings" />
    </header>

    <div class="mb-6 flex flex-wrap gap-3">
      <div class="w-56" data-testid="connect-google">
        <app-button variant="secondary" [loading]="store.connectingProvider() === 'google'" [disabled]="isGoogleConnected()" (pressed)="connect('google')">
          {{ isGoogleConnected() ? 'Google Calendar connected' : 'Connect Google Calendar' }}
        </app-button>
      </div>
      <div class="w-56" data-testid="connect-microsoft">
        <app-button variant="secondary" [loading]="store.connectingProvider() === 'microsoft'" [disabled]="isOutlookConnected()" (pressed)="connect('microsoft')">
          {{ isOutlookConnected() ? 'Outlook connected' : 'Connect Outlook' }}
        </app-button>
      </div>
      <div class="w-56" data-testid="connect-zoom">
        <app-button variant="secondary" [loading]="store.connectingProvider() === 'zoom'" [disabled]="isZoomConnected()" (pressed)="connect('zoom')">
          {{ isZoomConnected() ? 'Zoom connected' : 'Connect Zoom' }}
        </app-button>
      </div>
    </div>

    @if (store.error()) {
      <p class="mb-4 text-sm text-[var(--color-danger-text)]" role="alert">{{ store.error() }}</p>
    }

    @if (store.loading() && !store.loaded()) {
      <app-loader label="Loading calendar connections..." />
    } @else if (store.connections().length === 0) {
      <app-empty-state title="No calendars connected yet" description="Connect Google Calendar or Outlook above to start syncing events." />
    } @else {
      <div class="grid gap-4 sm:grid-cols-2">
        @for (connection of store.connections(); track connection.id) {
          <app-card>
            <div class="flex items-start justify-between gap-2">
              <div>
                <h3 class="font-semibold text-[var(--color-text-primary)]">{{ providerLabel(connection.provider) }}</h3>
                <p class="text-sm text-[var(--color-text-secondary)]">{{ connection.externalAccountEmail }}</p>
              </div>
              <span class="rounded-full px-2.5 py-1 text-xs font-medium" [class]="statusClass(connection.status)">
                {{ statusLabel(connection.status) }}
              </span>
            </div>

            @if (connection.lastSyncedAt) {
              <p class="mt-2 text-xs text-[var(--color-text-secondary)]">Last synced: {{ connection.lastSyncedAt | date: 'medium' }}</p>
            } @else {
              <p class="mt-2 text-xs text-[var(--color-text-secondary)]">Not synced yet</p>
            }
            @if (connection.lastError) {
              <p class="mt-1 text-xs text-[var(--color-danger-text)]">{{ connection.lastError }}</p>
            }

            <div class="mt-3">
              <app-select
                label="Sync direction"
                ariaLabel="Sync direction"
                [options]="syncDirectionOptions"
                [value]="connection.syncDirection"
                [disabled]="isActionLoading(connection.id)"
                (valueChange)="onSyncDirectionChange(connection, $event)"
              />
            </div>
            @if (store.actionErrorByConnectionId()[connection.id]) {
              <p class="mt-1 text-xs text-[var(--color-danger-text)]" role="alert">{{ store.actionErrorByConnectionId()[connection.id] }}</p>
            }

            <div class="mt-4 flex gap-2">
              <div class="w-28">
                <app-button variant="secondary" size="sm" [loading]="isActionLoading(connection.id)" (pressed)="onSyncNow(connection)">
                  Sync now
                </app-button>
              </div>
              <div class="w-28">
                <app-button variant="danger" size="sm" [disabled]="isActionLoading(connection.id)" (pressed)="askDisconnect(connection)">
                  Disconnect
                </app-button>
              </div>
            </div>
          </app-card>
        }
      </div>
    }

    <app-confirm-modal
      [open]="!!pendingDisconnect()"
      title="Disconnect calendar?"
      [message]="disconnectMessage()"
      confirmLabel="Disconnect"
      cancelLabel="Cancel"
      [loading]="!!pendingDisconnect() && isActionLoading(pendingDisconnect()!.id)"
      (confirmed)="confirmDisconnect()"
      (cancelled)="pendingDisconnect.set(null)"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalendarConnectionsComponent {
  private readonly notificationService = inject(NotificationService);

  readonly store = inject(CalendarConnectionsStore);
  readonly syncDirectionOptions = SYNC_DIRECTION_OPTIONS;

  readonly pendingDisconnect = signal<CalendarConnection | null>(null);

  readonly isGoogleConnected = computed(() =>
    this.store.connections().some((c) => c.provider === 'google_calendar')
  );
  readonly isOutlookConnected = computed(() =>
    this.store.connections().some((c) => c.provider === 'outlook_calendar')
  );
  readonly isZoomConnected = computed(() =>
    this.store.connections().some((c) => c.provider === 'zoom')
  );

  readonly disconnectMessage = computed(() => {
    const target = this.pendingDisconnect();
    if (!target) {
      return '';
    }
    return `This stops syncing ${this.providerLabel(target.provider)} (${target.externalAccountEmail}). You can reconnect it anytime.`;
  });

  constructor() {
    void this.store.load();
  }

  providerLabel(provider: CalendarConnectionProvider): string {
    return PROVIDER_LABELS[provider];
  }

  statusLabel(status: CalendarConnectionStatus): string {
    return STATUS_LABELS[status];
  }

  statusClass(status: CalendarConnectionStatus): string {
    return STATUS_CLASSES[status];
  }

  isActionLoading(connectionId: string): boolean {
    return this.store.actionLoadingByConnectionId()[connectionId] ?? false;
  }

  async connect(provider: CalendarOAuthProviderSlug): Promise<void> {
    await this.store.connect(provider);
  }

  async onSyncDirectionChange(connection: CalendarConnection, value: string): Promise<void> {
    const ok = await this.store.updateSyncDirection(connection.id, value as CalendarSyncDirection);
    if (ok) {
      this.notificationService.success('Sync direction updated.');
    }
  }

  async onSyncNow(connection: CalendarConnection): Promise<void> {
    const ok = await this.store.triggerSync(connection.id);
    if (ok) {
      this.notificationService.success('Sync complete.');
    }
  }

  askDisconnect(connection: CalendarConnection): void {
    this.pendingDisconnect.set(connection);
  }

  async confirmDisconnect(): Promise<void> {
    const target = this.pendingDisconnect();
    if (!target) {
      return;
    }
    const ok = await this.store.disconnect(target.id);
    if (ok) {
      this.notificationService.success('Calendar disconnected.');
      this.pendingDisconnect.set(null);
    }
  }
}
