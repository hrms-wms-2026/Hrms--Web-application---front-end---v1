/** Wire shapes of NotificationSettingsController (api/v1/settings/notifications). */

export type NotificationChannel = 'in_app' | 'email' | 'tray';

export const NOTIFICATION_CHANNELS: readonly NotificationChannel[] = ['in_app', 'email', 'tray'];

export const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  in_app: 'In-app',
  email: 'Email',
  tray: 'Tray'
};

export const MODULE_LABELS: Record<string, string> = {
  work_management: 'Work Management',
  leave: 'Leave',
  time_attendance: 'Time & Attendance',
  calendar: 'Calendar',
  conversations: 'Conversations',
  monitoring: 'Monitoring',
  support: 'Support'
};

export interface NotificationTemplateOption {
  readonly id: string;
  readonly name: string;
  readonly isProductDefault: boolean;
}

export interface NotificationSetting {
  readonly eventKey: string;
  readonly module: string;
  readonly displayName: string;
  readonly supportedChannels: readonly NotificationChannel[];
  readonly requiredChannels: readonly NotificationChannel[];
  readonly defaultChannels: readonly NotificationChannel[];
  readonly enabledChannels: readonly NotificationChannel[];
  /** Selected published template; null = the product default template. */
  readonly templateId: string | null;
  readonly recipientRule: string;
  readonly recipientRules: readonly string[];
  readonly templates: readonly NotificationTemplateOption[];
  readonly isOverridden: boolean;
  /** Revision of the saved override; null while the event uses defaults. */
  readonly revision: number | null;
  /** False while the event is still delivered by its built-in (legacy) path, which ignores these settings. */
  readonly configurable: boolean;
}

export interface UpdateNotificationSettingRequest {
  readonly enabledChannels: readonly NotificationChannel[];
  readonly templateId: string | null;
  readonly recipientRule: string;
  readonly revision: number | null;
}
