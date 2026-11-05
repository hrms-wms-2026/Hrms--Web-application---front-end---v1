import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, OnDestroy, Output, SimpleChanges, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { ConfirmModalComponent } from '../../../../shared/ui/confirm-modal/confirm-modal.component';
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';
import { DateRangePickerComponent } from '../../../../shared/ui/date-range-picker/date-range-picker.component';
import { TimePickerComponent } from '../../../../shared/ui/time-picker/time-picker.component';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { AvatarStackComponent, AvatarStackMember } from '../../../../shared/ui/avatar-stack/avatar-stack.component';
import { DirtyFormHandle, UnsavedChangesService } from '../../../../shared/services/unsaved-changes.service';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { localPartsToUtcIso, utcIsoToLocalParts } from '../../../../shared/utils/timezone.util';
import {
  CalendarConflict, CalendarEventParticipant, CalendarEventResponse, CreateCalendarEventRequest,
  EligibleNominee, MeetingProvider, RecurrenceEditScope, RespondToCalendarEventStatus, UpdateCalendarEventRequest
} from '../../models/calendar-event.model';
import { RecurrenceEndMode, RecurrenceFrequency, buildRecurrenceRule } from '../../utils/recurrence-rule.util';
import { EventDraft, eventInstants } from '../../utils/event-draft';
import { CalendarEventAttendanceComponent } from '../calendar-event-attendance/calendar-event-attendance.component';
import { CalendarEventMeetingStatusComponent } from '../calendar-event-meeting-status/calendar-event-meeting-status.component';
import { CalendarParticipantPickerComponent } from '../calendar-participant-picker/calendar-participant-picker.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { timezoneDisplayLabel } from '../../../../shared/utils/timezone-label.util';

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

const EMPTY_FORM_VALUES = {
  title: '',
  description: '',
  startDate: '',
  startTime: '09:00',
  endDate: '',
  endTime: '09:30',
  isAllDay: false,
  location: '',
  meetingLink: '',
  color: '#2563EB',
  recurrenceFrequency: 'none' as RecurrenceFrequency,
  recurrenceEndMode: 'never' as RecurrenceEndMode,
  recurrenceUntilDate: ''
};

export type CalendarEventFormSubmission =
  | { create: CreateCalendarEventRequest; meetingProvider: MeetingProvider | null }
  | { update: UpdateCalendarEventRequest; scope: RecurrenceEditScope | null };

export interface RespondToCalendarEventPayload {
  status: RespondToCalendarEventStatus;
  reason: string | null;
  nomineeEmployeeId: string | null;
}

/** One row of the participants dropdown's "Added" section / one avatar in the stack. */
interface AddedPerson {
  readonly key: string;
  readonly name: string;
  readonly kind: 'participant' | 'guest' | 'organizer' | 'existing' | 'existing-guest';
  readonly status?: string;
}

