import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { LegalEntityStore } from '../../../organization/state/legal-entity.store';
import { PeopleApiService } from '../../data-access/people-api.service';
import { BulkOnboardingStore } from '../../state/bulk-onboarding.store';
import { BulkOnboardingComponent } from './bulk-onboarding.component';

describe('BulkOnboardingComponent', () => {
  let fixture: ComponentFixture<BulkOnboardingComponent>;
  let storeMock: Partial<InstanceType<typeof BulkOnboardingStore>>;

  beforeEach(async () => {
    storeMock = {
      batch: vi.fn().mockReturnValue(null) as any,
      mapping: vi.fn().mockReturnValue({}) as any,
      preview: vi.fn().mockReturnValue(null) as any,
      loading: vi.fn().mockReturnValue(false) as any,
      error: vi.fn().mockReturnValue(null) as any,
      upload: vi.fn(),
      updateMapping: vi.fn(),
      reset: vi.fn(),
      toggleRowSelection: vi.fn(),
      finalizeSelected: vi.fn(),
      createDrafts: vi.fn(),
      validate: vi.fn(),
      validationResult: vi.fn().mockReturnValue(null) as any,
      detail: vi.fn().mockReturnValue(null) as any,
      selectedDraftIds: vi.fn().mockReturnValue([]) as any,
      polling: vi.fn().mockReturnValue(false) as any
    };

    await TestBed.configureTestingModule({
      imports: [BulkOnboardingComponent],
      providers: [
        provideRouter([]),
        { provide: BulkOnboardingStore, useValue: storeMock },
        {
          provide: LegalEntityStore,
          useValue: {
            companies: () => [],
            selectedLegalEntity: () => ({ id: 'le-1', name: 'Acme Co' }),
            loadCompanies: vi.fn().mockResolvedValue(undefined)
          }
        },
        { provide: PeopleApiService, useValue: { getWorkModes: () => of([]) } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(BulkOnboardingComponent);
  });

  it('starts on the upload step', () => {
    fixture.detectChanges();
    expect(fixture.componentInstance.currentStep()).toBe('upload');
    const text = fixture.nativeElement.textContent as string;
    expect(text).not.toContain('Default checklist template');
    expect(text).not.toContain('Legal entity');
    expect(fixture.nativeElement.querySelector('.bo-stepper')).toBeNull();
  });

  it('advances to the mapping step once a batch exists', () => {
    (storeMock.batch as any).mockReturnValue({
      id: 'batch-1', status: 'mapping_pending', totalRows: 1, validRows: null, invalidRows: null,
      detectedColumns: ['Email'], suggestedMapping: {}
    });
    fixture.detectChanges();

    expect(fixture.componentInstance.currentStep()).toBe('map-columns');
  });

  it('calling onMappingFieldChange delegates to store.updateMapping', () => {
    fixture.detectChanges();
    fixture.componentInstance.onMappingFieldChange('workEmail', 'Email');

    expect(storeMock.updateMapping).toHaveBeenCalledWith('workEmail', 'Email');
  });

  it('validate step shows partial-success summary and per-row errors', () => {
    (storeMock.validationResult as any) = vi.fn().mockReturnValue({
      validRows: 1, invalidRows: 1,
      rows: [
        { rowNumber: 1, status: 'valid', errorMessage: null },
        { rowNumber: 2, status: 'invalid', errorMessage: 'Last name is required.' }
      ]
    });
    (storeMock.batch as any).mockReturnValue({ id: 'batch-1', status: 'validated', totalRows: 2, validRows: 1, invalidRows: 1, detectedColumns: [], suggestedMapping: {} });
    fixture.componentInstance.goToStep('validate');
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Last name is required.');
  });

  it('toggling a review row calls store.toggleRowSelection with the draft id', () => {
    fixture.detectChanges();
    fixture.componentInstance.onToggleRow('draft-1');

    expect(storeMock.toggleRowSelection).toHaveBeenCalledWith('draft-1');
  });

  it('clicking finalize calls store.finalizeSelected', async () => {
    fixture.detectChanges();
    await fixture.componentInstance.onFinalizeSelected();

    expect(storeMock.finalizeSelected).toHaveBeenCalled();
  });
});
