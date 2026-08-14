import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { LegalEntityStore } from '../../../organization/state/legal-entity.store';
import { ChecklistTemplatesComponent } from './checklist-templates.component';

/**
 * Uses the REAL LegalEntityStore (not a spied selectedLegalEntity) to drive the
 * checklist-templates effect through the actual computed chain
 * (companies() -> selectedLegalEntity()). This isolates whether the upstream
 * legal-entity selection machinery itself could keep re-emitting a new
 * selectedLegalEntity reference on idle change-detection cycles and spuriously
 * re-fire the list call - a possible source of a page-entry request loop that a
 * mocked selectedLegalEntity() in the other spec file cannot detect.
 */
describe('ChecklistTemplatesComponent - real selectedLegalEntity chain (no request loop)', () => {
  it('idle change detection after a real company load does not re-trigger the list call', async () => {
    await TestBed.configureTestingModule({
      imports: [ChecklistTemplatesComponent],
      providers: [
        PermissionService,
        LegalEntityStore,
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    }).compileComponents();

    const legalEntityStore = TestBed.inject(LegalEntityStore);
    const httpMock = TestBed.inject(HttpTestingController);
    const permissionService = TestBed.inject(PermissionService);
    vi.spyOn(permissionService, 'hasPermission').mockReturnValue(false);

    const loadPromise = legalEntityStore.loadCompanies();
    httpMock
      .expectOne((r) => r.url === `${environment.apiUrl}/org/legal-entities`)
      .flush([{ id: 'legal-1', name: 'Real Co', companyCode: 'RC', logoFileId: null, isActive: true, isPrimary: true }]);
    await loadPromise;

    const fixture = TestBed.createComponent(ChecklistTemplatesComponent);
    fixture.detectChanges();

    httpMock
      .expectOne((r) => r.url === `${environment.apiUrl}/people/checklist-templates`)
      .flush({ items: [], totalCount: 0, page: 1, pageSize: 25 });

    for (let i = 0; i < 8; i++) {
      fixture.detectChanges();
    }

    httpMock.expectNone((r) => r.url === `${environment.apiUrl}/people/checklist-templates`);
    httpMock.verify();
  });
});
