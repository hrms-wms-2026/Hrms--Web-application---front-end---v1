import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { OffboardingApiService } from '../../../data-access/offboarding-api.service';
import { OffboardingChooseChecklistStepComponent } from './offboarding-choose-checklist-step.component';

describe('OffboardingChooseChecklistStepComponent', () => {
  let fixture: ComponentFixture<OffboardingChooseChecklistStepComponent>;
  let selectChecklistSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    selectChecklistSpy = vi.fn(() => of(undefined));
    await TestBed.configureTestingModule({
      imports: [OffboardingChooseChecklistStepComponent],
      providers: [{
        provide: OffboardingApiService,
        useValue: {
          getChecklistMatches: () => of([{ id: 'tpl-1', name: 'Standard Offboarding', matchLevel: 'company' }]),
          selectChecklist: selectChecklistSpy,
          getOffboarding: () => of(null)
        }
      }]
    }).compileComponents();
    fixture = TestBed.createComponent(OffboardingChooseChecklistStepComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
  });

  it('lists matching templates and confirms the selected one', async () => {
    await fixture.whenStable();
    fixture.detectChanges();
    fixture.componentInstance.selectedId.set('tpl-1');
    await fixture.componentInstance.confirm();
    expect(selectChecklistSpy).toHaveBeenCalledWith('emp-1', 'tpl-1');
  });
});
