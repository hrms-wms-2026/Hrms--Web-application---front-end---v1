import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { NotificationSettingsStore } from './notification-settings.store';
import { NotificationSettingsApiService } from '../data-access/notification-settings-api.service';
import { NotificationSetting } from '../models/notification-setting.model';

const base: NotificationSetting = {
  eventKey: 'work_approval_requested', module: 'work_management', displayName: 'Work approval requested',
  supportedChannels: ['in_app', 'email', 'tray'], requiredChannels: [], defaultChannels: ['in_app'],
  enabledChannels: ['in_app'], templateId: null, recipientRule: 'default', recipientRules: ['default'],
  templates: [], isOverridden: false, revision: null, configurable: true
};
const request = { enabledChannels: ['email'] as const, templateId: null, recipientRule: 'default', revision: null };

function setup(api: Partial<NotificationSettingsApiService>) {
  TestBed.configureTestingModule({ providers: [{ provide: NotificationSettingsApiService, useValue: api }] });
  return TestBed.inject(NotificationSettingsStore);
}

describe('NotificationSettingsStore', () => {
  it('loads settings', async () => {
    const store = setup({ list: () => of([base]) });
    await store.load();
    expect(store.settings()).toEqual([base]);
    expect(store.loading()).toBe(false);
  });

  it('replaces the saved row and clears its errors', async () => {
    const saved = { ...base, enabledChannels: ['email'] as const, isOverridden: true, revision: 1 };
    const store = setup({ list: () => of([base]), update: () => of(saved) });
    await store.load();

    expect(await store.save(base.eventKey, request)).toBe(true);
    expect(store.settings()[0]).toEqual(saved);
    expect(store.savingKey()).toBeNull();
  });

  it('records a 409 as a conflict and other failures as a row error', async () => {
    const conflict = new HttpErrorResponse({ status: 409, error: { detail: 'stale' } });
    const store = setup({ list: () => of([base]), update: () => throwError(() => conflict), reset: () => throwError(() => new Error('x')) });
    await store.load();

    expect(await store.save(base.eventKey, request)).toBe(false);
    expect(store.conflicts()[base.eventKey]).toBe('stale');
    expect(await store.reset(base.eventKey)).toBe(false);
    expect(store.rowErrors()[base.eventKey]).toBe('Could not reset this notification setting.');
    expect(store.settings()[0]).toEqual(base);
  });

  it('surfaces a load error', async () => {
    const store = setup({ list: () => throwError(() => new Error('boom')) });
    await store.load();
    expect(store.error()).toContain('Could not load');
  });
});
