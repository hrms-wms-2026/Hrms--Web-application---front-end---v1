import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { CalendarEventFormModalComponent } from './calendar-event-form-modal.component';

describe('CalendarEventFormModalComponent', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<CalendarEventFormModalComponent>>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CalendarEventFormModalComponent] }).compileComponents();
    fixture = TestBed.createComponent(CalendarEventFormModalComponent);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
  });

  it('marks the form invalid until title and dates are filled', () => {
    expect(fixture.componentInstance.form.invalid).toBe(true);
  });

  it('does not emit save when the form is invalid', () => {
    const spy = vi.fn();
    fixture.componentInstance.save.subscribe(spy);
    fixture.componentInstance.onSubmit(null);
    expect(spy).not.toHaveBeenCalled();
  });

  it('hides the recurrence-until control until "until" end mode is chosen', () => {
    expect(fixture.componentInstance.form.controls.recurrenceEndMode.value).toBe('never');
    const untilField = fixture.nativeElement.querySelector('[data-testid="calendar-form-recurrence-until"]');
    expect(untilField).toBeNull();
  });

  it('emits a create payload with a built recurrenceRule when the form is valid and weekly is chosen', () => {
    const spy = vi.fn();
    fixture.componentInstance.save.subscribe(spy);
    fixture.componentInstance.form.patchValue({
      title: 'Standup', startDate: '2026-09-01', startTime: '09:00', endDate: '2026-09-01', endTime: '09:30',
      recurrenceFrequency: 'weekly', recurrenceEndMode: 'never'
    });
    fixture.componentInstance.onSubmit(null);
    expect(spy).toHaveBeenCalledTimes(1);
    const submission = spy.mock.calls[0][0] as { create: { recurrence: string; recurrenceRule: string | null } };
    expect('create' in submission).toBe(true);
    expect(submission.create.recurrenceRule).toBe('FREQ=WEEKLY');
  });

  it('pre-fills the form and emits an update payload with scope=null for a plain event', () => {
    fixture.componentRef.setInput('event', {
      id: 'e1', title: 'Existing', description: null, startDate: '2026-09-01T09:00:00Z', endDate: '2026-09-01T09:30:00Z',
      sourceType: 'manual', color: null, recurrence: 'none', isAllDay: false, timezone: 'UTC', eventStatus: null,
      isPrivate: false, location: null, meetingLink: null, externalSource: null, createdById: 'u1',
      isRecurringOccurrence: false, recurrenceMasterId: null, originalStart: null, participants: null
    });
    fixture.detectChanges();
    expect(fixture.componentInstance.form.controls.title.value).toBe('Existing');

    const spy = vi.fn();
    fixture.componentInstance.save.subscribe(spy);
    fixture.componentInstance.onSubmit(null);
    const submission = spy.mock.calls[0][0] as { update: unknown; scope: unknown };
    expect('update' in submission).toBe(true);
    expect(submission.scope).toBeNull();

    expect(fixture.nativeElement.querySelector('[data-testid="calendar-form-save-this-event"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="calendar-form-save-plain"]')).not.toBeNull();
  });

  it('offers a this-event/all-events choice and emits the chosen scope for a recurring occurrence', () => {
    fixture.componentRef.setInput('event', {
      id: 'occurrence-id', title: 'Standup', description: null, startDate: '2026-09-08T09:00:00Z', endDate: '2026-09-08T09:30:00Z',
      sourceType: 'manual', color: null, recurrence: 'weekly', isAllDay: false, timezone: 'UTC', eventStatus: null,
      isPrivate: false, location: null, meetingLink: null, externalSource: null, createdById: 'u1',
      isRecurringOccurrence: true, recurrenceMasterId: 'master-1', originalStart: '2026-09-08T09:00:00Z'
    });
    fixture.detectChanges();

    const spy = vi.fn();
    fixture.componentInstance.save.subscribe(spy);
    fixture.nativeElement.querySelector('[data-testid="calendar-form-save-this-event"]').click();

    const submission = spy.mock.calls[0][0] as { update: unknown; scope: unknown };
    expect(submission.scope).toBe('ThisEventOnly');
  });

  it('emits the delete output with the chosen scope', () => {
    fixture.componentRef.setInput('event', {
      id: 'occurrence-id', title: 'Standup', description: null, startDate: '2026-09-08T09:00:00Z', endDate: '2026-09-08T09:30:00Z',
      sourceType: 'manual', color: null, recurrence: 'weekly', isAllDay: false, timezone: 'UTC', eventStatus: null,
      isPrivate: false, location: null, meetingLink: null, externalSource: null, createdById: 'u1',
      isRecurringOccurrence: true, recurrenceMasterId: 'master-1', originalStart: '2026-09-08T09:00:00Z'
    });
    fixture.detectChanges();

    const spy = vi.fn();
    fixture.componentInstance.delete.subscribe(spy);
    fixture.nativeElement.querySelector('[data-testid="calendar-form-delete-all-events"]').click();
    expect(spy).toHaveBeenCalledWith('AllEvents');
  });
});
