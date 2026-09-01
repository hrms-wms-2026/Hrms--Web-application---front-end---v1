import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { SelectComponent } from '../../../../shared/ui/select/select.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import {
  CalendarConflict, CalendarEventParticipant, CalendarEventResponse, CreateCalendarEventRequest,
  RecurrenceEditScope, RespondToCalendarEventStatus, UpdateCalendarEventRequest
} from '../../models/calendar-event.model';
import { RecurrenceEndMode, RecurrenceFrequency, buildRecurrenceRule } from '../../utils/recurrence-rule.util';
import { CalendarParticipantPickerComponent } from '../calendar-participant-picker/calendar-participant-picker.component';

export type CalendarEventFormSubmission =
  | { create: CreateCalendarEventRequest }
  | { update: UpdateCalendarEventRequest; scope: RecurrenceEditScope | null };

@Component({
  selector: 'app-calendar-event-form-modal',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, ButtonComponent, InputComponent, SelectComponent,
    ModalComponent, DatePickerComponent, CalendarParticipantPickerComponent
  ],
  templateUrl: './calendar-event-form-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalendarEventFormModalComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);

  @Input() open = false;
  @Input() event: CalendarEventResponse | null = null;
  @Input() prefillStart: string | null = null;
  @Input() saving = false;
  @Input() conflicts: readonly CalendarConflict[] = [];
  @Input() checkingConflicts = false;
  @Output() save = new EventEmitter<CalendarEventFormSubmission>();
  @Output() delete = new EventEmitter<RecurrenceEditScope | null>();
  @Output() respond = new EventEmitter<RespondToCalendarEventStatus>();
  @Output() checkConflicts = new EventEmitter<{ participantEmployeeIds: readonly string[]; startDate: string; endDate: string }>();
  @Output() cancel = new EventEmitter<void>();

  private readonly authStore = inject(AuthStore);
  private conflictCheckTimer: ReturnType<typeof setTimeout> | null = null;

  readonly recurrenceOptions = [
    { value: 'none', label: 'Does not repeat' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' }
  ];

  readonly participantPickerOpen = signal(false);
  readonly participantIds = signal<readonly string[]>([]);

  readonly form = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    description: [''],
    startDate: ['', Validators.required],
    startTime: ['09:00', Validators.required],
    endDate: ['', Validators.required],
    endTime: ['10:00', Validators.required],
    isAllDay: [false],
    location: [''],
    meetingLink: [''],
    color: ['#2563EB'],
    recurrenceFrequency: ['none' as RecurrenceFrequency],
    recurrenceEndMode: ['never' as RecurrenceEndMode],
    recurrenceUntilDate: ['']
  });

  private readonly formChangeSubscription = this.form.valueChanges.subscribe(() => this.scheduleConflictCheck());

  get isEdit(): boolean {
    return !!this.event;
  }

  viewerParticipant(): CalendarEventParticipant | null {
    const employeeId = this.authStore.employeeId();
    if (!employeeId || !this.event?.participants) return null;
    return this.event.participants.find((p) => p.employeeId === employeeId) ?? null;
  }

  onRespond(status: RespondToCalendarEventStatus): void {
    this.respond.emit(status);
  }

  ngOnChanges(): void {
    if (this.event) {
      const [startDate, startTimeRaw] = this.event.startDate.split('T');
      const [endDate, endTimeRaw] = this.event.endDate.split('T');
      this.form.patchValue({
        title: this.event.title,
        description: this.event.description ?? '',
        startDate,
        startTime: startTimeRaw.slice(0, 5),
        endDate,
        endTime: endTimeRaw.slice(0, 5),
        isAllDay: this.event.isAllDay,
        location: this.event.location ?? '',
        meetingLink: this.event.meetingLink ?? '',
        color: this.event.color ?? '#2563EB'
      });
      return;
    }

    if (this.prefillStart) {
      const [date, time] = this.prefillStart.split('T');
      this.form.patchValue({ startDate: date, startTime: time ?? '09:00', endDate: date, endTime: time ?? '10:00' });
    }
  }

  setTitle(value: string): void {
    this.form.controls.title.setValue(value);
  }

  setDescription(value: string): void {
    this.form.controls.description.setValue(value);
  }

  setLocation(value: string): void {
    this.form.controls.location.setValue(value);
  }

  setMeetingLink(value: string): void {
    this.form.controls.meetingLink.setValue(value);
  }

  setRecurrenceFrequency(value: string): void {
    this.form.controls.recurrenceFrequency.setValue(value as RecurrenceFrequency);
  }

  openParticipantPicker(): void {
    this.participantPickerOpen.set(true);
  }

  onParticipantIdsChange(ids: readonly string[]): void {
    this.participantIds.set(ids);
    this.scheduleConflictCheck();
  }

  private scheduleConflictCheck(): void {
    if (this.isEdit) return; // participants are read-only once an event exists - nothing to re-check
    if (this.conflictCheckTimer) clearTimeout(this.conflictCheckTimer);
    this.conflictCheckTimer = setTimeout(() => {
      const ids = this.participantIds();
      const raw = this.form.getRawValue();
      if (ids.length === 0 || !raw.startDate || !raw.endDate) return;
      this.checkConflicts.emit({
        participantEmployeeIds: ids,
        startDate: `${raw.startDate}T${raw.startTime}:00Z`,
        endDate: `${raw.endDate}T${raw.endTime}:00Z`
      });
    }, 400);
  }

  onSubmit(scope: RecurrenceEditScope | null = null): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const startDate = `${raw.startDate}T${raw.startTime}:00Z`;
    const endDate = `${raw.endDate}T${raw.endTime}:00Z`;
    const recurrence = raw.recurrenceFrequency ?? 'none';
    const recurrenceRule = buildRecurrenceRule(recurrence as RecurrenceFrequency, raw.recurrenceEndMode as RecurrenceEndMode, raw.recurrenceUntilDate || null);

    if (this.isEdit) {
      this.save.emit({
        update: {
          title: raw.title!.trim(), description: raw.description || null, startDate, endDate,
          isAllDay: !!raw.isAllDay, timezone: 'UTC', location: raw.location || null,
          meetingLink: raw.meetingLink || null, color: raw.color || null, recurrence
        },
        scope
      });
      return;
    }

    this.save.emit({
      create: {
        title: raw.title!.trim(), description: raw.description || null, startDate, endDate,
        isAllDay: !!raw.isAllDay, timezone: 'UTC', location: raw.location || null,
        meetingLink: raw.meetingLink || null, color: raw.color || null, recurrence,
        participantEmployeeIds: this.participantIds(), recurrenceRule
      }
    });
  }

  onDelete(scope: RecurrenceEditScope | null = null): void {
    this.delete.emit(scope);
  }
}