@Component({
  selector: 'app-calendar-event-form-modal',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, RouterLink, ButtonComponent,
    ModalComponent, DatePickerComponent, DateRangePickerComponent, TimePickerComponent, AvatarComponent, AvatarStackComponent, ConfirmModalComponent, CalendarParticipantPickerComponent,
    SelectComponent, CalendarEventAttendanceComponent, CalendarEventMeetingStatusComponent
  ],
  templateUrl: './calendar-event-form-modal.component.html',
  styles: [`
    /* Stretch the shared range picker to a full-width form field, matching the project form. */
    :host ::ng-deep .event-date-range app-date-range-picker { display: block; width: 100%; }
    :host ::ng-deep .event-date-range .drp-container { display: flex; width: 100%; }
    :host ::ng-deep .event-date-range .drp-trigger { width: 100%; min-height: 2.25rem; justify-content: flex-start; gap: 0.5rem; font-size: 0.875rem; font-weight: 500; }
    /* Title/description: rounded bordered boxes. Resting = light border (the description in the mockup);
       clicked/typing = the "Add title" look - a stronger border, no hover gray. */
    .event-text-field {
      width: 100%; border: 1px solid var(--color-border); border-radius: 10px; padding: 9px 16px; background: var(--color-surface);
      color: var(--color-text-primary); outline: none; transition: background-color 140ms ease, border-color 150ms ease;
    }
    .event-text-field::placeholder { color: var(--color-text-secondary); font-weight: 400; }
    .event-text-field:hover:not(:focus) { background: var(--color-surface-secondary); }
    .event-text-field:focus { border-color: color-mix(in srgb, var(--color-text-secondary) 55%, var(--color-border)); background: var(--color-surface); }
    /* Participants / meeting / location rows: borderless, the whole row (icon included) turns gray on hover
       and shows a thin border while you're working in it - same feel as the title above. */
    .event-hover-row {
      margin: 0 -8px; padding: 0 8px; border: 1px solid transparent; border-radius: 10px;
      transition: background-color 140ms ease, border-color 150ms ease;
    }
    .event-hover-row:hover:not(:focus-within):not(.event-hover-row--active) { background: var(--color-surface-secondary); }
    /* active = the same look as a clicked title field */
    .event-hover-row:focus-within, .event-hover-row--active { border-color: color-mix(in srgb, var(--color-text-secondary) 55%, var(--color-border)); }

    .event-inline-link { border-radius: 0.25rem; padding: 0.125rem 0.25rem; color: var(--color-text-secondary); }
    .event-inline-link:hover { background: var(--color-surface-secondary); color: var(--color-text-primary); }
    .event-row-icon { display: inline-flex; width: 1.25rem; flex-shrink: 0; justify-content: center; color: var(--color-text-secondary); }
    .event-chip__remove { font-size: 1rem; line-height: 1; color: var(--color-text-secondary); }
    .event-chip__remove:hover { color: var(--color-danger); }
    .event-select-trigger {
      display: flex; width: 100%; height: 2.5rem; align-items: center; justify-content: space-between; gap: 0.5rem;
      border: 0; background: transparent; padding: 0; text-align: left; font-size: 0.875rem;
    }
    .event-menu-item {
      width: 100%; border-radius: 0.25rem; padding: 0.375rem 0.625rem; text-align: left; font-size: 0.875rem;
      color: var(--color-text-primary);
    }
    .event-menu-item:hover:not(:disabled) { background: var(--color-surface-secondary); }
    .event-menu-item:disabled { opacity: 0.5; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalendarEventFormModalComponent implements OnChanges, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly unsaved = inject(UnsavedChangesService);

  @Input() open = false;
  @Input() event: CalendarEventResponse | null = null;
  @Input() prefillStart: string | null = null;
  @Input() prefillEnd: string | null = null;
  /** Everything the Planner create popover's Event tab held ("More options"); wins over prefillStart/prefillEnd. */
  @Input() prefill: EventDraft | null = null;
  @Input() saving = false;
  @Input() conflicts: readonly CalendarConflict[] = [];
  @Input() checkingConflicts = false;
  @Input() myTimezone = 'UTC';
  @Input() set eligibleNominees(value: readonly EligibleNominee[]) {
    this._eligibleNominees = value;
    this.nomineeOptions = value.map((n) => ({ value: n.employeeId, label: n.employeeName }));
  }
  get eligibleNominees(): readonly EligibleNominee[] {
    return this._eligibleNominees;
  }
  private _eligibleNominees: readonly EligibleNominee[] = [];
  /** Options for the nominee dropdown, rebuilt only when the input changes. */
  nomineeOptions: readonly SelectOption[] = [];
  /** Whether the organizer has an active Microsoft connection that can host a Teams meeting. */
  @Input() hasTeamsCapableConnection = false;
  /** Whether the organizer has an active Zoom connection that can host a Zoom meeting. */
  @Input() hasZoomCapableConnection = false;
  @Input() meetingActionSaving = false;
  /** Meetings-as-tasks on: a new event cannot carry people or a link; it hands over to the Meeting (work item) form. */
  @Input() meetingsAsWorkItems = false;
  @Output() save = new EventEmitter<CalendarEventFormSubmission>();
  @Output() delete = new EventEmitter<RecurrenceEditScope | null>();
  @Output() respond = new EventEmitter<RespondToCalendarEventPayload>();
  @Output() checkConflicts = new EventEmitter<{
    participantEmployeeIds: readonly string[]; startDate: string; endDate: string; isAllDay: boolean; timeZone: string;
  }>();
  @Output() loadEligibleNominees = new EventEmitter<void>();
  @Output() addMeeting = new EventEmitter<MeetingProvider>();
  @Output() removeMeeting = new EventEmitter<void>();
  @Output() meetingStatusChanged = new EventEmitter<void>();
  @Output() addParticipantsToEvent = new EventEmitter<readonly string[]>();
  @Output() removeExistingParticipant = new EventEmitter<string>();
  @Output() addGuestsToEvent = new EventEmitter<readonly string[]>();
  @Output() removeExistingGuest = new EventEmitter<string>();
  @Output() cancelled = new EventEmitter<void>();
  @Output() convertToMeeting = new EventEmitter<{ title: string; start: string; end: string }>();

  private readonly authStore = inject(AuthStore);
  private conflictCheckTimer: ReturnType<typeof setTimeout> | null = null;

  readonly recurrenceOptions = [
    { value: 'none', label: 'Does not repeat' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' }
  ];

  readonly participantPickerOpen = signal(false);
  /** Text typed in the participants search bar - drives the picker's directory search and guest invite. */
  readonly participantSearch = signal('');
  /** What the participants dropdown shows: 'added' (clicked the avatar stack - who's already on the event)
   * or 'search' (clicked/typed in the search bar - the directory to pick from). Never both at once. */
  readonly participantPanelMode = signal<'search' | 'added'>('search');
  @ViewChild('pickerPanel') private pickerPanel?: ElementRef<HTMLElement>;
  @ViewChild('meetingMenu') private meetingMenu?: ElementRef<HTMLElement>;
  readonly meetingMenuOpen = signal(false);
  /** Timezone and Repeat read as plain text ("Asia/Colombo (GMT+05:30) · Does not repeat") until clicked,
   * which swaps that one in for its dropdown, already open. */
  readonly inlineEditor = signal<'timezone' | 'repeat' | null>(null);
  @ViewChild('timezoneSelect') private timezoneSelect?: SelectComponent;
  @ViewChild('repeatSelect') private repeatSelect?: SelectComponent;
  /** The user chose "Paste a meeting link" - shows the free-text link field even while it's still empty. */
  readonly manualMeetingLink = signal(false);
  readonly participantIds = signal<readonly string[]>([]);
  readonly participants = signal<readonly { id: string; name: string }[]>([]);
  readonly maxParticipantAvatars = 6;
  /** Guest emails picked in the participant picker, not yet saved to the event. */
  readonly guestEmails = signal<readonly string[]>([]);
  readonly discardConfirmOpen = signal(false);
  /** Teams/Zoom provider picked while creating a new event - the meeting can't actually be
   * created until the event itself has a real id, so this is just intent, resolved into a
   * `createMeeting` call by the parent once `save` returns the new event's id. */
  readonly pendingMeetingProvider = signal<MeetingProvider | null>(null);

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

  onConvertToMeeting(): void {
    const v = this.form.getRawValue();
    this.convertToMeeting.emit({ title: (v.title ?? '').trim(), start: `${v.startDate}T${v.startTime}`, end: `${v.endDate}T${v.endTime}` });
  }

  get isEdit(): boolean {
    return !!this.event;
  }

  viewerParticipant(): CalendarEventParticipant | null {
    const employeeId = this.authStore.employeeId();
    if (!employeeId || !this.event?.participants) return null;
    return this.event.participants.find((p) => p.employeeId === employeeId) ?? null;
  }

  /** The organizer chip, only on an existing event: "You" if the server says the viewer owns it, else the
   * organizer by name (absent when the API sent none). A new event shows none - the creator isn't a
   * participant unless they pick themselves in the picker, where they're listed first. */
  organizerRow(): { name: string; isYou: boolean } | null {
    if (!this.event) return null;
    if (this.event.isOrganizer) return { name: this.event.organizerName ?? 'You', isYou: true };
    return this.event.organizerName ? { name: this.event.organizerName, isYou: false } : null;
  }

  /** Only the organizer can add/remove participants (the backend rejects anyone else). The server
   * flag decides; an event that doesn't carry it keeps the controls. */
  canManageParticipants(): boolean {
    return this.event?.isOrganizer !== false;
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

  ngOnDestroy(): void {
    this.unregisterGuard?.();
    this.unregisterGuard = null;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']) {
      if (this.open && !this.unregisterGuard) {
        this.unregisterGuard = this.unsaved.register(this.guardHandle);
      } else if (!this.open && this.unregisterGuard) {
        this.unregisterGuard();
        this.unregisterGuard = null;
      }
    }

    // Only reset dirty/participant state when the modal is *freshly opened* for a new session -
    // this same input also toggles on every debounced conflict-check update while a create form
    // is mid-use, and resetting on every ngOnChanges call would wipe out in-progress typing.
    const justOpened = !!changes['open'] && this.open;

    if (justOpened) {
      // The modal instance is reused across sessions, so without this a new event opened with the previous event's values.
      this.form.reset(EMPTY_FORM_VALUES);
      this.endTimeTouched = false;
      this.timezoneTouched = false;
      this.pickedTimezone.set(this.myTimezone);
      this.pendingMeetingProvider.set(null);
      this.meetingMenuOpen.set(false);
      this.manualMeetingLink.set(false);
      this.inlineEditor.set(null);
      // Cleared for both edit and create: this is the participant *picker's* staging state
      // (who's checked in the "Add participants" modal before it's submitted), not the event's
      // actual saved participants - carrying over a previous session's picks (e.g. from create
      // mode) made the picker show unrelated people as pre-selected the next time it opened.
      this.participantIds.set([]);
      this.participants.set([]);
      this.guestEmails.set([]);
      this.participantSearch.set('');
    }
    if (justOpened || changes['myTimezone']) {
      this.timezoneOptions.set(
        [...new Set([...CURATED_TIMEZONES, this.myTimezone])]
          .sort()
          .map((z) => ({ value: z, label: timezoneDisplayLabel(z) }))
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

    // Applied once, on open or when a new draft arrives: later input changes must not overwrite what was typed.
    if (this.prefill && (justOpened || changes['prefill'])) {
      const p = this.prefill;
      const [startDate, startTime] = p.start.split('T');
      const [endDate, endTime] = p.end.split('T');
      this.form.patchValue({
        title: p.title, description: p.description ?? '', startDate, startTime, endDate, endTime,
        isAllDay: p.isAllDay, location: p.location ?? '', recurrenceFrequency: p.repeat
      });
      this.setTimezone(p.timezone);
      this.endTimeTouched = true;
    }

    if (justOpened) {
      this.form.markAsPristine();
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

  setDateRange(range: { from: string; to: string }): void {
    this.form.patchValue({ startDate: range.from, endDate: range.to });
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

  timezoneLabel(): string {
    return timezoneDisplayLabel(this.currentTimezone());
  }

  repeatLabel(): string {
    const value = this.form.controls.recurrenceFrequency.value ?? 'none';
    return this.recurrenceOptions.find((o) => o.value === value)?.label ?? 'Does not repeat';
  }

  /** Deferred a tick so the dropdown exists, and so this same click doesn't reach its outside-click close. */
  openInlineEditor(editor: 'timezone' | 'repeat'): void {
    this.inlineEditor.set(editor);
    setTimeout(() => (editor === 'timezone' ? this.timezoneSelect : this.repeatSelect)?.openPanel());
  }

  closeInlineEditor(): void {
    this.inlineEditor.set(null);
  }

  /** A typed (not Teams/Zoom-generated) link already on the event, or the user picked "Paste a meeting link". */
  showMeetingLinkInput(): boolean {
    return this.manualMeetingLink() || !!(this.form.controls.meetingLink.value ?? '').trim();
  }

  toggleMeetingMenu(): void {
    this.meetingMenuOpen.update((open) => !open);
  }

  /** Escape closes just the menu; without stopping it the modal's own Escape handler would also close the form. */
  onMeetingMenuEscape(event: Event): void {
    if (!this.meetingMenuOpen()) return;
    event.stopPropagation();
    this.meetingMenuOpen.set(false);
  }

  /** Editing attaches the meeting straight away; creating only records the choice until the event exists. */
  chooseMeetingProvider(provider: MeetingProvider): void {
    this.meetingMenuOpen.set(false);
    if (this.isEdit) this.onAddMeeting(provider);
    else this.selectPendingMeeting(provider);
  }

  startManualMeetingLink(): void {
    this.meetingMenuOpen.set(false);
    this.manualMeetingLink.set(true);
  }

  clearMeetingLink(): void {
    this.setMeetingLink('');
    this.manualMeetingLink.set(false);
  }

  onAddMeeting(provider: MeetingProvider): void {
    this.addMeeting.emit(provider);
  }

  selectPendingMeeting(provider: MeetingProvider): void {
    this.pendingMeetingProvider.set(provider);
    this.form.markAsDirty();
  }

  clearPendingMeeting(): void {
    this.pendingMeetingProvider.set(null);
  }

  onRemoveMeeting(): void {
    this.removeMeeting.emit();
  }

  readonly linkCopyState = signal<'idle' | 'copied' | 'failed'>('idle');
  private linkCopyTimer: ReturnType<typeof setTimeout> | null = null;

  async copyMeetingLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.form.controls.meetingLink.value ?? '');
      this.linkCopyState.set('copied');
    } catch {
      this.linkCopyState.set('failed');
    }
    if (this.linkCopyTimer) clearTimeout(this.linkCopyTimer);
    this.linkCopyTimer = setTimeout(() => this.linkCopyState.set('idle'), 2000);
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

  /** Clicking anywhere outside the picker panel and its "+"/"Add participants" triggers closes it (submitting
   * picks in edit mode); the same goes for the meeting menu. composedPath is used because the clicked row may
   * already be re-rendered away by the time this document listener runs. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const path = event.composedPath();
    if (this.meetingMenuOpen() && !(this.meetingMenu && path.includes(this.meetingMenu.nativeElement))) {
      this.meetingMenuOpen.set(false);
    }
    if (!this.participantPickerOpen()) return;
    const insidePanel = !!this.pickerPanel && path.includes(this.pickerPanel.nativeElement);
    const onTrigger = path.some((node) => node instanceof HTMLElement && node.hasAttribute('data-picker-trigger'));
    if (insidePanel || onTrigger) return;
    this.onParticipantPickerClosed();
  }


  /** Short length of the event shown beside the times, e.g. "30m", "1h 15m", "2d 3h"; empty when the range is invalid. */
  durationLabel(): string {
    const raw = this.form.getRawValue();
    if (!raw.startDate || !raw.endDate || !raw.startTime || !raw.endTime) return '';
    const start = Date.parse(`${raw.startDate}T${raw.startTime}:00Z`);
    const end = Date.parse(`${raw.endDate}T${raw.endTime}:00Z`);
    const minutes = Math.round((end - start) / 60000);
    if (!Number.isFinite(minutes) || minutes <= 0) return '';
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    const mins = minutes % 60;
    return [days && `${days}d`, hours && `${hours}h`, mins && `${mins}m`].filter(Boolean).join(' ');
  }

  /** Clicking anywhere in the participants box (not on one of its buttons) opens the picker. */
  onParticipantBoxClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target.closest('button')) return;
    const onStack = !!target.closest('[data-testid="calendar-form-participant-stack"]');
    const canPick = !this.isEdit || this.canManageParticipants();
    this.participantPanelMode.set(onStack || !canPick ? 'added' : 'search');
    this.openParticipantPickerIfClosed();
  }

  onParticipantSearchFocus(): void {
    this.participantPanelMode.set('search');
    this.openParticipantPickerIfClosed();
  }

  setParticipantSearch(value: string): void {
    this.participantSearch.set(value);
    this.participantPanelMode.set('search');
    if (!this.participantPickerOpen()) this.openParticipantPicker();
  }

  /** Everyone on the event, as one list: the avatar stack shows the first few, the dropdown's
   * "Added" section lists them all. Creating: the people/guests picked so far. Editing: the organizer,
   * the saved participants (with their response) and guests. */
  addedPeople(): readonly AddedPerson[] {
    if (!this.isEdit) {
      return [
        ...this.participants().map((p): AddedPerson => ({ key: p.id, name: p.name || 'Unknown', kind: 'participant' })),
        ...this.guestEmails().map((g): AddedPerson => ({ key: g, name: g, kind: 'guest' }))
      ];
    }
    const organizer = this.organizerRow();
    return [
      ...(organizer ? [{ key: 'organizer', name: organizer.isYou ? 'You' : organizer.name, kind: 'organizer' } as AddedPerson] : []),
      ...(this.event?.participants ?? []).map((p): AddedPerson => ({ key: p.employeeId, name: p.employeeName, kind: 'existing', status: p.responseStatus })),
      ...(this.event?.guests ?? []).map((g): AddedPerson => ({ key: g.email, name: g.email, kind: 'existing-guest' }))
    ];
  }

  addedRowTestId(person: AddedPerson): string {
    const ids: Record<AddedPerson['kind'], string> = {
      participant: 'calendar-form-participant-row',
      guest: 'calendar-form-guest-row',
      organizer: 'calendar-form-organizer',
      existing: 'calendar-form-existing-participant',
      'existing-guest': 'calendar-form-existing-guest'
    };
    return ids[person.kind];
  }

  openParticipantPickerIfClosed(): void {
    if (!this.participantPickerOpen()) this.openParticipantPicker();
  }

  stackMembers(): AvatarStackMember[] {
    return this.addedPeople().map((p) => ({ userId: p.key, displayName: p.name }));
  }

  /** Escape closes just the dropdown; without stopping it the modal's own Escape handler would also close (and discard) the event form. */
  onParticipantPickerEscape(event: Event): void {
    if (!this.participantPickerOpen()) return;
    event.stopPropagation();
    this.onParticipantPickerClosed();
  }

  openParticipantPicker(): void {
    this.participantPickerOpen.set(true);
    setTimeout(() => this.pickerPanel?.nativeElement.scrollIntoView?.({ block: 'nearest' }));
  }

  /** In edit mode the picker adds straight to the saved event (there's no pending "create"
   * payload to attach the selection to) - closing it with a selection present submits that
   * selection immediately and clears the picker's local staging state. */
  onParticipantPickerClosed(): void {
    this.participantPickerOpen.set(false);
    this.participantSearch.set('');
    if (this.isEdit && this.participantIds().length > 0) {
      this.addParticipantsToEvent.emit(this.participantIds());
      this.participantIds.set([]);
      this.participants.set([]);
    }
    if (this.isEdit && this.guestEmails().length > 0) {
      this.addGuestsToEvent.emit(this.guestEmails());
      this.guestEmails.set([]);
    }
  }

  onGuestEmailsChange(emails: readonly string[]): void {
    // a guest is invited straight from the typed email - clear it so the box is ready for the next one
    if (emails.length > this.guestEmails().length) this.participantSearch.set('');
    this.guestEmails.set(emails);
  }

  removeGuest(email: string): void {
    this.guestEmails.set(this.guestEmails().filter((g) => g !== email));
  }

  onRemoveExistingGuest(email: string): void {
    this.removeExistingGuest.emit(email);
  }

  onRemoveExistingParticipant(employeeId: string): void {
    this.removeExistingParticipant.emit(employeeId);
  }

  private isDirty(): boolean {
    return this.form.dirty || this.participantIds().length > 0 || this.guestEmails().length > 0;
  }

  /** Calendar events have no draft storage - the shared dialog only offers Discard / Keep editing. */
  private readonly guardHandle: DirtyFormHandle = {
    isDirty: () => this.isDirty(),
    canSaveDraft: () => false,
    saveDraft: async () => false,
    discard: () => {}
  };
  private unregisterGuard: (() => void) | null = null;

  attemptClose(): void {
    if (this.isDirty()) {
      this.discardConfirmOpen.set(true);
    }
    void this.unsaved.requestClose(this.guardHandle).then((ok) => {
      if (ok) this.cancelled.emit();
    });
  }

  confirmDiscard(): void {
    this.discardConfirmOpen.set(false);
    this.cancelled.emit();
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
        endDate: localPartsToUtcIso(raw.endDate, raw.endTime!, this.currentTimezone()),
        isAllDay: !!raw.isAllDay,
        timeZone: this.currentTimezone()
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
    const { startDate, endDate } = eventInstants(`${raw.startDate}T${raw.startTime}`, `${raw.endDate}T${raw.endTime}`,
      !!raw.isAllDay, this.currentTimezone());
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
        participantEmployeeIds: this.participantIds(), recurrenceRule, guestEmails: this.guestEmails(),
        pendingMeetingProvider: this.pendingMeetingProvider()
      },
      meetingProvider: this.pendingMeetingProvider()
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
