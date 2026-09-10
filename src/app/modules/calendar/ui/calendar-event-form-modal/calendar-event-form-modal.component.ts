import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { SelectComponent } from '../../../../shared/ui/select/select.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { ConfirmModalComponent } from '../../../../shared/ui/confirm-modal/confirm-modal.component';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { localPartsToUtcIso, utcIsoToLocalParts } from '../../../../shared/utils/timezone.util';
import {
  CalendarConflict, CalendarEventParticipant, CalendarEventResponse, CreateCalendarEventRequest,
  EligibleNominee, RecurrenceEditScope, RespondToCalendarEventStatus, UpdateCalendarEventRequest
} from '../../models/calendar-event.model';
import { RecurrenceEndMode, RecurrenceFrequency, buildRecurrenceRule } from '../../utils/recurrence-rule.util';
import { CalendarParticipantPickerComponent } from '../calendar-participant-picker/calendar-participant-picker.component';
import { CalendarSelectComponent } from '../calendar-select/calendar-select.component';

/** Curated set of IANA zones for the "times entered in" picker. The organizer's own
 * tenant zone is always merged in on top of this so it can never be missing. */
const CURATED_TIMEZONES = [
  'UTC',
  'Asia/Colombo', 'Asia/Kolkata', 'Asia/Karachi', 'Asia/Dhaka', 'Asia/Kathmandu',
  'Asia/Dubai', 'Asia/Riyadh', 'Asia/Tehran', 'Asia/Jerusalem',
  'Asia/Singapore', 'Asia/Bangkok', 'Asia/Jakarta', 'Asia/Hong_Kong', 'Asia/Shanghai',
  'Asia/Tokyo', 'Asia/Seoul', 'Asia/Manila',
  'Australia/Perth', 'Australia/Sydney', 'Pacific/Auckland',
  'Europe/London', 'Europe/Berlin', 'Europe/Paris', 'Europe/Madrid', 'Europe/Moscow', 'Europe/Istanbul',
  'Africa/Cairo', 'Africa/Lagos', 'Africa/Johannesburg', 'Africa/Nairobi',
  'America/Sao_Paulo', 'America/New_York', 'America/Chicago', 'America/Denver',
  'America/Los_Angeles', 'America/Mexico_City', 'America/Bogota',
];

