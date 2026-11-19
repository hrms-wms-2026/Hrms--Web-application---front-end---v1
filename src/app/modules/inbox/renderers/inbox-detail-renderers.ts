import { Injectable, InjectionToken, Type, inject } from '@angular/core';
import {
  AttendanceAlertRendererComponent,
  AttendanceCorrectionRendererComponent,
  DeviceChangeRendererComponent,
  LocationChangeRendererComponent,
  WorkModeChangeRendererComponent
} from './attendance-renderers';
import { ExceptionEvidenceRendererComponent } from './exception-evidence-renderer.component';
import { MeetingExceptionRendererComponent } from './meeting-exception-renderer.component';

/**
 * Detail renderers, keyed by the kind descriptor's `detailRenderer`. A renderer is a standalone component with
 * two inputs: `extra` (the parsed `detail.extraJson`, or null) and `detail` (the whole InboxItemDetailDto). Sources
 * add theirs to this map from `modules/inbox/renderers/*` (FL/FA/FX/FC). A key with no entry falls back to the
 * default explanation + change-set view.
 */
export const INBOX_DETAIL_RENDERERS = new InjectionToken<Record<string, Type<unknown>>>('INBOX_DETAIL_RENDERERS', {
  providedIn: 'root',
  factory: () => DEFAULT_INBOX_DETAIL_RENDERERS
});

export const DEFAULT_INBOX_DETAIL_RENDERERS: Record<string, Type<unknown>> = {
  'attendance-correction': AttendanceCorrectionRendererComponent,
  'work-mode-change': WorkModeChangeRendererComponent,
  'location-change': LocationChangeRendererComponent,
  'device-change': DeviceChangeRendererComponent,
  'attendance-alert': AttendanceAlertRendererComponent,
  'exception-evidence': ExceptionEvidenceRendererComponent,
  'meeting-exception-evidence': MeetingExceptionRendererComponent
};

@Injectable({ providedIn: 'root' })
export class InboxDetailRendererRegistry {
  private readonly renderers = inject(INBOX_DETAIL_RENDERERS);

  resolve(key: string | null | undefined): Type<unknown> | null {
    return key ? this.renderers[key] ?? null : null;
  }
}

/** The renderer payload; malformed JSON reads as null (the renderer shows what it can). */
export function parseExtra(json: string | null | undefined): Record<string, unknown> | null {
  if (!json) return null;
  try {
    const value = JSON.parse(json);
    return value && typeof value === 'object' ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}
