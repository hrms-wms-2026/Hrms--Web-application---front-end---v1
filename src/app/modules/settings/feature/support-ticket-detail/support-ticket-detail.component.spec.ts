import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SupportTicketDetailComponent } from './support-ticket-detail.component';
import { SupportTicketsApiService } from '../../data-access/support-tickets-api.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { SupportTicketDetail, SupportTicketStatus } from '../../models/support-ticket.model';

function detail(status: SupportTicketStatus = 'open'): SupportTicketDetail {
  return {
    ticket: {
      id: 't1',
      subject: 'Payroll export empty',
      description: 'No rows',
      status,
      priority: 'high',
      category: 'payroll',
      createdByName: 'Anu Owner',
      raisedBySupport: false,
      createdAt: '2026-11-10T09:00:00Z',
      updatedAt: null,
      resolvedAt: null
    },
    comments: [
      { id: 'c1', ticketId: 't1', authorName: 'Priya', isFromSupport: true, body: 'Looking now', createdAt: '2026-11-10T10:00:00Z' }
    ],
    attachments: [
      {
        id: 'f1',
        ticketId: 't1',
        fileName: 'export.xlsx',
        contentType: 'application/octet-stream',
        sizeBytes: 4096,
        uploadedByName: 'Anu Owner',
        isFromSupport: false,
        createdAt: '2026-11-10T09:05:00Z'
      }
    ]
  };
}

describe('SupportTicketDetailComponent', () => {
  let fixture: ComponentFixture<SupportTicketDetailComponent>;
  let component: SupportTicketDetailComponent;
  let api: Record<'get' | 'addComment' | 'uploadAttachment' | 'getDownloadUrl', ReturnType<typeof vi.fn>>;
  let notifications: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  async function setup(initial: SupportTicketDetail | 'missing' = detail()) {
    api = {
      get: vi
        .fn()
        .mockReturnValue(initial === 'missing' ? throwError(() => new HttpErrorResponse({ status: 404 })) : of(initial)),
      addComment: vi.fn(),
      uploadAttachment: vi.fn(),
      getDownloadUrl: vi.fn()
    };
    notifications = { success: vi.fn(), error: vi.fn() };
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [SupportTicketDetailComponent],
      providers: [
        provideRouter([]),
        { provide: SupportTicketsApiService, useValue: api },
        { provide: NotificationService, useValue: notifications },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 't1' }) } } }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(SupportTicketDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function fileEvent(file: File): Event {
    const inputElement = document.createElement('input');
    Object.defineProperty(inputElement, 'files', { value: [file] });
    return { target: inputElement } as unknown as Event;
  }

  afterEach(() => vi.restoreAllMocks());

  it('loads the ticket from the route and shows the conversation and files', async () => {
    await setup();
    expect(api.get).toHaveBeenCalledWith('t1');
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Payroll export empty');
    expect(text).toContain('Priya (CROWNUS support)');
    expect(text).toContain('export.xlsx');
    expect(text).toContain('4.0 KB');
  });

  it('says so when the ticket does not exist', async () => {
    await setup('missing');
    expect(fixture.nativeElement.textContent).toContain('This ticket does not exist.');
  });

  it('sends a reply and reloads the ticket', async () => {
    await setup();
    api.addComment.mockReturnValue(of({}));
    api.get.mockReturnValue(of(detail('open')));

    component.reply.set('  Still failing ');
    component.sendReply();

    expect(api.addComment).toHaveBeenCalledWith('t1', 'Still failing');
    expect(api.get).toHaveBeenCalledTimes(2);
    expect(component.reply()).toBe('');
  });

  it('does not send an empty reply', async () => {
    await setup();
    component.reply.set('   ');
    component.sendReply();
    expect(api.addComment).not.toHaveBeenCalled();
  });

  it('warns that replying reopens a resolved ticket', async () => {
    await setup(detail('resolved'));
    expect(fixture.nativeElement.textContent).toContain('Replying reopens this ticket.');
  });

  it('makes a closed ticket read-only', async () => {
    await setup(detail('closed'));
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('This ticket is closed.');
    expect(fixture.nativeElement.querySelector('#support-reply')).toBeNull();
    expect(text).not.toContain('Attach a file');
  });

  it('attaches a file and adds it to the list', async () => {
    await setup();
    const uploaded = { ...detail().attachments[0], id: 'f2', fileName: 'screen.png' };
    api.uploadAttachment.mockReturnValue(of(uploaded));
    const file = new File(['x'], 'screen.png', { type: 'image/png' });

    component.onFileSelected(fileEvent(file));

    expect(api.uploadAttachment).toHaveBeenCalledWith('t1', file);
    expect(component.detail()!.attachments.map((a) => a.fileName)).toEqual(['export.xlsx', 'screen.png']);
  });

  it('rejects files over 25 MB without uploading', async () => {
    await setup();
    const big = new File(['x'], 'huge.zip');
    Object.defineProperty(big, 'size', { value: 25 * 1024 * 1024 + 1 });

    component.onFileSelected(fileEvent(big));

    expect(api.uploadAttachment).not.toHaveBeenCalled();
    expect(notifications.error).toHaveBeenCalledWith('Files must be 25 MB or smaller.');
  });

  it('opens the signed url to download a file', async () => {
    await setup();
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    api.getDownloadUrl.mockReturnValue(of('https://files.test/signed'));

    component.download(detail().attachments[0]);

    expect(api.getDownloadUrl).toHaveBeenCalledWith('t1', 'f1');
    expect(open).toHaveBeenCalledWith('https://files.test/signed', '_blank', 'noopener');
  });
});
