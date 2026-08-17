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
});
