import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { WorkModeStore } from './work-mode.store';
import { WorkModeApiService } from '../data-access/work-mode-api.service';
import { WorkMode } from '../models/work-mode.model';

describe('WorkModeStore', () => {
  const legalEntityId = 'le-1';
  const fiveModes: WorkMode[] = Array.from({ length: 5 }, (_, i) => ({
    id: `wm-${i}`, legalEntityId, name: `Mode ${i}`, biometricEnabled: false, webEnabled: true,
    trayEnabled: false, photoRequired: false, selfRegistersLocation: false, allowsDailyLocationChoice: false,
    isSystemSeeded: i < 3, displayOrder: i, isActive: true, createdAt: '', updatedAt: ''
  }));

  function setup(apiStub: Partial<WorkModeApiService>) {
    TestBed.configureTestingModule({
      providers: [WorkModeStore, { provide: WorkModeApiService, useValue: apiStub }]
    });
    return TestBed.inject(WorkModeStore);
  }

  it('load() populates items and sets atCap when 5 active modes exist', () => {
    const store = setup({ list: () => of(fiveModes) });
    store.load(legalEntityId);
    expect(store.items()).toEqual(fiveModes);
    expect(store.atCap()).toBe(true);
    expect(store.loading()).toBe(false);
  });

  it('load() surfaces an error and stops loading on failure', () => {
    const store = setup({ list: () => throwError(() => new Error('boom')) });
    store.load(legalEntityId);
    expect(store.error()).toBeTruthy();
    expect(store.loading()).toBe(false);
  });

  it('create() appends the new mode and clears atCap correctly when under 5', () => {
    const created = fiveModes[0];
    const store = setup({ list: () => of([]), create: () => of(created) });
    store.load(legalEntityId);
    store.create({
      name: created.name,
      biometricEnabled: false,
      webEnabled: true,
      trayEnabled: false,
      photoRequired: false,
      selfRegistersLocation: false,
      allowsDailyLocationChoice: false
    });
    expect(store.items()).toEqual([created]);
    expect(store.atCap()).toBe(false);
  });

  it('deactivate() removes the mode from items on success', () => {
    const store = setup({ list: () => of(fiveModes), deactivate: () => of(undefined) });
    store.load(legalEntityId);
    store.deactivate(fiveModes[0].id);
    expect(store.items().find(m => m.id === fiveModes[0].id)).toBeUndefined();
  });
});
