/** Directions match backend ONEVO.Domain.Features.Calendar.Entities.CalendarSyncDirections. */
export type CalendarSyncDirection = 'pull_only' | 'push_only' | 'two_way' | 'disabled';

/** Statuses match backend ONEVO.Domain.Features.Calendar.Entities.ExternalCalendarConnectionStatuses. */
export type CalendarConnectionStatus = 'active' | 'reauth_required' | 'paused' | 'revoked' | 'failed';

/**
 * Provider slug used ONLY for POST /calendar/connections/{provider}/connect
 * (backend ONEVO.Application StartCalendarConnectionCommandHandler.SupportedProviders).
 * Distinct from CalendarConnectionProvider below - the connect route and the stored/returned
 * connection use two different vocabularies on the backend.
 */
export type CalendarOAuthProviderSlug = 'google' | 'microsoft';

/** Provider value returned on a CalendarConnection (backend CalendarExternalSources). */
export type CalendarConnectionProvider = 'google_calendar' | 'outlook_calendar';

export interface CalendarConnection {
  id: string;
  provider: CalendarConnectionProvider;
  externalAccountEmail: string;
  externalCalendarName: string | null;
  syncDirection: CalendarSyncDirection;
  status: CalendarConnectionStatus;
  lastSyncedAt: string | null;
  lastError: string | null;
}

export interface CalendarConnectionsResponse {
  connections: CalendarConnection[];
}

export interface StartCalendarConnectionResponse {
  authorizeUrl: string;
}

export interface UpdateCalendarConnectionRequest {
  syncDirection: CalendarSyncDirection;
}
