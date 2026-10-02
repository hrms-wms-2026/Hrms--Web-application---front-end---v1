import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { ObjectiveMemberApiService } from './objective-member-api.service';
import { ObjectiveMemberListDto, ObjectiveInvitationDto } from '../models/dto/objective-invitation.dto';
import { AddObjectiveMemberOutcomeDto, TransferObjectiveHeadOutcomeDto } from '../models/dto/milestone.dto';

describe('ObjectiveMemberApiService', () => {
  let service: ObjectiveMemberApiService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiUrl}/work/objectives`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ObjectiveMemberApiService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(ObjectiveMemberApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('gets objective members', () => {
    const dto: ObjectiveMemberListDto = { items: [] };
    service.getMembers('o1').subscribe((res) => expect(res).toEqual(dto));

    const req = httpMock.expectOne(`${base}/o1/members`);
    expect(req.request.method).toBe('GET');
    req.flush(dto);
  });

  it('adds a member and returns the outcome with response status', () => {
    const outcome: AddObjectiveMemberOutcomeDto = { applied: true, alreadyMember: false, invitation: { id: 'i1' } as ObjectiveInvitationDto };
    service.addMember('o1', 'e1').subscribe((res) => {
      expect(res.status).toBe(202);
      expect(res.body).toEqual(outcome);
    });

    const req = httpMock.expectOne(`${base}/o1/members`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ employeeId: 'e1' });
    req.flush(outcome, { status: 202, statusText: 'Accepted' });
  });

  it('removes a member (or cancels their pending invite - backend disambiguates)', () => {
    service.removeMember('o1', 'e1').subscribe((res) => expect(res.status).toBe(204));

    const req = httpMock.expectOne(`${base}/o1/members/e1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('gets my pending invitations', () => {
    const dtos: ObjectiveInvitationDto[] = [];
    service.getMyInvitations().subscribe((res) => expect(res).toEqual(dtos));

    const req = httpMock.expectOne(`${base}/invitations/mine`);
    expect(req.request.method).toBe('GET');
    req.flush(dtos);
  });

  it('accepts an invitation', () => {
    service.acceptInvitation('i1').subscribe();

    const req = httpMock.expectOne(`${base}/invitations/i1/accept`);
    expect(req.request.method).toBe('POST');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('rejects an invitation', () => {
    service.rejectInvitation('i1').subscribe();

    const req = httpMock.expectOne(`${base}/invitations/i1/reject`);
    expect(req.request.method).toBe('POST');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('transfers head and returns the outcome with response status', () => {
    const outcome: TransferObjectiveHeadOutcomeDto = { applied: false, approvalRequestId: null, pendingInvitation: { id: 'i2' } as ObjectiveInvitationDto };
    service.transferHead('o1', 'e2').subscribe((res) => {
      expect(res.status).toBe(202);
      expect(res.body).toEqual(outcome);
    });

    const req = httpMock.expectOne(`${base}/o1/transfer`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ newHeadEmployeeId: 'e2' });
    req.flush(outcome, { status: 202, statusText: 'Accepted' });
  });
});
