import { HttpErrorResponse } from '@angular/common/http';

export type DashboardKey = 'my-work' | 'my-team';
export type Breakpoint = 'desktop' | 'tablet' | 'mobile';

export interface GridRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WidgetSize {
  minW: number;
  minH: number;
  maxW: number;
  maxH: number;
}

export interface WidgetDataState {
  status: 'success' | 'error' | 'not_loaded' | 'client' | 'loading';
  fetchedAt: string | null;
  error: string | null;
}

export interface GridSpec {
  breakpoint: Breakpoint;
  columns: number;
  rowHeight: number;
  gap: number;
}

export interface BootstrapWidget {
  instanceId: string;
  widgetKey: string;
  title: string;
  layout: GridRect;
  size: WidgetSize;
  dataState: WidgetDataState;
  data: unknown;
}

export interface DashboardBootstrap {
  id: string;
  key: DashboardKey;
  title: string;
  layoutVersion: number;
  grid: GridSpec;
  widgets: BootstrapWidget[];
  hasAllowedGatedWidgets: boolean;
  capabilitiesUnavailable: boolean;
}

export interface DashboardSummary {
  id: string;
  key: DashboardKey;
  title: string;
  layoutVersion: number;
}

export interface AvailableWidget {
  key: string;
  title: string;
  description: string;
  size: WidgetSize;
  defaultW: number;
  defaultH: number;
  placed: boolean;
}

export interface LayoutItem extends GridRect {
  instanceId: string;
}

export interface AddWidgetResult {
  instanceId: string;
  layoutVersion: number;
}

export interface LayoutVersionResult {
  layoutVersion: number;
}

export interface WidgetDataResponse {
  instanceId: string;
  status: WidgetDataState['status'];
  fetchedAt: string | null;
  payload: unknown;
}

export interface LayoutProblem {
  status: number;
  code: string | null;
  codes: string[];
  currentVersion: number | null;
}

/** Reads the ProblemDetails `code`, `codes` and `currentVersion` the layout API attaches to 409/422 errors. */
export function readLayoutProblem(err: HttpErrorResponse): LayoutProblem {
  const body = err.error && typeof err.error === 'object' ? (err.error as Record<string, unknown>) : {};
  return {
    status: err.status,
    code: typeof body['code'] === 'string' ? body['code'] : null,
    codes: Array.isArray(body['codes']) ? (body['codes'] as unknown[]).filter((c): c is string => typeof c === 'string') : [],
    currentVersion: typeof body['currentVersion'] === 'number' ? body['currentVersion'] : null
  };
}
