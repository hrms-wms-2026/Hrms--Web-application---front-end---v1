import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { SupportTicketsComponent } from './support-tickets.component';
import { SupportTicketsApiService } from '../../data-access/support-tickets-api.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { SupportTicket } from '../../models/support-ticket.model';

function ticket(overrides: Partial<SupportTicket> = {}): SupportTicket {
  return {
    id: 't1',
    subject: 'Payroll export empty',
    description: 'No rows',
    status: 'open',
    priority: 'high',
    category: null,
    createdByName: 'Anu Owner',
    raisedBySupport: false,
    createdAt: '2026-11-10T09:00:00Z',
    updatedAt: null,
    resolvedAt: null,
    ...overrides
  };
}

describe('SupportTicketsComponent', () => {
  let fixture: ComponentFixture<SupportTicketsComponent>;
  let component: SupportTicketsComponent;
  let api: { list: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  let notifications: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  async function setup(items: SupportTicket[] = [ticket()], total = items.length) {
    api = {
      list: vi.fn().mockReturnValue(of({ items, total, page: 1, pageSize: 20 })),
      create: vi.fn()
    };
    notifications = { success: vi.fn(), error: vi.fn() };
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [SupportTicketsComponent],
      providers: [
        provideRouter([]),
        { provide: SupportTicketsApiService, useValue: api },
        { provide: NotificationService, useValue: notifications }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(SupportTicketsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('loads the first page on open and lists tickets', async () => {
    await setup([ticket(), ticket({ id: 't2', subject: 'Login loop', raisedBySupport: true })]);

    expect(api.list).toHaveBeenCalledWith('', 1, 20);
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Payroll export empty');
    expect(text).toContain('Raised by Anu Owner');
    expect(text).toContain('Opened by CROWNUS support');
  });

  it('shows the empty state when there are no tickets', async () => {
    await setup([]);
    expect(fixture.nativeElement.textContent).toContain('No support tickets yet.');
  });

  it('shows a retryable error when loading fails', async () => {
    await setup();
    api.list.mockReturnValue(throwError(() => new Error('down')));
    component.load();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Support tickets could not be loaded.');
  });

  it('filters by status from page 1', async () => {
    await setup([ticket()], 45);
    component.goToPage(3);
    component.onStatusFilter('resolved');
    expect(component.page()).toBe(1);
    expect(api.list).toHaveBeenLastCalledWith('resolved', 1, 20);
  });

  it('does not send an incomplete ticket', async () => {
    await setup();
    component.openForm();
    component.submit();
    fixture.detectChanges();

    expect(api.create).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Subject is required.');
    expect(fixture.nativeElement.textContent).toContain('Describe the problem.');
  });

  it('sends a ticket and opens it', async () => {
    await setup();
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    api.create.mockReturnValue(of(ticket({ id: 'new-1' })));

    component.openForm();
    component.subject.set('  Login loop ');
    component.description.set('Redirects forever');
    component.priority.set('urgent');
    component.submit();

    expect(api.create).toHaveBeenCalledWith({
      subject: 'Login loop',
      description: 'Redirects forever',
      priority: 'urgent',
      category: null
    });
    expect(notifications.success).toHaveBeenCalledWith('Ticket sent to CROWNUS support.');
    expect(navigate).toHaveBeenCalledWith(['/settings/support', 'new-1']);
    expect(component.showForm()).toBe(false);
  });

  it('keeps the form and shows the server message when sending fails', async () => {
    await setup();
    api.create.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 400, error: { detail: 'subject is required.' } })));

    component.openForm();
    component.subject.set('x');
    component.description.set('y');
    component.submit();

    expect(notifications.error).toHaveBeenCalledWith('subject is required.');
    expect(component.showForm()).toBe(true);
    expect(component.saving()).toBe(false);
  });
});
