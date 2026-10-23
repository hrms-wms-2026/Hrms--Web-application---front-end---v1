import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { InboxApiService } from '../data-access/inbox-api.service';
import { InboxCapability, InboxKindDescriptorDto } from '../models/inbox.dto';
import { InboxKindsStore } from './inbox-kinds.store';

const LEAVE: InboxKindDescriptorDto = {
  source: 'leave', kind: 'request', label: 'Leave request', category: 'request',
  capabilities: InboxCapability.Chat | InboxCapability.EditBeforeApprove, detailRenderer: 'leave-request'
};

describe('InboxKindsStore', () => {
  let kinds: ReturnType<typeof vi.fn>;

  function setup(): InstanceType<typeof InboxKindsStore> {
    TestBed.configureTestingModule({ providers: [{ provide: InboxApiService, useValue: { kinds } }] });
    return TestBed.inject(InboxKindsStore);
  }

  it('loads the registry once and answers descriptor and capability lookups', async () => {
    kinds = vi.fn(() => of([LEAVE]));
    const store = setup();

    await store.ensureLoaded();
    await store.ensureLoaded();

    expect(kinds).toHaveBeenCalledTimes(1);
    expect(store.descriptor('leave', 'request')).toEqual(LEAVE);
    expect(store.descriptor('leave', 'other')).toBeNull();
    expect(store.has('leave', 'request', InboxCapability.EditBeforeApprove)).toBe(true);
    expect(store.has('leave', 'request', InboxCapability.Revert)).toBe(false);
    expect(store.has('work', 'approval', InboxCapability.Chat)).toBe(false);
  });

  it('a failed load leaves the registry empty and lets a later call retry', async () => {
    kinds = vi.fn()
      .mockReturnValueOnce(throwError(() => new Error('down')))
      .mockReturnValueOnce(of([LEAVE]));
    const store = setup();

    await store.ensureLoaded();
    expect(store.descriptor('leave', 'request')).toBeNull();

    await store.ensureLoaded();
    expect(store.descriptor('leave', 'request')).toEqual(LEAVE);
  });
});
