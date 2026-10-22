import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  AddWidgetResult,
  AvailableWidget,
  Breakpoint,
  DashboardBootstrap,
  DashboardSummary,
  GridRect,
  LayoutItem,
  LayoutVersionResult,
  WidgetDataResponse
} from '../models/dashboard-layout.model';

@Injectable({ providedIn: 'root' })
export class DashboardLayoutApiService {
  private readonly http = inject(HttpClient);
  private readonly basePath = `${environment.apiUrl}/dashboards`;

  listMine(): Observable<DashboardSummary[]> {
    return this.http.get<DashboardSummary[]>(`${this.basePath}/me`);
  }

  bootstrap(id: string, breakpoint: Breakpoint): Observable<DashboardBootstrap> {
    return this.http.get<DashboardBootstrap>(`${this.basePath}/${id}/bootstrap`, {
      params: new HttpParams().set('breakpoint', breakpoint)
    });
  }

  available(id: string, breakpoint?: Breakpoint): Observable<AvailableWidget[]> {
    let params = new HttpParams();
    if (breakpoint) {
      params = params.set('breakpoint', breakpoint);
    }
    return this.http.get<AvailableWidget[]>(`${this.basePath}/${id}/widgets/available`, { params });
  }

  addWidget(id: string, widgetKey: string, expectedVersion: number, desktopRect?: GridRect): Observable<AddWidgetResult> {
    const body: { widgetKey: string; expectedVersion: number; desktopRect?: GridRect } = { widgetKey, expectedVersion };
    if (desktopRect) {
      body.desktopRect = desktopRect;
    }
    return this.http.post<AddWidgetResult>(`${this.basePath}/${id}/widgets`, body);
  }

  removeWidget(id: string, instanceId: string, expectedVersion: number): Observable<LayoutVersionResult> {
    return this.http.delete<LayoutVersionResult>(`${this.basePath}/${id}/widgets/${instanceId}`, {
      params: new HttpParams().set('expectedVersion', expectedVersion)
    });
  }

  saveLayout(id: string, breakpoint: Breakpoint, expectedVersion: number, widgets: LayoutItem[]): Observable<LayoutVersionResult> {
    return this.http.put<LayoutVersionResult>(`${this.basePath}/${id}/layouts/${breakpoint}`, { expectedVersion, widgets });
  }

  reset(id: string, expectedVersion: number): Observable<LayoutVersionResult> {
    return this.http.post<LayoutVersionResult>(`${this.basePath}/${id}/reset`, { expectedVersion });
  }

  widgetData(instanceId: string): Observable<WidgetDataResponse> {
    return this.http.get<WidgetDataResponse>(`${environment.apiUrl}/dashboard-widgets/${instanceId}/data`);
  }
}
