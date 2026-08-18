import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { LegalEntityStore } from '../../../organization/state/legal-entity.store';
import { ChecklistApiService } from '../../data-access/checklist-api.service';
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
      reset: vi.fn()
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
            selectedLegalEntity: () => null,
            loadCompanies: vi.fn().mockResolvedValue(undefined)
          }
        },
        { provide: PeopleApiService, useValue: { getWorkModes: () => of([]) } },
        {
          provide: ChecklistApiService,
          useValue: { listChecklistTemplates: () => of({ items: [], totalCount: 0, page: 1, pageSize: 25 }) }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(BulkOnboardingComponent);
  });

  it('starts on the upload step', () => {
    fixture.detectChanges();
    expect(fixture.componentInstance.currentStep()).toBe('upload');
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
});
