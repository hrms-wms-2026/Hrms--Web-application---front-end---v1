import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
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
  EligibleNominee, MeetingProvider, RecurrenceEditScope, RespondToCalendarEventStatus, UpdateCalendarEventRequest
} from '../../models/calendar-event.model';
import { RecurrenceEndMode, RecurrenceFrequency, buildRecurrenceRule } from '../../utils/recurrence-rule.util';
import { CalendarEventAttendanceComponent } from '../calendar-event-attendance/calendar-event-attendance.component';
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

/** Adds whole days to a 'YYYY-MM-DD' string via UTC calendar-date arithmetic, so it never shifts
 * across a local-timezone DST boundary the way constructing a plain `new Date(dateStr)` would. */
function addDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;
}

/** Matches the backend's CalendarEventValidation.IsValidMeetingLink: blank is fine (the field is
 * optional), but a non-blank value must be an absolute http(s) URL - catches a pasted room name,
 * a bare domain with no scheme, or a non-http scheme like javascript:/data: before it's saved. */
const meetingLinkValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = (control.value ?? '').trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? null : { invalidMeetingLink: true };
  } catch {
    return { invalidMeetingLink: true };
  }
};

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
    CommonModule, ReactiveFormsModule, RouterLink, ButtonComponent, InputComponent, SelectComponent,
    ModalComponent, DatePickerComponent, AvatarComponent, ConfirmModalComponent, CalendarParticipantPickerComponent,
    CalendarSelectComponent, CalendarEventAttendanceComponent
  ],
  templateUrl: './calendar-event-form-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalendarEventFormModalComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);

  @Input() open = false;
  @Input() event: CalendarEventResponse | null = null;
  @Input() prefillStart: string | null = null;
  @Input() prefillEnd: string | null = null;
  @Input() saving = false;
  @Input() conflicts: readonly CalendarConflict[] = [];
  @Input() checkingConflicts = false;
  @Input() myTimezone = 'UTC';
  @Input() eligibleNominees: readonly EligibleNominee[] = [];
  /** Whether the organizer has an active Microsoft connection that can host a Teams meeting. */
  @Input() hasTeamsCapableConnection = false;
  /** Whether the organizer has an active Zoom connection that can host a Zoom meeting. */
  @Input() hasZoomCapableConnection = false;
  @Input() meetingActionSaving = false;
  @Output() save = new EventEmitter<CalendarEventFormSubmission>();
  @Output() delete = new EventEmitter<RecurrenceEditScope | null>();
  @Output() respond = new EventEmitter<RespondToCalendarEventPayload>();
  @Output() checkConflicts = new EventEmitter<{ participantEmployeeIds: readonly string[]; startDate: string; endDate: string }>();
  @Output() loadEligibleNominees = new EventEmitter<void>();
  @Output() addMeeting = new EventEmitter<MeetingProvider>();
  @Output() removeMeeting = new EventEmitter<void>();
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
  readonly maxParticipantAvatars = 6;
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
    meetingLink: ['', meetingLinkValidator],
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
      // Stored all-day end is the day AFTER the last day, at 00:00 (exclusive) - show the last
      // day the event actually covers, matching what onSubmit sends back if left unchanged.
      const endDateDisplay = this.event.isAllDay ? addDays(end.date, -1) : end.date;
      this.form.patchValue({
        title: this.event.title,
        description: this.event.description ?? '',
        startDate: start.date,
        startTime: start.time,
        endDate: endDateDisplay,
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
      const [endDate, endTime] = this.prefillEnd?.split('T') ?? [];
      this.form.patchValue({
        startDate: date,
        startTime: start,
        endDate: endDate || date,
        endTime: endTime || addMinutes(start, 30)
      });
      // a dragged range set the end explicitly - don't let a later start-time nudge override it
      this.endTimeTouched = !!this.prefillEnd;
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
      const endDateDisplay = this.event.isAllDay ? addDays(end.date, -1) : end.date;
      this.form.patchValue({ startDate: start.date, startTime: start.time, endDate: endDateDisplay, endTime: end.time });
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
    // markAsDirty only walks UP to ancestors, never down to children - form.markAsDirty() alone
    // never marks this specific control dirty, so the invalid-link error below never showed.
    this.form.controls.meetingLink.markAsDirty();
  }

  /** An auto-generated join link is always a real teams.microsoft.com or *.zoom.us URL - using
   * that as the "was this attached via Add Teams/Zoom meeting, not typed in" signal avoids
   * needing a separate flag threaded through the event API just for this display choice. */
  isAutoGeneratedMeetingLink(): boolean {
    const value = this.form.controls.meetingLink.value ?? '';
    return /^https:\/\/teams\.microsoft\.com\//i.test(value) || /^https:\/\/([a-z0-9-]+\.)?zoom\.us\//i.test(value);
  }

  onAddMeeting(provider: MeetingProvider): void {
    this.addMeeting.emit(provider);
  }

  onRemoveMeeting(): void {
    this.removeMeeting.emit();
  }

  /** Gates the Attendance section - attendance is only ever meaningful once the meeting has
   * actually happened, and TeamsAttendanceSyncJob itself only starts polling after the event's
   * end time has passed. */
  hasEventEnded(): boolean {
    return !!this.event && new Date(this.event.endDate).getTime() < Date.now();
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
    // toggleAllDay only flips the isAllDay flag - it never touches startTime/endTime, so without
    // this the stored range stayed whatever narrow window was in the time pickers (e.g.
    // 11:30-13:00) even with "All day" on, meaning the event never actually blocked the rest of
    // that day for availability/conflict checks.
    //
    // The stored end is the day AFTER the last day the user picked, at 00:00 (exclusive) - the
    // same convention Google/Outlook all-day events already use when pulled in, so a manually
    // created all-day event lines up with a synced one instead of ending 1 minute before midnight.
    const startTime = raw.isAllDay ? '00:00' : raw.startTime!;
    const endTime = raw.isAllDay ? '00:00' : raw.endTime!;
    const endDateOnly = raw.isAllDay ? addDays(raw.endDate!, 1) : raw.endDate!;
    const startDate = localPartsToUtcIso(raw.startDate!, startTime, this.currentTimezone());
    const endDate = localPartsToUtcIso(endDateOnly, endTime, this.currentTimezone());
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
