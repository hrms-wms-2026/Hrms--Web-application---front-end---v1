import { TestBed } from '@angular/core/testing';
import { DirtyFormHandle, UnsavedChangesService } from './unsaved-changes.service';

function handle(overrides: Partial<DirtyFormHandle> = {}): DirtyFormHandle & { discard: ReturnType<typeof vi.fn>; saveDraft: ReturnType<typeof vi.fn> } {
  return { isDirty: () => true, canSaveDraft: () => true, saveDraft: vi.fn(async () => true), discard: vi.fn(), ...overrides } as never;
}

describe('UnsavedChangesService', () => {
  let service: UnsavedChangesService;
  beforeEach(() => { service = TestBed.inject(UnsavedChangesService); });

  it('allows closing a clean form without prompting', async () => {
    const h = handle({ isDirty: () => false });
    service.register(h);
    expect(await service.requestClose(h)).toBe(true);
    expect(service.prompt()).toBeNull();
  });

  it('keep → stays open, discard → calls discard and closes', async () => {
    const h = handle();
    service.register(h);
    const keep = service.requestClose(h);
    expect(service.prompt()).toEqual({ canSaveDraft: true, saving: false, error: null });
    service.choose('keep');
    expect(await keep).toBe(false);
    expect(service.prompt()).toBeNull();

    const discard = service.requestClose(h);
    service.choose('discard');
    expect(await discard).toBe(true);
    expect(h.discard).toHaveBeenCalled();
    expect(service.prompt()).toBeNull();
  });

  it('save → closes when the draft saves; stays open with an error when it fails', async () => {
    const h = handle({ saveDraft: vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true) });
    service.register(h);
    const result = service.requestClose(h);
    service.choose('save');
    await new Promise<void>((resolve) => setTimeout(resolve));
    expect(service.prompt()).toEqual({ canSaveDraft: true, saving: false, error: 'Could not save the draft. Try again or discard your changes.' });
    service.choose('save');
    expect(await result).toBe(true);
    expect(h.saveDraft).toHaveBeenCalledTimes(2);
  });

  it('requestClose() without a handle uses the latest registration; unregister removes it', async () => {
    const unregister = service.register(handle({ isDirty: () => false }));
    expect(service.hasDirtyForm()).toBe(false);
    const dirty = handle();
    const unregisterDirty = service.register(dirty);
    expect(service.hasDirtyForm()).toBe(true);
    unregisterDirty();
    expect(await service.requestClose()).toBe(true);
    unregister();
  });

  it('blocks browser unload while a dirty form is registered', () => {
    service.register(handle());
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});
