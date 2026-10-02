export type TrayPresencePhase =
  | 'checking'
  | 'needs-code'
  | 'code-loading'
  | 'waiting'
  | 'connected'
  | 'expired'
  | 'offline';

export type TrayCopyState = 'idle' | 'copied';

export interface TrayPresenceDevice {
  id: string;
  name: string;
  last_seen_at: string;
}

export interface TrayPresenceResponse {
  required: boolean;
  connected: boolean;
  grace_period_seconds: number;
  server_time: string;
  presence_valid_until: string | null;
  device: TrayPresenceDevice | null;
}

export interface TrayActivationCodeResponse {
  code: string;
  expires_in_seconds: number;
}

export interface TrayPresenceState {
  phase: TrayPresencePhase;
  required: boolean;
  checkedOnce: boolean;
  presenceValidUntil: string | null;
  serverTime: string | null;
  deviceName: string | null;
  code: string | null;
  codeSecondsRemaining: number | null;
  generationError: string | null;
  copyState: TrayCopyState;
}
