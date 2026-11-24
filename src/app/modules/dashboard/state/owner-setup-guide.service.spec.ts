import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AuthStore } from '../../../core/auth/state/auth.store';
import { PermissionService } from '../../../core/auth/state/permission.service';
import { SelfSetupApiService } from '../data-access/self-setup-api.service';
import { SelfSetupStatusDto } from '../models/self-setup-status.model';
import {
  OwnerSetupGuideService,
  SETUP_GUIDE_SKIPPED_KEY_PREFIX,
} from './owner-setup-guide.service';

const fresh: SelfSetupStatusDto = {
  has_employee_profile: false,
  has_legal_entity: false,
  has_department: false,
  has_position: false,
  can_add_self: false,
  first_name: 'Ada',
  last_name: 'Owner',
  work_email: 'ada@acme.test',
};

function setup(
  opts: {
    status?: SelfSetupStatusDto | 'error';
    canWrite?: boolean;
    employeeId?: string | null;
  } = {},
) {
  const status = opts.status ?? fresh;
  const auth = {
    authenticated: signal(true),
    email: signal<string | null>('ada@acme.test'),
    employeeId: signal<string | null>(opts.employeeId ?? null),
    workspaceSlug: signal<string | null>('unicom'),
  };
  const getStatus = vi.fn(() =>
    status === 'error' ? throwError(() => new Error('403')) : of(status),
  );
  TestBed.configureTestingModule({
    providers: [
      { provide: AuthStore, useValue: auth },
      {
        provide: PermissionService,
        useValue: {
          hasPermission: (p: string) => p === 'employees:write' && (opts.canWrite ?? true),
        },
      },
      { provide: SelfSetupApiService, useValue: { getStatus } },
    ],
  });
  return { service: TestBed.inject(OwnerSetupGuideService), auth, getStatus };
}

describe('OwnerSetupGuideService', () => {
  beforeEach(() => localStorage.clear());

  it('shows for an owner without a profile once the status is loaded', async () => {
    const { service } = setup();
    expect(service.visible()).toBe(false);

    await service.refresh();

    expect(service.visible()).toBe(true);
  });

  it('never shows or asks the server for someone who already has a profile', async () => {
    const { service, getStatus } = setup({ employeeId: 'e1' });

    await service.refresh();

    expect(getStatus).not.toHaveBeenCalled();
    expect(service.visible()).toBe(false);
  });

  it('never shows without permission to add employees', async () => {
    const { service, getStatus } = setup({ canWrite: false });

    await service.refresh();

    expect(getStatus).not.toHaveBeenCalled();
    expect(service.visible()).toBe(false);
  });

  it('stays hidden when the status cannot be loaded', async () => {
    const { service } = setup({ status: 'error' });

    await service.refresh();

    expect(service.visible()).toBe(false);
  });

  it('lists the steps in order with only the first unfinished one open', async () => {
    const { service } = setup({ status: { ...fresh, has_legal_entity: true } });
    await service.refresh();

    expect(service.steps().map((s) => [s.key, s.state])).toEqual([
      ['legal-entity', 'done'],
      ['department', 'current'],
      ['position', 'locked'],
      ['add-yourself', 'locked'],
    ]);
    expect(service.doneCount()).toBe(1);
  });

  it('opens "Add yourself" once the company is ready', async () => {
    const { service } = setup({
      status: {
        ...fresh,
        has_legal_entity: true,
        has_department: true,
        has_position: true,
        can_add_self: true,
      },
    });
    await service.refresh();

    expect(service.steps()[3].state).toBe('current');
    expect(service.doneCount()).toBe(3);
  });

  it('counts the department as done when a position already exists (older server without has_department)', async () => {
    const { has_department: _missing, ...legacy } = {
      ...fresh,
      has_legal_entity: true,
      has_position: true,
      can_add_self: true,
    };
    const { service } = setup({ status: legacy as SelfSetupStatusDto });
    await service.refresh();

    expect(service.steps().map((s) => s.state)).toEqual(['done', 'done', 'done', 'current']);
  });

  it('opens "Add yourself" whenever the server says the owner can add themselves', async () => {
    const { service } = setup({
      status: {
        ...fresh,
        has_legal_entity: true,
        has_department: false,
        has_position: false,
        can_add_self: true,
      },
    });
    await service.refresh();

    expect(service.steps()[3].state).toBe('current');
  });

  it('hides after Skip for now, remembers it for this company, and comes back on Resume', async () => {
    const { service } = setup();
    await service.refresh();

    service.skip();

    expect(service.visible()).toBe(false);
    expect(service.skipped()).toBe(true);
    expect(localStorage.getItem(`${SETUP_GUIDE_SKIPPED_KEY_PREFIX}unicom`)).toBe('1');

    service.resume();

    expect(service.visible()).toBe(true);
    expect(localStorage.getItem(`${SETUP_GUIDE_SKIPPED_KEY_PREFIX}unicom`)).toBeNull();
  });

  it('starts skipped when this company was skipped before', async () => {
    localStorage.setItem(`${SETUP_GUIDE_SKIPPED_KEY_PREFIX}unicom`, '1');
    const { service } = setup();
    await service.refresh();

    expect(service.visible()).toBe(false);
  });

  it('shows "all set" after the owner adds themselves, until dismissed', async () => {
    const { service, auth } = setup();
    await service.refresh();

    service.markFinished();
    auth.employeeId.set('e1');

    expect(service.finished()).toBe(true);
    expect(service.visible()).toBe(true);

    service.dismissFinished();

    expect(service.visible()).toBe(false);
  });

  it('forgets the previous account after sign-out and sign-in as someone else', async () => {
    const { service, auth } = setup();
    await service.refresh();
    service.markFinished();

    auth.authenticated.set(false);
    auth.email.set(null);

    expect(service.status()).toBeNull();
    expect(service.finished()).toBe(false);
    expect(service.visible()).toBe(false);

    auth.authenticated.set(true);
    auth.email.set('bob@acme.test');

    expect(service.status()).toBeNull();
    expect(service.visible()).toBe(false);
  });

  it('forgets the status when switching to another company', async () => {
    const { service, auth } = setup();
    await service.refresh();

    auth.workspaceSlug.set('other-co');

    expect(service.status()).toBeNull();
  });

  it('clears what it knew when the account is no longer one the guide is for', async () => {
    const { service, auth } = setup();
    await service.refresh();

    auth.employeeId.set('e1');
    await service.refresh();
    auth.employeeId.set(null);

    expect(service.status()).toBeNull();
  });
});