function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const total = ((h * 60 + m + minutes) % 1440 + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export type CalendarEventFormSubmission =
  | { create: CreateCalendarEventRequest }
  | { update: UpdateCalendarEventRequest; scope: RecurrenceEditScope | null };

export interface RespondToCalendarEventPayload {
  status: RespondToCalendarEventStatus;
  reason: string | null;
  nomineeEmployeeId: string | null;
}

@Component({
  selector: 'app-calendar-event-form-modal',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, ButtonComponent, InputComponent, SelectComponent,
    ModalComponent, DatePickerComponent, AvatarComponent, ConfirmModalComponent, CalendarParticipantPickerComponent,
    CalendarSelectComponent
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
  @Input() myTimezone = 'UTC';
  @Input() eligibleNominees: readonly EligibleNominee[] = [];
  @Output() save = new EventEmitter<CalendarEventFormSubmission>();
  @Output() delete = new EventEmitter<RecurrenceEditScope | null>();
  @Output() respond = new EventEmitter<RespondToCalendarEventPayload>();
  @Output() checkConflicts = new EventEmitter<{ participantEmployeeIds: readonly string[]; startDate: string; endDate: string }>();
  @Output() loadEligibleNominees = new EventEmitter<void>();
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
  readonly participants = signal<readonly { id: string; name: string }[]>([]);
  readonly maxParticipantChips = 6;
  readonly discardConfirmOpen = signal(false);

  /** Zone the typed start/end times are read in. Falls back to the organizer's tenant
   * zone (`myTimezone`) until the user explicitly picks one; changing it re-converts
   * (edit) or re-interprets (create) the times. */
  readonly pickedTimezone = signal('');
  readonly timezoneOptions = signal<readonly { value: string; label: string }[]>([]);
  private endTimeTouched = false;
  private timezoneTouched = false;

  /** The zone actually used for every local<->UTC conversion in this form. */
  currentTimezone(): string {
    return this.timezoneTouched && this.pickedTimezone() ? this.pickedTimezone() : this.myTimezone;
  }

  readonly moreMenuOpen = signal(false);
  readonly resolutionReasonPromptOpen = signal(false);
  readonly nomineePickerOpen = signal(false);
  readonly reasonText = signal('');
  readonly selectedNomineeId = signal<string | null>(null);

  readonly form = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    description: [''],
    startDate: ['', Validators.required],
    startTime: ['09:00', Validators.required],
    endDate: ['', Validators.required],
    endTime: ['09:30', Validators.required],
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

  onRespond(status: RespondToCalendarEventStatus, reason: string | null = null, nomineeEmployeeId: string | null = null): void {
    this.respond.emit({ status, reason, nomineeEmployeeId });
  }

  toggleMoreMenu(): void {
    const opening = !this.moreMenuOpen();
    this.moreMenuOpen.set(opening);
    if (opening) this.loadEligibleNominees.emit();
  }

  openResolutionPrompt(): void {
    this.moreMenuOpen.set(false);
    this.reasonText.set('');
    this.resolutionReasonPromptOpen.set(true);
  }

  cancelResolutionPrompt(): void {
    this.resolutionReasonPromptOpen.set(false);
  }

  setReasonText(value: string): void {
    this.reasonText.set(value);
  }

  submitResolutionRequest(): void {
    const reason = this.reasonText().trim();
    if (!reason) return;
    this.resolutionReasonPromptOpen.set(false);
    this.onRespond('ResolutionRequested', reason, null);
  }

  openNomineePicker(): void {
    this.moreMenuOpen.set(false);
    this.selectedNomineeId.set(this.eligibleNominees[0]?.employeeId ?? null);
    this.nomineePickerOpen.set(true);
  }

  cancelNomineePicker(): void {
    this.nomineePickerOpen.set(false);
  }

  setSelectedNomineeId(value: string): void {
    this.selectedNomineeId.set(value);
  }

  submitNomineeNomination(): void {
    const nomineeId = this.selectedNomineeId();
    if (!nomineeId) return;
    this.nomineePickerOpen.set(false);
    this.onRespond('ReplacementNominated', null, nomineeId);
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Only reset dirty/participant state when the modal is *freshly opened* for a new session -
    // this same input also toggles on every debounced conflict-check update while a create form
    // is mid-use, and resetting on every ngOnChanges call would wipe out in-progress typing.
    const justOpened = !!changes['open'] && this.open;

    if (justOpened) {
      this.endTimeTouched = false;
      this.timezoneTouched = false;
      this.pickedTimezone.set(this.myTimezone);
    }
    if (justOpened || changes['myTimezone']) {
      this.timezoneOptions.set(
        [...new Set([...CURATED_TIMEZONES, this.myTimezone])]
          .sort()
          .map((z) => ({ value: z, label: z.replace(/_/g, ' ') }))
      );
    }

    if (this.event) {
      const start = utcIsoToLocalParts(this.event.startDate, this.currentTimezone());
      const end = utcIsoToLocalParts(this.event.endDate, this.currentTimezone());
      this.form.patchValue({
        title: this.event.title,
        description: this.event.description ?? '',
        startDate: start.date,
        startTime: start.time,
        endDate: end.date,
        endTime: end.time,
        isAllDay: this.event.isAllDay,
        location: this.event.location ?? '',
        meetingLink: this.event.meetingLink ?? '',
        color: this.event.color ?? '#2563EB'
      });
      if (justOpened) this.form.markAsPristine();
      return;
    }

    if (this.prefillStart) {
      const [date, time] = this.prefillStart.split('T');
      const start = time ?? '09:00';
      this.form.patchValue({ startDate: date, startTime: start, endDate: date, endTime: addMinutes(start, 30) });
    }

    if (justOpened) {
      this.form.markAsPristine();
      this.participantIds.set([]);
      this.participants.set([]);
    }
  }

  setStartTime(value: string): void {
    this.form.controls.startTime.setValue(value);
    if (!this.endTimeTouched) this.form.controls.endTime.setValue(addMinutes(value, 30));
    this.form.markAsDirty();
  }

  setEndTime(value: string): void {
    this.endTimeTouched = true;
    this.form.controls.endTime.setValue(value);
    this.form.markAsDirty();
  }

  setTimezone(value: string): void {
    this.timezoneTouched = true;
    this.pickedTimezone.set(value);
    if (this.event) {
      // Edit mode: the stored instant is fixed - re-show it in the newly chosen zone.
      const start = utcIsoToLocalParts(this.event.startDate, value);
      const end = utcIsoToLocalParts(this.event.endDate, value);
      this.form.patchValue({ startDate: start.date, startTime: start.time, endDate: end.date, endTime: end.time });
    }
    this.form.markAsDirty();
    this.scheduleConflictCheck();
  }

  removeParticipant(id: string): void {
    this.participantIds.set(this.participantIds().filter((x) => x !== id));
    this.participants.set(this.participants().filter((p) => p.id !== id));
    this.form.markAsDirty();
    this.scheduleConflictCheck();
  }

  onParticipantPeopleChange(people: readonly { id: string; name: string }[]): void {
    this.participants.set(people);
  }

  setTitle(value: string): void {
    this.form.controls.title.setValue(value);
    this.form.markAsDirty();
  }

  setDescription(value: string): void {
    this.form.controls.description.setValue(value);
    this.form.markAsDirty();
  }

  setStartDate(value: string): void {
    this.form.controls.startDate.setValue(value);
    this.form.markAsDirty();
  }

  setEndDate(value: string): void {
    this.form.controls.endDate.setValue(value);
    this.form.markAsDirty();
  }

  setLocation(value: string): void {
    this.form.controls.location.setValue(value);
    this.form.markAsDirty();
  }

  setMeetingLink(value: string): void {
    this.form.controls.meetingLink.setValue(value);
    this.form.markAsDirty();
  }

  setRecurrenceFrequency(value: string): void {
    this.form.controls.recurrenceFrequency.setValue(value as RecurrenceFrequency);
    this.form.markAsDirty();
  }

  setRecurrenceUntilDate(value: string): void {
    this.form.controls.recurrenceUntilDate.setValue(value);
    this.form.markAsDirty();
  }

  openParticipantPicker(): void {
    this.participantPickerOpen.set(true);
  }

  private isDirty(): boolean {
    return this.form.dirty || this.participantIds().length > 0;
  }

  attemptClose(): void {
    if (this.isDirty()) {
      this.discardConfirmOpen.set(true);
      return;
    }
    this.cancel.emit();
  }

  confirmDiscard(): void {
    this.discardConfirmOpen.set(false);
    this.cancel.emit();
  }

  cancelDiscard(): void {
    this.discardConfirmOpen.set(false);
  }

  toggleAllDay(): void {
    this.form.controls.isAllDay.setValue(!this.form.controls.isAllDay.value);
    this.form.markAsDirty();
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
        startDate: localPartsToUtcIso(raw.startDate, raw.startTime!, this.currentTimezone()),
        endDate: localPartsToUtcIso(raw.endDate, raw.endTime!, this.currentTimezone())
      });
    }, 400);
  }

  onSubmit(scope: RecurrenceEditScope | null = null): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const startDate = localPartsToUtcIso(raw.startDate!, raw.startTime!, this.currentTimezone());
    const endDate = localPartsToUtcIso(raw.endDate!, raw.endTime!, this.currentTimezone());
    const recurrence = raw.recurrenceFrequency ?? 'none';
    const recurrenceRule = buildRecurrenceRule(recurrence as RecurrenceFrequency, raw.recurrenceEndMode as RecurrenceEndMode, raw.recurrenceUntilDate || null);

    if (this.isEdit) {
      this.save.emit({
        update: {
          title: raw.title!.trim(), description: raw.description || null, startDate, endDate,
          isAllDay: !!raw.isAllDay, location: raw.location || null,
          meetingLink: raw.meetingLink || null, color: raw.color || null, recurrence
        },
        scope
      });
      return;
    }

    this.save.emit({
      create: {
        title: raw.title!.trim(), description: raw.description || null, startDate, endDate,
        isAllDay: !!raw.isAllDay, location: raw.location || null,
        meetingLink: raw.meetingLink || null, color: raw.color || null, recurrence,
        participantEmployeeIds: this.participantIds(), recurrenceRule
      }
    });
  }

  onDelete(scope: RecurrenceEditScope | null = null): void {
    this.delete.emit(scope);
  }

  formatOverlap(start: string, end: string): string {
    const formatter = new Intl.DateTimeFormat(undefined, {
      timeZone: this.currentTimezone(), hour: 'numeric', minute: '2-digit', hour12: true
    });
    return `from ${formatter.format(new Date(start))} to ${formatter.format(new Date(end))}`;
  }
}
