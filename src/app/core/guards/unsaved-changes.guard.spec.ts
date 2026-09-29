import { TestBed } from '@angular/core/testing';
import { UnsavedChangesService } from '../../shared/services/unsaved-changes.service';
import { unsavedChangesGuard } from './unsaved-changes.guard';

describe('unsavedChangesGuard', () => {
  function run(requestClose: () => Promise<boolean>) {
    TestBed.configureTestingModule({ providers: [{ provide: UnsavedChangesService, useValue: { requestClose } }] });
    return TestBed.runInInjectionContext(() => unsavedChangesGuard(null!, null!, null!, null!));
  }

  it('allows leaving when the service allows it', async () => {
    expect(await run(() => Promise.resolve(true))).toBe(true);
  });

  it('blocks leaving when the user keeps editing', async () => {
    expect(await run(() => Promise.resolve(false))).toBe(false);
  });
});
