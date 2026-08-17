import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ChangePositionModalComponent } from './change-position-modal.component';
import { PeopleApiService } from '../../data-access/people-api.service';
import { PositionApiService } from '../../../organization/data-access/position-api.service';
import { NotificationService } from '../../../../core/services/notification.service';

describe('ChangePositionModalComponent', () => {
  let fixture: ComponentFixture<ChangePositionModalComponent>;
  let component: ChangePositionModalComponent;
  let peopleApi: { changePosition: ReturnType<typeof vi.fn> };
  let positionApi: { listFlat: ReturnType<typeof vi.fn> };
  let notificationsStub: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    peopleApi = { changePosition: vi.fn() };
    positionApi = {
      listFlat: vi.fn().mockReturnValue(
        of({ items: [{ id: 'pos-2', name: 'Manager' }], totalCount: 1, page: 1, pageSize: 25 } as never)
      )
    };
    notificationsStub = { success: vi.fn(), error: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [ChangePositionModalComponent],
      providers: [
        { provide: PeopleApiService, useValue: peopleApi },
        { provide: PositionApiService, useValue: positionApi },
        { provide: NotificationService, useValue: notificationsStub }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ChangePositionModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.componentRef.setInput('legalEntityId', 'le-1');
    fixture.componentRef.setInput('currentPositionId', 'pos-1');
    fixture.detectChanges();
  });

  it('emits changed and calls changePosition on submit', () => {
    peopleApi.changePosition.mockReturnValue(of(undefined));
    const changedSpy = vi.fn();
    component.changed.subscribe(changedSpy);

    component.selectedPositionId.set('pos-2');
    component.submit();

    expect(peopleApi.changePosition).toHaveBeenCalledWith('emp-1', expect.objectContaining({ positionId: 'pos-2' }));
    expect(changedSpy).toHaveBeenCalled();
  });

  it('shows the backend conflict message on a 409 and does not emit changed', () => {
    peopleApi.changePosition.mockReturnValue(
      throwError(() => ({ status: 409, error: { detail: 'This position has reached its capacity.' } }))
    );
    const changedSpy = vi.fn();
    component.changed.subscribe(changedSpy);

    component.selectedPositionId.set('pos-2');
    component.submit();

    expect(changedSpy).not.toHaveBeenCalled();
    expect(notificationsStub.error).toHaveBeenCalledWith('This position has reached its capacity.');
    expect(component.submitting()).toBe(false);
  });

  it('calls listFlat with an explicit pageSize and includeInactive:false', () => {
    expect(positionApi.listFlat).toHaveBeenCalledWith('le-1', { pageSize: 200, includeInactive: false });
  });

  it('does not submit and disables Save when the effective date is cleared', () => {
    component.selectedPositionId.set('pos-2');
    component.effectiveFrom.set('');
    fixture.detectChanges();

    component.submit();

    expect(peopleApi.changePosition).not.toHaveBeenCalled();

    // Find the Save button specifically among rendered buttons.
    const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
    const save = buttons.find((b) => b.textContent?.includes('Save'));
    expect(save?.disabled).toBe(true);
  });

  it('shows an error message and does not throw when listFlat fails', () => {
    positionApi.listFlat.mockReturnValue(throwError(() => ({ status: 403, error: { detail: 'Forbidden' } })));

    // Re-trigger loadPositions by re-opening (effect reacts to open() transitions).
    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    expect(component.loadError()).toBe('Forbidden');
    expect(fixture.nativeElement.textContent).toContain('Forbidden');
  });
});
