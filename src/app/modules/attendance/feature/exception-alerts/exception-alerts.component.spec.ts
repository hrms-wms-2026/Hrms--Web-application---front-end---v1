import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotificationService } from '../../../../core/services/notification.service';
import { ExceptionAlertsApiService } from '../../data-access/exception-alerts-api.service';
import { ExceptionAlertResponse, ExceptionAlertStatus } from '../../models/exception-alert.model';
import { ExceptionAlertsStore } from '../../state/exception-alerts.store';
import { ExceptionAlertsComponent } from './exception-alerts.component';

function alert(status: ExceptionAlertStatus, id = 'a1'): ExceptionAlertResponse {
  return {
    id, employeeId: 'e1', employeeName: 'Kali Raj', type: 'SustainedLowActivity', status,
    title: 'Sustained low activity', description: 'Activity score below 40 for 3 consecutive days.',
    detectedAt: '2026-09-27T23:30:00Z', acknowledgedAt: null, resolvedAt: null, escalatedAt: null, resolutionNote: null
  };
}

describe('ExceptionAlertsComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function setup(items: readonly ExceptionAlertResponse[], alertId: string | null = null) {
    const store = {
      items: signal(items), totalCount: signal(items.length), page: signal(1), pageSize: signal(20),
      statusFilter: signal(null), typeFilter: signal(null),
      loading: signal(false), error: signal<string | null>(null),
      actionLoading: signal(false), actionError: signal<string | null>(null),
      load: vi.fn(() => Promise.resolve()),
      setFilters: vi.fn(() => Promise.resolve()),
      act: vi.fn(() => Promise.resolve(true))
    };
    const notifications = { success: vi.fn(), error: vi.fn() };
    const api = {
      evidence: vi.fn((id: string) => of({
        exceptionId: id, type: 'SustainedLowActivity', workDate: '2026-09-27', timezone: 'UTC',
        attendance: null, identity: null, faceChecks: [], checkInScans: []
      }))
    };
    await TestBed.configureTestingModule({
      imports: [ExceptionAlertsComponent],
      providers: [
        provideRouter([]),
        { provide: ExceptionAlertsApiService, useValue: api },
        { provide: ExceptionAlertsStore, useValue: store },
        { provide: NotificationService, useValue: notifications },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(alertId ? { alertId } : {}) } } }
      ]
    }).compileComponents();
    const fixture = TestBed.createComponent(ExceptionAlertsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, store, notifications, api, el: fixture.nativeElement as HTMLElement };
  }

  it('opens and closes the evidence for one alert, fetching it again on every open', async () => {
    const { fixture, api, el } = await setup([alert('Open', 'a1'), alert('Open', 'a2')]);
    const toggle = () => (el.querySelector('[data-alert-id="a2"] [data-testid="evidence-toggle"]') as HTMLButtonElement);

    expect(el.querySelector('app-exception-evidence-panel')).toBeNull();

    toggle().click();
    fixture.detectChanges();
    expect(el.querySelectorAll('app-exception-evidence-panel')).toHaveLength(1);
    expect(toggle().textContent?.trim()).toBe('Hide evidence');
    expect(api.evidence).toHaveBeenCalledWith('a2');

    toggle().click();
    fixture.detectChanges();
    expect(el.querySelector('app-exception-evidence-panel')).toBeNull();

    toggle().click();
    fixture.detectChanges();
    expect(api.evidence).toHaveBeenCalledTimes(2);
  });

  it('opens the evidence of the alert a notification linked to', async () => {
    const { el, api } = await setup([alert('Open', 'a1'), alert('Open', 'a2')], 'a2');

    expect(el.querySelector('[data-alert-id="a2"] app-exception-evidence-panel')).not.toBeNull();
    expect(api.evidence).toHaveBeenCalledWith('a2');
  });

  const buttonLabels = (el: HTMLElement) =>
    Array.from(el.querySelectorAll('.alert-item__actions app-button button')).map((b) => b.textContent?.trim());

  it('loads alerts and shows the employee, type and description', async () => {
    const { store, el } = await setup([alert('Open')]);

    expect(store.load).toHaveBeenCalledTimes(1);
    expect(el.textContent).toContain('Kali Raj');
    expect(el.textContent).toContain('Sustained low activity');
    expect(el.textContent).toContain('Activity score below 40');
  });

  it('offers acknowledge, escalate and resolve on an open alert', async () => {
    const { el } = await setup([alert('Open')]);

    expect(buttonLabels(el)).toEqual(['Acknowledge', 'Escalate to HR', 'Resolve']);
  });

  it('offers only resolve on an escalated alert, and nothing on a resolved one', async () => {
    const escalated = await setup([alert('Escalated')]);
    expect(buttonLabels(escalated.el)).toEqual(['Resolve']);
    TestBed.resetTestingModule();

    const resolved = await setup([alert('Resolved')]);
    expect(buttonLabels(resolved.el)).toEqual([]);
  });

  it('acknowledges straight away and confirms with a toast', async () => {
    const { component, store, notifications } = await setup([alert('Open')]);

    await component.acknowledge(alert('Open'));

    expect(store.act).toHaveBeenCalledWith('a1', 'acknowledge', null);
    expect(notifications.success).toHaveBeenCalledWith('Alert acknowledged.');
  });

  it('escalates through the dialog with the typed note', async () => {
    const { component, store, notifications } = await setup([alert('Acknowledged')]);

    component.openAction(alert('Acknowledged'), 'escalate');
    component.note.set('Third time this month');
    await component.confirmAction();

    expect(store.act).toHaveBeenCalledWith('a1', 'escalate', 'Third time this month');
    expect(notifications.success).toHaveBeenCalledWith('Alert escalated to HR.');
    expect(component.selected()).toBeNull();
  });

  it('keeps the dialog open and shows the error when the action fails', async () => {
    const { component, store, notifications } = await setup([alert('Open')]);
    store.act.mockResolvedValue(false);
    store.actionError.set('Exception is already resolved.');

    component.openAction(alert('Open'), 'resolve');
    await component.confirmAction();

    expect(notifications.error).toHaveBeenCalledWith('Exception is already resolved.');
    expect(component.selected()).not.toBeNull();
  });

  it('highlights the alert opened from a notification link', async () => {
    const { el } = await setup([alert('Open', 'a1'), alert('Open', 'a2')], 'a2');

    expect(el.querySelector('[data-alert-id="a2"]')!.classList).toContain('alert-item--highlighted');
    expect(el.querySelector('[data-alert-id="a1"]')!.classList).not.toContain('alert-item--highlighted');
  });

  it('shows the empty state', async () => {
    const { el } = await setup([]);

    expect(el.textContent).toContain('No alerts match these filters');
  });
});
