import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationSettingsComponent } from './notification-settings.component';
import { NotificationSettingsApiService } from '../../data-access/notification-settings-api.service';
import { NotificationSetting } from '../../models/notification-setting.model';
import { UnsavedChangesService } from '../../../../shared/services/unsaved-changes.service';

function setting(overrides: Partial<NotificationSetting> = {}): NotificationSetting {
  return {
    eventKey: 'work_approval_requested', module: 'work_management', displayName: 'Work approval requested',
    supportedChannels: ['in_app', 'email', 'tray'], requiredChannels: [], defaultChannels: ['in_app'],
    enabledChannels: ['in_app'], templateId: null, recipientRule: 'default', recipientRules: ['default'],
    templates: [{ id: 'tpl-default', name: 'Default', isProductDefault: true }, { id: 'tpl-friendly', name: 'Friendly', isProductDefault: false }],
    isOverridden: false, revision: null, configurable: true, ...overrides,
  };
}

const legacy = setting({
  eventKey: 'leave_request_approved', module: 'leave', displayName: 'Leave request approved',
  supportedChannels: ['in_app'], defaultChannels: ['in_app'], enabledChannels: ['in_app'], configurable: false, templates: [],
});
const securityLike = setting({
  eventKey: 'required_event', displayName: 'Required event', supportedChannels: ['in_app', 'email'],
  requiredChannels: ['email'], defaultChannels: ['email'], enabledChannels: ['email'],
});

type Api = { [K in keyof NotificationSettingsApiService]: ReturnType<typeof vi.fn> };

describe('NotificationSettingsComponent', () => {
  let fixture: ComponentFixture<NotificationSettingsComponent>;
  let api: Api;
  let el: HTMLElement;

  async function setup(settings: NotificationSetting[] = [setting(), legacy, securityLike], listFails = false) {
    api = {
      list: vi.fn().mockReturnValue(listFails ? throwError(() => new Error('boom')) : of(settings)),
      update: vi.fn().mockImplementation((_key: string, req: { enabledChannels: string[] }) =>
        of(setting({ enabledChannels: req.enabledChannels as NotificationSetting['enabledChannels'], isOverridden: true, revision: 1 }))),
      reset: vi.fn().mockReturnValue(of(setting())),
    } as unknown as Api;
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [NotificationSettingsComponent],
      providers: [{ provide: NotificationSettingsApiService, useValue: api }],
    }).compileComponents();
    fixture = TestBed.createComponent(NotificationSettingsComponent);
    fixture.detectChanges();
    await settle();
    el = fixture.nativeElement;
  }

  async function settle() {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const toggle = (eventKey: string, channel: string) =>
    el.querySelector<HTMLInputElement>(`[data-testid="toggle-${eventKey}-${channel}"]`)!;
  const button = (testId: string) => el.querySelector<HTMLButtonElement>(`[data-testid="${testId}"] button`)!;

  beforeEach(async () => setup());

  it('groups events by module and filters them by search', () => {
    expect(el.textContent).toContain('Work Management');
    expect(el.textContent).toContain('Leave');

    fixture.componentInstance.search.set('leave');
    fixture.detectChanges();

    expect(el.textContent).toContain('Leave request approved');
    expect(el.textContent).not.toContain('Work approval requested');
  });

  it('switches channels independently and saves only that event', async () => {
    toggle('work_approval_requested', 'in_app').click();
    toggle('work_approval_requested', 'email').click();
    fixture.detectChanges();

    button('save-work_approval_requested').click();
    await settle();

    expect(api.update).toHaveBeenCalledWith('work_approval_requested',
      { enabledChannels: ['email'], templateId: null, recipientRule: 'default', revision: null });
    expect(fixture.componentInstance.isDirty()).toBe(false);
    expect(el.textContent).toContain('Customized');
  });

  it('disables channels an event does not support, with an explanation', () => {
    const tray = toggle('leave_request_approved', 'tray');
    expect(tray.disabled).toBe(true);
    expect(tray.closest('label')?.getAttribute('title')).toContain('Not available');
  });

  it('shows legacy-delivered events read-only', () => {
    expect(toggle('leave_request_approved', 'in_app').disabled).toBe(true);
    expect(el.querySelector('[data-testid="save-leave_request_approved"]')).toBeNull();
    expect(el.textContent).toContain('built-in delivery');
  });

  it('locks required channels on', () => {
    const email = toggle('required_event', 'email');
    expect(email.checked).toBe(true);
    expect(email.disabled).toBe(true);
    expect(el.textContent).toContain('Required');
  });

  it('only offers published templates for the event', () => {
    const select = el.querySelector<HTMLSelectElement>('[data-testid="template-work_approval_requested"]')!;
    const labels = Array.from(select.options).map((o) => o.textContent?.trim());
    expect(labels).toEqual(['Default', 'Friendly']);

    select.value = 'tpl-friendly';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    button('save-work_approval_requested').click();

    expect(api.update).toHaveBeenCalledWith('work_approval_requested', expect.objectContaining({ templateId: 'tpl-friendly' }));
  });

  it('tracks unsaved changes and registers them with the unsaved-changes guard', () => {
    const unsaved = TestBed.inject(UnsavedChangesService);
    expect(unsaved.hasDirtyForm()).toBe(false);

    toggle('work_approval_requested', 'email').click();
    fixture.detectChanges();

    expect(fixture.componentInstance.isDirty()).toBe(true);
    expect(unsaved.hasDirtyForm()).toBe(true);
    expect(button('save-work_approval_requested').disabled).toBe(false);
  });

  it('keeps edits and asks to reload when the save conflicts', async () => {
    api.update.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { detail: 'changed by someone else' } })));
    toggle('work_approval_requested', 'email').click();
    fixture.detectChanges();

    button('save-work_approval_requested').click();
    await settle();

    expect(el.textContent).toContain('Reload');
    expect(toggle('work_approval_requested', 'email').checked).toBe(true);
    expect(fixture.componentInstance.isDirty()).toBe(true);
  });

  it('keeps edits and shows the server message when a save is rejected', async () => {
    api.update.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403, error: { detail: 'Access denied.' } })));
    toggle('work_approval_requested', 'email').click();
    fixture.detectChanges();

    button('save-work_approval_requested').click();
    await settle();

    expect(el.textContent).toContain('Access denied.');
    expect(toggle('work_approval_requested', 'email').checked).toBe(true);
  });

  it('resets an overridden event to defaults', async () => {
    await setup([setting({ isOverridden: true, revision: 2, enabledChannels: ['email'] })]);
    expect(el.textContent).toContain('Customized');

    button('reset-work_approval_requested').click();
    await settle();

    expect(api.reset).toHaveBeenCalledWith('work_approval_requested');
    expect(el.textContent).toContain('Default');
  });

  it('shows an error state when loading fails', async () => {
    await setup([], true);

    expect(el.textContent).toContain('Could not load notification settings');
  });
});
