import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { BulkOnboardingStore } from './bulk-onboarding.store';
import { BulkOnboardingApiService } from '../data-access/bulk-onboarding-api.service';
import { BulkOnboardingBatchResponse } from '../models/bulk-onboarding.model';

describe('BulkOnboardingStore', () => {
  let store: InstanceType<typeof BulkOnboardingStore>;
  let apiMock: {
    upload: ReturnType<typeof vi.fn>;
    preview: ReturnType<typeof vi.fn>;
    validate: ReturnType<typeof vi.fn>;
    requestCreateDrafts: ReturnType<typeof vi.fn>;
    getBatch: ReturnType<typeof vi.fn>;
    requestFinalize: ReturnType<typeof vi.fn>;
  };

  const emptyFilePayload = {
    file: new File([], 'x.csv'),
    legalEntityId: 'le-1',
    defaultWorkModeId: null,
    defaultEmploymentType: null,
    defaultChecklistTemplateId: null
  };

  const mappingPendingBatch: BulkOnboardingBatchResponse = {
    id: 'batch-1',
    status: 'mapping_pending',
    totalRows: 2,
    validRows: null,
    invalidRows: null,
    detectedColumns: ['Email'],
    suggestedMapping: { workEmail: 'Email' }
  };

  beforeEach(() => {
    apiMock = {
      upload: vi.fn(),
      preview: vi.fn(),
      validate: vi.fn(),
      requestCreateDrafts: vi.fn(),
      getBatch: vi.fn(),
      requestFinalize: vi.fn()
    };

    TestBed.configureTestingModule({
      providers: [BulkOnboardingStore, { provide: BulkOnboardingApiService, useValue: apiMock }]
    });
    store = TestBed.inject(BulkOnboardingStore);
  });

  it('upload() success stores the batch and suggested mapping', async () => {
    apiMock.upload.mockReturnValue(of(mappingPendingBatch));

    await store.upload(emptyFilePayload);

    expect(store.batch()?.id).toBe('batch-1');
    expect(store.mapping().workEmail).toBe('Email');
    expect(store.loading()).toBe(false);
  });

  it('upload() failure sets error and does not set a batch', async () => {
    apiMock.upload.mockReturnValue(throwError(() => new Error('too many rows')));

    await store.upload(emptyFilePayload);

    expect(store.batch()).toBeNull();
    expect(store.error()).toContain('too many rows');
  });

  it('validate() stores per-row results and valid/invalid counts', async () => {
    apiMock.upload.mockReturnValue(of(mappingPendingBatch));
    await store.upload(emptyFilePayload);

    apiMock.validate.mockReturnValue(of({
      validRows: 1, invalidRows: 1,
      rows: [
        { rowNumber: 1, status: 'valid', errorMessage: null },
        { rowNumber: 2, status: 'invalid', errorMessage: 'Last name is required.' }
      ]
    }));

    await store.validate();

    expect(store.validationResult()?.invalidRows).toBe(1);
  });

  it('toggleRowSelection() adds and removes a draft id from the selection set', () => {
    store.toggleRowSelection('draft-1');
    expect(store.selectedDraftIds()).toContain('draft-1');

    store.toggleRowSelection('draft-1');
    expect(store.selectedDraftIds()).not.toContain('draft-1');
  });
});
