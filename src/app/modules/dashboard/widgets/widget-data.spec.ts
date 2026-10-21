import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { DashboardLayoutApiService } from '../data-access/dashboard-layout-api.service';
import { WidgetDataResponse } from '../models/dashboard-layout.model';
import { injectWidgetData, WidgetDataStore } from './widget-data';

const initial = { instanceId: 'i1', state: { status: 'not_loaded' as const, fetchedAt: null, error: null }, data: null };

function configure(widgetData: unknown): WidgetDataStore {
  TestBed.configureTestingModule({
    providers: [{ provide: DashboardLayoutApiService, useValue: { widgetData } }, WidgetDataStore]
  });
  const ctx = TestBed.inject(WidgetDataStore);
  ctx.bind(initial);
  return ctx;
}

describe('widget-data', () => {
  it('refresh_dedupes_concurrent_calls', () => {
    const subject = new Subject<WidgetDataResponse>();
    const widgetData = vi.fn().mockReturnValue(subject);
    const ctx = configure(widgetData);

    ctx.refresh();
    ctx.refresh();
    expect(widgetData).toHaveBeenCalledTimes(1);
    expect(widgetData).toHaveBeenCalledWith('i1');
    expect(ctx.state().status).toBe('loading');

    subject.next({ instanceId: 'i1', status: 'success', fetchedAt: 'now', payload: { a: 1 } });
    subject.complete();
    expect(ctx.state().status).toBe('success');
    expect(ctx.state().fetchedAt).toBe('now');
    expect(ctx.data()).toEqual({ a: 1 });

    widgetData.mockReturnValue(new Subject<WidgetDataResponse>());
    ctx.refresh();
    expect(widgetData).toHaveBeenCalledTimes(2);
  });

  it('refresh_response_with_error_status_keeps_a_non_null_error', () => {
    const subject = new Subject<WidgetDataResponse>();
    const ctx = configure(() => subject);
    ctx.refresh();
    subject.next({ instanceId: 'i1', status: 'error', fetchedAt: null, payload: null });
    expect(ctx.state().status).toBe('error');
    expect(ctx.state().error).not.toBeNull();
  });

  it('refresh_aborts_on_destroy', () => {
    const subject = new Subject<WidgetDataResponse>();
    const ctx = configure(() => subject);
    ctx.refresh();
    expect(subject.observed).toBe(true);
    TestBed.resetTestingModule();
    expect(subject.observed).toBe(false);
  });

  it('refresh_failure_sets_error_state_and_keeps_data', () => {
    const subject = new Subject<WidgetDataResponse>();
    const ctx = configure(() => subject);
    ctx.bind({ ...initial, state: { status: 'success', fetchedAt: null, error: null }, data: { keep: true } });
    ctx.refresh();
    subject.error(new Error('boom'));
    expect(ctx.state().status).toBe('error');
    expect(ctx.data()).toEqual({ keep: true });
  });

  it('injectWidgetData_returns_null_outside_frame', () => {
    @Component({ selector: 'app-probe', template: '' })
    class Probe {
      readonly ctx = injectWidgetData();
    }
    const fixture = TestBed.createComponent(Probe);
    expect(fixture.componentInstance.ctx).toBeNull();
  });
});
