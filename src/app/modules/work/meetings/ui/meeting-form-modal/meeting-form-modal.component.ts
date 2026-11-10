import { ConnectionPositionPair, OverlayModule } from '@angular/cdk/overlay';
import { NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { MeetingCreatedEvent } from '../../utils/meeting-created-drawer.util';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, WritableSignal, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom, merge } from 'rxjs';
import { AuthStore } from '../../../../../core/auth/state/auth.store';
import { NotificationService } from '../../../../../core/services/notification.service';
import { CalendarEventApiService } from '../../../../calendar/data-access/calendar-event-api.service';
import { CalendarConflict } from '../../../../calendar/models/calendar-event.model';
import { AvailabilityWarningsComponent } from '../../../../calendar/ui/availability-warnings/availability-warnings.component';
import { AvatarComponent } from '../../../../../shared/ui/avatar/avatar.component';
import { DatePickerComponent } from '../../../../../shared/ui/date-picker/date-picker.component';
import { FieldIconComponent } from '../../../../../shared/ui/field-icon/field-icon.component';
import { ModalComponent } from '../../../../../shared/ui/modal/modal.component';
import { RichTextEditorComponent } from '../../../../../shared/ui/rich-text-editor/rich-text-editor.component';
import { SelectComponent, SelectOption } from '../../../../../shared/ui/select/select.component';
import { TimePickerComponent } from '../../../../../shared/ui/time-picker/time-picker.component';
import { CalendarParticipantPickerComponent } from '../../../../calendar/ui/calendar-participant-picker/calendar-participant-picker.component';
import { ProjectApiService } from '../../../data-access/project-api.service';
import { MeetingApiService } from '../../data-access/meeting-api.service';
import { MeetingPrincipalsStore } from '../../state/meeting-principals.store';
import {
  CreateMeetingRequest, EditMeetingRequest, MeetingEditResponse, MeetingOccurrenceResponse, MeetingPlatform,
  MeetingScope
} from '../../models/meeting.models';
import { meetingErrorMessage } from '../../utils/meeting-error-messages';
import { browserTimeZone, toOffsetIso, toZonedParts } from '../../utils/meeting-time';
import { RECURRENCE_PRESET_LABELS, RecurrencePreset, recurrencePresets } from '../../utils/recurrence-presets';
import { MeetingScopeDialogComponent } from '../meeting-scope-dialog/meeting-scope-dialog.component';
import { MeetingBulkInvitePanelComponent } from './meeting-bulk-invite-panel.component';

export interface MeetingPlacementInput { projectId: string | null; objectiveId: string | null; }
/**
 * What a calendar event handed over: its title and local start/end ('YYYY-MM-DDTHH:mm'), in `timezone` when given
 * (the Planner's zone), else the browser's.
 */
export interface MeetingPrefill { title: string; start: string; end: string; timezone?: string; isAllDay?: boolean; }
/** What the work item form had typed when its category turned to "meeting". */
export interface MeetingCarryOver { title: string; description: string | null; }
/** A saved edit, with the start it sent: after a split the occurrence lives at that start in the new series. */
export interface MeetingEditSaved extends MeetingEditResponse { sentStart: string | null; }
export type PlatformChoice = 'none' | MeetingPlatform;
interface MeetingFormValue {
  title: string; description: string | null; location: string; isPrivate: boolean; date: string; time: string;
  durationMinutes: number; isAllDay: boolean; timezone: string; recurrence: RecurrencePreset; customRule: string; platform: PlatformChoice;
}

/** The next half hour after `now`, as wall-clock date and time in `timeZone` (11:10 -> 11:30, 23:40 -> 00:00 tomorrow). */
function nextHalfHour(now: Date, timeZone: string): { date: string; time: string } {
  const { date, time } = toZonedParts(now.toISOString(), timeZone);
  const [hh, mm] = time.split(':').map(Number);
  const next = Math.floor((hh * 60 + mm) / 30) * 30 + 30;
  const [y, m, d] = date.split('-').map(Number);
  const day = new Date(Date.UTC(y, m - 1, d + Math.floor(next / 1440)));
  const minutes = next % 1440;
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${day.getUTCFullYear()}-${pad(day.getUTCMonth() + 1)}-${pad(day.getUTCDate())}`,
    time: `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`,
  };
}

/** 'HH:mm' to minutes after midnight; null when empty. */
function clockMinutes(clock: string): number | null {
  if (!clock) return null;
  const [h, m] = clock.split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
}

/** The people dropdown: under the field, flipping above it when there isn't room. */
const PEOPLE_POSITIONS: ConnectionPositionPair[] = [
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
];

const RELOADED = 'Someone else changed this meeting. We reloaded it - check and save again.';
const SERIES_ONLY = 'A repeat or time zone change applies to the series: choose this and following, or all.';

/** The one meeting form (spec D3): create from the calendar or a project's board, and edit an occurrence or its series. */
/** Why a picked person was not invited, in words (the server sends codes). */
const SKIPPED_REASONS: Record<string, string> = { inactive: 'no longer active', not_found: 'not found' };

@Component({
  selector: 'app-meeting-form-modal',
  standalone: true,
  imports: [NgTemplateOutlet, OverlayModule, ReactiveFormsModule, AvatarComponent, DatePickerComponent, FieldIconComponent, ModalComponent, RichTextEditorComponent,
    SelectComponent, TimePickerComponent, CalendarParticipantPickerComponent, MeetingBulkInvitePanelComponent, MeetingScopeDialogComponent, AvailabilityWarningsComponent],
  template: `
    <ng-template #formTpl>
      <form [formGroup]="form" class="mf" (ngSubmit)="save()">
        @if (mode() === 'create') {
          <div class="mf-grid">
            <div class="mf-field">
              <span class="mf-label">Project</span>
              <!-- "Office" is the tenant's Office project: a meeting with no other project still lands in a project. -->
              <app-select data-testid="meeting-project" icon="folder" ariaLabel="Project" [options]="projectOptions()"
                [value]="projectId() ?? ''" (valueChange)="selectProject($event)" />
            </div>
            <div class="mf-field">
              <span class="mf-label">Module</span>
              <app-select data-testid="meeting-module" icon="layers" ariaLabel="Module" placeholder="Choose a module"
                [options]="moduleOptions()" [value]="objectiveId() ?? ''" [disabled]="!projectId()"
                (valueChange)="objectiveId.set($event || null)" />
            </div>
          </div>
        } @else if (occurrence(); as occ) {
          <p class="mf-note">
            {{ occ.placement.isOffice ? 'Office' : occ.placement.projectName + ' / ' + occ.placement.moduleTitle }}
          </p>
        }

        @if (showOrganizer()) {
          <div class="mf-field">
            <span class="mf-label">Organizer</span>
            <!-- A meeting delegate schedules for a principal: invitees see the principal as the organizer. -->
            <app-select data-testid="meeting-organizer" icon="user" ariaLabel="Organizer" [searchable]="false"
              [options]="organizerOptions()" [value]="organizerChoice()" (valueChange)="organizerChoice.set($event)" />
          </div>
        }
        <label class="mf-field">
          <span class="mf-label">Meeting title</span>
          <input data-testid="meeting-title" formControlName="title" placeholder="Meeting title" class="ui-input" [readOnly]="notesOnly()" />
        </label>
        <app-rich-text-editor class="mf-agenda" [initialHtml]="form.controls.description.value ?? ''" ariaLabel="Agenda"
          placeholder="Add meeting agenda, discussion points or notes..." [compact]="true" [allowAttachments]="false"
          [allowImages]="false" (htmlChange)="onAgenda($event)" />

        @if (!notesOnly()) {
          <div class="mf-when">
            <div class="mf-field mf-field--tight mf-date">
              <span class="mf-label mf-label--sm">Date</span>
              <app-date-picker data-testid="meeting-date" ariaLabel="Date" [showClear]="false" [value]="values().date"
                (valueChange)="form.controls.date.setValue($event)" />
            </div>
            @if (!values().isAllDay) {
              <div class="mf-field mf-field--tight mf-time">
                <span class="mf-label mf-label--sm">Start</span>
                <app-time-picker data-testid="meeting-start" [value]="values().time" (valueChange)="form.controls.time.setValue($event)" />
              </div>
              <svg class="mf-arrow" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              <div class="mf-field mf-field--tight mf-time">
                <div class="mf-end-head">
                  <span class="mf-label mf-label--sm">End</span>
                  <span class="mf-duration" data-testid="meeting-duration">{{ durationLabel() }}</span>
                </div>
                <app-time-picker data-testid="meeting-end" [value]="endTime()" (valueChange)="setEndTime($event)" />
              </div>
            }
            <label class="mf-check"><input type="checkbox" formControlName="isAllDay" /> All day</label>
            <app-select class="mf-link" data-testid="meeting-recurrence" icon="repeat" ariaLabel="Repeat" placeholder="Repeat" [searchable]="false"
              [options]="recurrenceOptions()" [value]="values().recurrence === 'none' ? null : values().recurrence"
              (valueChange)="setRecurrence($event)" />
            <app-select class="mf-link" data-testid="meeting-timezone" icon="globe" ariaLabel="Time zone" searchPlaceholder="Search time zones"
              [options]="timezoneOptions()" [value]="values().timezone" (valueChange)="form.controls.timezone.setValue($event)" />
          </div>
          @if (durationOutOfRange()) {
            <p data-testid="meeting-duration-invalid" role="alert" class="mf-error">A meeting runs from 15 minutes to 8 hours. Pick another end time.</p>
          }
          @if (values().recurrence === 'custom') {
            <input formControlName="customRule" placeholder="RRULE, e.g. FREQ=WEEKLY;BYDAY=MO,WE" aria-label="Custom repeat rule" class="ui-input" />
          }
          @if (!compact()) {
            <div class="mf-row">
              <span class="mf-label">Location</span>
              <div class="mf-inline">
                <input data-testid="meeting-location" formControlName="location" placeholder="Location" aria-label="Location" class="ui-input" />
                <label class="mf-check"><input type="checkbox" data-testid="meeting-private" formControlName="isPrivate" /> Private</label>
              </div>
            </div>
          }
        } @else {
          <p class="mf-note">This meeting has ended: only its notes can change.</p>
        }

        @if (mode() === 'create') {
          <div class="mf-row">
            <span class="mf-label">Platform</span>
            <app-select data-testid="meeting-platform" icon="video" ariaLabel="Platform" [searchable]="false" [options]="platformOptions"
              [value]="values().platform" (valueChange)="setPlatform($event)" />
          </div>
          <div class="mf-row mf-row--top">
            <span class="mf-label">Participants</span>
            <div class="mf-people">
              <div #peopleField class="ui-field" cdkOverlayOrigin #peopleOrigin="cdkOverlayOrigin">
                <span class="ui-field__addon" aria-hidden="true"><app-field-icon name="search" /></span>
                <input type="text" autocomplete="off" class="ui-field__control" data-testid="meeting-participants-search" aria-label="Participants"
                  placeholder="Search people, or type an email to invite a guest" [attr.aria-expanded]="peopleOpen()" [value]="peopleSearch()"
                  (focus)="openPeople()" (click)="openPeople()" (input)="onPeopleSearch($any($event.target).value)"
                  (keydown.enter)="$event.preventDefault()" (keydown.tab)="peopleOpen.set(false)" (keydown.escape)="closePeople($event)" />
              </div>
              @if (chosenPeople().length > 0 || guestEmails().length > 0 || unnamedPeople() > 0) {
                <div class="mf-chips">
                  @for (person of chosenPeople(); track person.id) {
                    <span class="mf-chip" data-testid="meeting-participant-chip">
                      <app-avatar size="xs" shape="circle" [userName]="person.name" />
                      <span class="mf-chip__name">{{ person.name }}</span>
                      <button type="button" class="mf-chip__remove" [attr.aria-label]="'Remove ' + person.name" (click)="removeParticipant(person.id)">&times;</button>
                    </span>
                  }
                  @for (guest of guestEmails(); track guest) {
                    <span class="mf-chip" data-testid="meeting-guest-chip">
                      <app-avatar size="xs" shape="circle" [userName]="guest" />
                      <span class="mf-chip__name">{{ guest }}</span>
                      <button type="button" class="mf-chip__remove" [attr.aria-label]="'Remove ' + guest" (click)="removeGuest(guest)">&times;</button>
                    </span>
                  }
                  @if (unnamedPeople() > 0) {
                    <span class="mf-chip mf-chip--count">+{{ unnamedPeople() }} more</span>
                  }
                </div>
              }
              @if (!compact()) {
                <app-meeting-bulk-invite-panel data-testid="meeting-bulk-invite" [projectId]="projectId()" [objectiveId]="objectiveId()"
                  [platform]="platformValue()" (added)="mergeParticipants($event)" />
              }
            </div>
          </div>
          <!-- In the CDK overlay: the Planner popover scrolls, and would clip a dropdown this low in the form. -->
          <ng-template cdkConnectedOverlay [cdkConnectedOverlayOrigin]="peopleOrigin" [cdkConnectedOverlayOpen]="peopleOpen()"
            [cdkConnectedOverlayPositions]="peoplePositions" [cdkConnectedOverlayWidth]="peopleWidth()" [cdkConnectedOverlayPush]="true"
            [cdkConnectedOverlayViewportMargin]="8" [cdkConnectedOverlayHasBackdrop]="true"
            cdkConnectedOverlayBackdropClass="cdk-overlay-transparent-backdrop" (backdropClick)="peopleOpen.set(false)" (detach)="peopleOpen.set(false)">
            <!-- A fixed height: the overlay places itself on open, before the results arrive. -->
            <div class="h-[17rem] w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5 shadow-lg" role="presentation"
              data-testid="meeting-participants-panel" (keydown.escape)="closePeople($event)">
              <app-calendar-participant-picker [open]="true" [search]="peopleSearch()" [selectedIds]="participantIds()" [guestEmails]="guestEmails()"
                (selectedIdsChange)="onParticipantsChange($event)" (selectedPeopleChange)="rememberNames($event)" (guestEmailsChange)="onGuestsChange($event)" />
            </div>
          </ng-template>
        }

        @if (mode() === 'create' && startInPast()) {
          <!-- Caught here, before the server refuses it (meeting_start_in_past). -->
          <p data-testid="meeting-start-past" role="alert" class="mf-error">
            This time has already passed. Pick a later start.
          </p>
        }

        @if (!notesOnly()) {
          <app-availability-warnings [conflicts]="availability()" [checking]="checkingAvailability()"
            [repeating]="form.controls.recurrence.value !== 'none'" [timezone]="form.controls.timezone.value" />
        }

        <div class="mf-footer" [class.mf-footer--pinned]="compact()">
          <button type="button" class="mf-btn" data-testid="meeting-cancel" (click)="closed.emit()">Cancel</button>
          <button type="submit" data-testid="meeting-save" class="mf-btn mf-btn--primary bg-[var(--color-accent)] text-[var(--color-accent-contrast)]"
            [disabled]="saving() || !canSave()">{{ mode() === 'create' ? 'Create' : 'Save' }}</button>
        </div>
      </form>
    </ng-template>
    <!-- Embedded, the form sits inside the work item dialog (category "meeting"), which supplies the frame. -->
    @if (embedded()) {
      <ng-container [ngTemplateOutlet]="formTpl" />
    } @else {
      <app-modal [open]="open()" title="Edit meeting" size="lg" customMaxWidth="max-w-[820px]" (closed)="closed.emit()">
        <ng-container [ngTemplateOutlet]="formTpl" />
      </app-modal>
    }
    <app-meeting-scope-dialog [open]="scopeDialogOpen()" title="Edit which occurrences?" (chosen)="applyScope($event)"
      (cancelled)="scopeDialogOpen.set(false)" />
  `,
  styles: [`
    /* A smaller field than the app default, for this form only: fields.css reads these two. */
    .mf { --field-height: 2.125rem; --field-font-size: 0.8125rem; display: flex; flex-direction: column; gap: 12px; font-size: 13px; color: var(--color-text-primary); }
    .mf-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .mf-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
    .mf-field--tight { gap: 5px; }
    .mf-label { font-size: 13px; font-weight: 600; color: var(--color-text-primary); }
    .mf-label--sm { font-size: 12px; }
    .mf-note { margin: 0; font-size: 12px; color: var(--color-text-secondary); }
    .mf-error { margin: 0; font-size: 12px; color: var(--color-danger); }

    /* The leading icons sit in the field, with no divider beside them. */
    .mf ::ng-deep .ui-field__addon { min-width: 0; padding: 0 0 0 12px; border-right: 0; color: var(--color-text-primary); }
    .mf ::ng-deep .ui-field__addon + .ui-field__control { padding-left: 10px; }

    /* The agenda stays rich text (saved agendas are HTML); here it reads as plain text over a line. */
    .mf-agenda ::ng-deep .tfm-editor__toolbar { display: none; }
    .mf-agenda ::ng-deep .tfm-editor__content { min-height: 60px; padding: 8px 12px; font-size: 13px; resize: vertical; }

    .mf-when { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 8px; }
    .mf-date { width: 122px; flex: none; }
    .mf-time { width: 126px; flex: none; }
    .mf-arrow { flex: none; height: var(--field-height); color: var(--color-text-primary); }
    .mf-when ::ng-deep app-date-picker .ui-field__control, .mf-when ::ng-deep app-time-picker .ui-field__control { padding-left: 6px; padding-right: 0; font-size: 13px; }
    .mf-when ::ng-deep app-date-picker .ui-field__trailing { display: none; }
    .mf-when ::ng-deep app-time-picker .ui-field__trailing { padding-right: 2px; }
    .mf-end-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
    .mf-duration { font-size: 13px; font-weight: 500; white-space: nowrap; color: var(--color-accent); }
    .mf-check { display: inline-flex; align-items: center; gap: 7px; height: var(--field-height); font-size: 13px; white-space: nowrap; cursor: pointer; }
    .mf-check input { width: 16px; height: 16px; accent-color: var(--color-accent); cursor: pointer; }
    .mf-when .mf-check { margin-left: 6px; padding: 0 8px; border-radius: var(--field-radius); transition: background-color 140ms ease; }
    .mf-when .mf-check:hover { background: var(--color-surface-secondary); }

    /* Repeat and Time zone read as links until opened. */
    .mf-link { display: inline-block; flex: none; width: auto; margin-left: 4px; }
    .mf-link ::ng-deep .ui-field { position: relative; height: var(--field-height); padding: 0 8px; border: 0; background: transparent; box-shadow: none; cursor: pointer; }
    .mf-link ::ng-deep .ui-field:hover, .mf-link ::ng-deep .ui-field:focus-within { background: var(--color-surface-secondary); }
    /* The whole pill opens the list, icon included: the icon sits outside the select's button. */
    .mf-link ::ng-deep .app-select__trigger::before { content: ''; position: absolute; inset: 0; }
    .mf-link ::ng-deep .ui-field__addon { padding: 0; }
    .mf-link ::ng-deep .app-select__trigger { padding: 0 0 0 6px; font-size: 13px; }
    .mf-link ::ng-deep .app-select__trigger > svg { display: none; }
    .mf-link ::ng-deep .app-select__value { max-width: 7rem; color: var(--color-text-primary); }

    .mf-row { display: grid; grid-template-columns: 116px minmax(0, 1fr); align-items: center; gap: 0 24px; }
    .mf-row--top { align-items: start; }
    .mf-row--top > .mf-label { line-height: var(--field-height); }
    .mf-inline { display: flex; align-items: center; gap: 16px; }
    .mf-people { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
    .mf-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .mf-chip { display: inline-flex; align-items: center; gap: 6px; max-width: 100%; padding: 3px 6px 3px 4px; border: 1px solid var(--color-border);
      border-radius: 999px; font-size: 12px; background: var(--color-surface); }
    .mf-chip--count { padding: 3px 10px; color: var(--color-text-secondary); }
    .mf-chip__name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .mf-chip__remove { flex: none; width: 16px; height: 16px; line-height: 14px; border: 0; border-radius: 50%; font-size: 14px;
      color: var(--color-text-secondary); background: transparent; cursor: pointer; }
    .mf-chip__remove:hover { color: var(--color-text-primary); background: var(--color-surface-secondary); }

    /* Stays in view when a short window makes the Planner popover scroll. */
    .mf-footer--pinned { position: sticky; bottom: 0; z-index: 1; margin-bottom: -10px; padding-bottom: 10px; background: var(--color-surface); }
    .mf-footer { display: flex; justify-content: flex-end; gap: 16px; margin-top: 2px; padding-top: 14px; border-top: 1px solid var(--color-border); }
    .mf-btn { min-width: 80px; height: var(--field-height); padding: 0 16px; border: 1px solid var(--color-border); border-radius: var(--field-radius);
      font-size: 13px; font-weight: 600; color: var(--color-text-primary); background: var(--color-surface); cursor: pointer; }
    .mf-btn:hover { background: var(--color-surface-secondary); }
    .mf-btn--primary { border-color: var(--color-accent); color: var(--color-accent-contrast); background: var(--color-accent); }
    .mf-btn--primary:hover { background: var(--color-accent); opacity: 0.9; }
    .mf-btn--primary:disabled { opacity: 0.55; cursor: not-allowed; }

    @media (max-width: 640px) {
      .mf-grid, .mf-row { grid-template-columns: minmax(0, 1fr); gap: 6px; }
      .mf-row--top > .mf-label { line-height: inherit; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MeetingFormModalComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly meetings = inject(MeetingApiService);
  private readonly projectApi = inject(ProjectApiService);
  private readonly notify = inject(NotificationService);
  private readonly calendarApi = inject(CalendarEventApiService);
  private readonly auth = inject(AuthStore);
  private readonly destroyRef = inject(DestroyRef);

  readonly open = input(false);
  readonly mode = input<'create' | 'edit'>('create');
  readonly placement = input<MeetingPlacementInput | null>(null);
  readonly prefill = input<MeetingPrefill | null>(null);
  /** The Planner create popover's Meeting tab: the most used fields only. */
  readonly compact = input(false);
  /** The Planner create popover's shared title: kept in step both ways while the Meeting tab is open. */
  readonly sharedTitle = input<WritableSignal<string> | null>(null);
  readonly occurrence = input<MeetingOccurrenceResponse | null>(null);
  /** Render the form without its own modal: the work item dialog hosts it when the category is "meeting". */
  readonly embedded = input(false);
  readonly carryOver = input<MeetingCarryOver | null>(null);
  /** Set by the calendar on a principal's calendar: the meeting is created for them, and no Organizer select shows. */
  readonly organizerEmployeeId = input<string | null>(null);
  private readonly principalsStore = inject(MeetingPrincipalsStore);
  /** '' = the caller; otherwise a principal's employee id. */
  readonly organizerChoice = signal('');
  readonly organizerOptions = computed<readonly SelectOption[]>(() => [
    { value: '', label: 'Me' },
    ...this.principalsStore.principals().map((p) => ({ value: p.employeeId, label: p.name })),
  ]);
  /** Offered on the full create form to someone who is a meeting delegate; the compact popover tab stays as it is. */
  readonly showOrganizer = computed(() => this.mode() === 'create' && !this.compact() && !this.organizerEmployeeId()
    && this.principalsStore.principals().length > 0);
  readonly saved = output<MeetingCreatedEvent | MeetingEditSaved>();
  readonly closed = output<void>();

  readonly presets: readonly RecurrencePreset[] = ['none', 'daily', 'weekly', 'biweekly', 'monthly', 'custom'];
  readonly form = this.fb.group({
    title: ['', Validators.required],
    description: this.fb.control<string | null>(null),
    location: '',
    isPrivate: false,
    date: '',
    time: '09:00',
    durationMinutes: [30, [Validators.min(15), Validators.max(480)]],
    isAllDay: false,
    timezone: browserTimeZone(),
    recurrence: this.fb.control<RecurrencePreset>('none'),
    customRule: '',
    platform: this.fb.control<PlatformChoice>('none'),
  });

  readonly projectId = signal<string | null>(null);
  readonly objectiveId = signal<string | null>(null);
  readonly participantIds = signal<readonly string[]>([]);
  readonly guestEmails = signal<readonly string[]>([]);
  readonly projects = signal<readonly { id: string; name: string }[]>([]);
  readonly modules = signal<readonly { id: string; title: string }[]>([]);
  readonly scopeDialogOpen = signal(false);
  readonly saving = signal(false);
  /** Who cannot make the chosen time and why (availability warnings, 2026-10-28). Advisory: never blocks Save. */
  readonly availability = signal<readonly CalendarConflict[]>([]);
  readonly checkingAvailability = signal(false);
  private availabilityTimer: ReturnType<typeof setTimeout> | null = null;
  private availabilityRequest = 0;
  private readonly current = signal<MeetingOccurrenceResponse | null>(null);
  private initial: MeetingFormValue | null = null;

  readonly platformOptions: readonly SelectOption[] = [
    { value: 'none', label: 'No online meeting' },
    { value: 'microsoft_teams', label: 'Microsoft Teams' },
    { value: 'zoom', label: 'Zoom' },
  ];
  readonly projectOptions = computed<readonly SelectOption[]>(() => [
    { value: '', label: 'Office' },
    ...this.projects().map((p) => ({ value: p.id, label: p.name })),
  ]);
  readonly moduleOptions = computed<readonly SelectOption[]>(() => this.modules().map((m) => ({ value: m.id, label: m.title })));

  readonly peoplePositions = PEOPLE_POSITIONS;
  readonly peopleOpen = signal(false);
  readonly peopleSearch = signal('');
  readonly peopleWidth = signal<number | string>('auto');
  private readonly peopleField = viewChild<ElementRef<HTMLElement>>('peopleField');
  /** Names of the people picked here: the picker reports them, and is gone once its dropdown closes. */
  private readonly peopleNames = signal<ReadonlyMap<string, string>>(new Map());
  readonly chosenPeople = computed(() => {
    const names = this.peopleNames();
    return this.participantIds().flatMap((id) => { const name = names.get(id); return name ? [{ id, name }] : []; });
  });
  /** Added in bulk, so known by id only: counted rather than named. */
  readonly unnamedPeople = computed(() => this.participantIds().length - this.chosenPeople().length);

  /** D19: after an occurrence ends, the organizer may still edit its notes, and nothing else. */
  readonly notesOnly = computed(() => this.mode() === 'edit' && this.current()?.status === 'completed');
  readonly platformValue = computed<MeetingPlatform | null>(() => this.platformChoice() === 'none' ? null : this.platformChoice() as MeetingPlatform);
  private readonly platformChoice = signal<PlatformChoice>('none');

  constructor() {
    effect(() => {
      const shared = this.sharedTitle();
      if (!shared) return;
      const title = shared();
      untracked(() => {
        if (this.form.controls.title.value !== title) this.form.controls.title.setValue(title, { emitEvent: false });
      });
    });
  }

  ngOnInit(): void {
    if (this.mode() === 'create' && !this.compact()) void this.principalsStore.load();
    this.form.controls.platform.valueChanges.subscribe((p) => this.platformChoice.set(p));
    this.form.controls.title.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((title) => this.sharedTitle()?.set(title ?? ''));
    // Only the fields that move the meeting in time re-check availability (design 4.3), not the title or agenda.
    const c = this.form.controls;
    merge(c.date.valueChanges, c.time.valueChanges, c.durationMinutes.valueChanges, c.isAllDay.valueChanges, c.timezone.valueChanges)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.scheduleAvailabilityCheck());
    this.destroyRef.onDestroy(() => { if (this.availabilityTimer) clearTimeout(this.availabilityTimer); });
    const occ = this.occurrence();
    if (this.mode() === 'edit' && occ) {
      this.load(occ);
      return;
    }
    const prefill = this.prefill();
    if (prefill) {
      const minutes = Math.round((Date.parse(prefill.end) - Date.parse(prefill.start)) / 60000);
      this.form.patchValue({ title: prefill.title, date: prefill.start.slice(0, 10), time: prefill.start.slice(11, 16),
        durationMinutes: minutes > 0 ? minutes : 30 });
      if (prefill.timezone) this.form.patchValue({ timezone: prefill.timezone });
      if (prefill.isAllDay !== undefined) this.form.patchValue({ isAllDay: prefill.isAllDay });
    } else {
      this.form.patchValue(nextHalfHour(new Date(), this.form.controls.timezone.value));
    }
    const carried = this.carryOver();
    if (carried) {
      const description = carried.description && carried.description.replace(/<[^>]*>/g, '').trim() !== '' ? carried.description : null;
      this.form.patchValue({ title: carried.title, description });
    }
    const placement = this.placement();
    this.projectId.set(placement?.projectId ?? null);
    this.objectiveId.set(placement?.objectiveId ?? null);
    void this.loadProjects();
    if (placement?.projectId) void this.loadModules(placement.projectId);
  }

  /** Compact leaves the custom RRULE to the full form. */
  readonly recurrenceOptions = computed<readonly SelectOption[]>(() => this.presets
    .filter((p) => !this.compact() || p !== 'custom')
    .map((p) => ({ value: p, label: RECURRENCE_PRESET_LABELS[p] })));

  canSave(): boolean {
    if (this.form.controls.title.value.trim() === '' || !this.form.controls.date.value) return false;
    if (!this.form.controls.isAllDay.value && this.form.controls.durationMinutes.invalid) return false;
    if (this.mode() === 'create' && this.startInPast()) return false;
    return this.mode() === 'edit' || this.projectId() === null || this.objectiveId() !== null;
  }

  /** Every change to the form, so the "already passed" note redraws under OnPush. */
  private readonly formChanges = toSignal(this.form.valueChanges, { initialValue: null });

  /** The form's values, as a signal: the pickers are bound to these, not to form controls. */
  readonly values = computed(() => {
    this.formChanges();
    return this.form.getRawValue();
  });

  /** Every zone the browser knows, plus the form's own in case it is an older alias. */
  readonly timezoneOptions = computed<readonly SelectOption[]>(() =>
    [...new Set([...Intl.supportedValuesOf('timeZone'), this.values().timezone])].sort().map((z) => ({ value: z, label: z })));

  /** The form stores a start and a length; End is the two added up, wrapping past midnight. */
  readonly endTime = computed(() => {
    const { time, durationMinutes } = this.values();
    const start = clockMinutes(time);
    if (start === null) return '';
    const end = (start + durationMinutes) % 1440;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(Math.floor(end / 60))}:${pad(end % 60)}`;
  });

  readonly durationLabel = computed(() => {
    const minutes = this.values().durationMinutes;
    return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')} min`;
  });

  readonly durationOutOfRange = computed(() => {
    const { isAllDay, durationMinutes } = this.values();
    return !isAllDay && (durationMinutes < 15 || durationMinutes > 480);
  });

  /** An end at or before the start means the next day, so the length is always positive. */
  setEndTime(end: string): void {
    const startMinutes = clockMinutes(this.values().time);
    const endMinutes = clockMinutes(end);
    if (startMinutes === null || endMinutes === null) return;
    const minutes = endMinutes - startMinutes;
    this.form.controls.durationMinutes.setValue(minutes > 0 ? minutes : minutes + 1440);
  }

  setRecurrence(preset: string): void {
    this.form.controls.recurrence.setValue(preset as RecurrencePreset);
  }

  setPlatform(platform: string): void {
    this.form.controls.platform.setValue(platform as PlatformChoice);
  }

  openPeople(): void {
    this.peopleWidth.set(this.peopleField()?.nativeElement.getBoundingClientRect().width || 'auto');
    this.peopleOpen.set(true);
  }

  onPeopleSearch(text: string): void {
    this.peopleSearch.set(text);
    this.openPeople();
  }

  /** Closes only the dropdown: the keypress must not reach the Planner popover's own Escape. */
  closePeople(event: Event): void {
    if (!this.peopleOpen()) return;
    event.stopPropagation();
    this.peopleOpen.set(false);
  }

  rememberNames(people: readonly { id: string; name: string }[]): void {
    this.peopleNames.update((names) => {
      const next = new Map(names);
      for (const person of people) if (person.name) next.set(person.id, person.name);
      return next;
    });
  }

  removeParticipant(id: string): void {
    this.onParticipantsChange(this.participantIds().filter((p) => p !== id));
  }

  onGuestsChange(emails: readonly string[]): void {
    this.guestEmails.set(emails);
    this.peopleSearch.set('');
  }

  removeGuest(email: string): void {
    this.guestEmails.update((emails) => emails.filter((g) => g !== email));
  }

  /** A new meeting must start after now, as the server checks; all day counts from midnight, so today has begun. */
  readonly startInPast = computed(() => {
    this.formChanges();
    const v = this.form.getRawValue();
    if (!v.date || (!v.isAllDay && !v.time)) return false;
    return Date.parse(toOffsetIso(v.date, v.isAllDay ? '00:00' : v.time, v.timezone)) <= Date.now();
  });

  setOffice(): void {
    this.projectId.set(null);
    this.objectiveId.set(null);
  }

  selectProject(projectId: string): void {
    this.projectId.set(projectId || null);
    this.objectiveId.set(null);
    this.modules.set([]);
    if (projectId) void this.loadModules(projectId);
  }

  onAgenda(html: string): void {
    const empty = html.replace(/<[^>]*>/g, '').trim() === '';
    this.form.controls.description.setValue(empty ? null : html);
  }

  mergeParticipants(ids: readonly string[]): void {
    this.participantIds.update((current) => [...new Set([...current, ...ids])]);
    this.scheduleAvailabilityCheck();
  }

  onParticipantsChange(ids: readonly string[]): void {
    this.participantIds.set(ids);
    this.scheduleAvailabilityCheck();
  }

  scheduleAvailabilityCheck(): void {
    if (this.availabilityTimer) clearTimeout(this.availabilityTimer);
    this.availabilityTimer = setTimeout(() => this.checkAvailability(), 400);
  }

  /** The participants, the meeting's organizer in edit, and the caller (the organizer in create). Guests have no data. */
  private availabilityPeople(): readonly string[] {
    const occ = this.current();
    const people = this.mode() === 'edit' && occ
      ? [...occ.attendees.map((a) => a.employeeId), occ.organizer.employeeId]
      : [...this.participantIds()];
    const me = this.auth.employeeId();
    return [...new Set([...people, me].filter((id): id is string => !!id))];
  }

  private checkAvailability(): void {
    this.availabilityTimer = null;
    const v = this.form.getRawValue();
    const people = this.availabilityPeople();
    const request = ++this.availabilityRequest;
    const timed = !v.isAllDay;
    const badTime = timed && (!v.time || !(v.durationMinutes > 0) || this.form.controls.durationMinutes.invalid);
    if (!v.date || badTime || people.length === 0 || this.notesOnly()) {
      this.availability.set([]);
      this.checkingAvailability.set(false);
      return;
    }
    const startDate = toOffsetIso(v.date, v.isAllDay ? '00:00' : v.time, v.timezone);
    const minutes = v.isAllDay ? 24 * 60 : v.durationMinutes;
    const endDate = new Date(Date.parse(startDate) + minutes * 60000).toISOString();
    const seriesId = this.mode() === 'edit' ? this.current()?.seriesId : null;
    this.checkingAvailability.set(true);
    this.calendarApi.checkConflicts({
      participantEmployeeIds: people, startDate, endDate, isAllDay: v.isAllDay, timeZone: v.timezone,
      ...(seriesId ? { excludeMeetingSeriesId: seriesId } : {}),
    }).subscribe({
      next: (res) => {
        if (request !== this.availabilityRequest) return;
        this.availability.set(res.conflicts);
        this.checkingAvailability.set(false);
      },
      error: (err: unknown) => {
        if (request !== this.availabilityRequest) return;
        console.warn('Availability check failed', err);
        this.availability.set([]);
        this.checkingAvailability.set(false);
      },
    });
  }

  buildCreateRequest(): CreateMeetingRequest {
    const v = this.form.getRawValue();
    const organizer = this.organizerEmployeeId() ?? (this.showOrganizer() ? this.organizerChoice() || null : null);
    return {
      ...(organizer ? { organizerEmployeeId: organizer } : {}),
      projectId: this.projectId(),
      objectiveId: this.projectId() ? this.objectiveId() : null,
      title: v.title.trim(),
      description: v.description,
      location: v.location.trim() || null,
      isPrivate: v.isPrivate,
      start: toOffsetIso(v.date, v.isAllDay ? '00:00' : v.time, v.timezone),
      durationMinutes: v.durationMinutes,
      isAllDay: v.isAllDay,
      timezone: v.timezone,
      recurrenceRule: this.rule(v.recurrence, v.customRule, v.date),
      participantEmployeeIds: [...this.participantIds()],
      guestEmails: [...this.guestEmails()],
      platform: v.platform === 'none' ? null : v.platform,
    };
  }

  async save(): Promise<void> {
    if (this.saving() || !this.canSave()) return;
    if (this.mode() === 'create') {
      await this.create();
      return;
    }
    // After the end only this occurrence's notes can change (D19), so there is no scope to choose.
    if (this.current()?.recurrenceRule && !this.notesOnly()) {
      this.scopeDialogOpen.set(true);
      return;
    }
    await this.applyScope('this');
  }

  async applyScope(scope: MeetingScope): Promise<void> {
    this.scopeDialogOpen.set(false);
    const occ = this.current();
    if (!occ) return;
    if (scope === 'this' && this.seriesFieldsChanged()) {
      this.notify.error(SERIES_ONLY);
      return;
    }
    this.saving.set(true);
    try {
      const request = this.buildEditRequest(scope, occ);
      const result = await firstValueFrom(this.meetings.edit(occ.seriesId, occ.originalStart, request));
      this.notify.success('Meeting updated');
      this.saved.emit({ ...result, sentStart: request.start ?? null });
    } catch (e) {
      const code = this.codeOf(e);
      if (code === 'meeting_changed') {
        this.load(await firstValueFrom(this.meetings.getOccurrenceAt(occ.seriesId, occ.originalStart)));
        this.notify.error(RELOADED);
      } else {
        this.notify.error(meetingErrorMessage(code));
      }
    } finally {
      this.saving.set(false);
    }
  }

  private async create(): Promise<void> {
    this.saving.set(true);
    try {
      const request = this.buildCreateRequest();
      const result = await firstValueFrom(this.meetings.create(request));
      this.notify.success(result.outcome === 'requested' ? 'Sent for approval' : 'Meeting created');
      if (result.skipped.length > 0) {
        const reasons = [...new Set(result.skipped.map((s) => SKIPPED_REASONS[s.reason] ?? s.reason))].join(', ');
        this.notify.warning(`${result.skipped.length} people were not invited: ${reasons}`);
      }
      this.saved.emit({ ...result, originalStart: request.start });
    } catch (e) {
      this.notify.error(meetingErrorMessage(this.codeOf(e)));
    } finally {
      this.saving.set(false);
    }
  }

  /** Only what changed. The revision is the occurrence's for "this", the series' otherwise (concurrency check). */
  private buildEditRequest(scope: MeetingScope, occ: MeetingOccurrenceResponse): EditMeetingRequest {
    const v = this.form.getRawValue();
    const was = this.initial ?? v;
    const request: EditMeetingRequest = { scope, revision: scope === 'this' ? occ.revision : occ.seriesRevision };
    if (v.description !== was.description) request.description = v.description;
    if (this.notesOnly()) return request;
    if (v.title.trim() !== was.title.trim()) request.title = v.title.trim();
    if (v.location.trim() !== was.location.trim()) request.location = v.location.trim() || null;
    if (v.isPrivate !== was.isPrivate) request.isPrivate = v.isPrivate;
    if (v.date !== was.date || v.time !== was.time || v.timezone !== was.timezone || v.isAllDay !== was.isAllDay) {
      request.start = toOffsetIso(v.date, v.isAllDay ? '00:00' : v.time, v.timezone);
      if (v.timezone !== was.timezone && scope !== 'this') request.timezone = v.timezone;
      if (v.isAllDay !== was.isAllDay) request.isAllDay = v.isAllDay;
    }
    if (v.durationMinutes !== was.durationMinutes) request.durationMinutes = v.durationMinutes;
    // One occurrence keeps the series' rule: a preset rebuilt from its new date (BYDAY) is not a rule change.
    if (scope === 'this') return request;
    const rule = this.rule(v.recurrence, v.customRule, v.date);
    if (rule !== this.rule(was.recurrence, was.customRule, was.date)) request.recurrenceRule = rule;
    return request;
  }

  /** The repeat and the time zone belong to the whole series (the backend refuses them for scope "this"). */
  private seriesFieldsChanged(): boolean {
    const v = this.form.getRawValue();
    const was = this.initial ?? v;
    return v.timezone !== was.timezone || v.recurrence !== was.recurrence
      || (v.recurrence === 'custom' && v.customRule.trim() !== was.customRule.trim());
  }

  private load(occ: MeetingOccurrenceResponse): void {
    this.current.set(occ);
    const { date, time } = toZonedParts(occ.startAt, occ.timezone);
    const preset = recurrencePresets.fromRule(occ.recurrenceRule);
    this.form.reset({
      title: occ.title, description: occ.description, location: occ.location ?? '', isPrivate: occ.isPrivate, date, time,
      durationMinutes: Math.round((Date.parse(occ.endAt) - Date.parse(occ.startAt)) / 60000), isAllDay: occ.isAllDay,
      timezone: occ.timezone, recurrence: preset, customRule: preset === 'custom' ? occ.recurrenceRule ?? '' : '', platform: 'none',
    });
    this.initial = this.form.getRawValue();
  }

  private rule(preset: RecurrencePreset, custom: string, date: string): string | null {
    if (preset === 'custom') return custom.trim() || null;
    return date ? recurrencePresets.toRule(preset, date) : null;
  }

  private codeOf(e: unknown): string | undefined {
    return e instanceof HttpErrorResponse ? (e.error?.code as string | undefined) : undefined;
  }

  private async loadProjects(): Promise<void> {
    try {
      const page = await firstValueFrom(this.projectApi.listMine(1, 100));
      // The Office system project is the "Office" choice above, not a second entry here.
      this.projects.set(page.items.filter((p) => p.systemPurpose !== 'office').map((p) => ({ id: p.id, name: p.name })));
    } catch {
      this.projects.set([]);
    }
  }

  private async loadModules(projectId: string): Promise<void> {
    try {
      const tree = await firstValueFrom(this.projectApi.getProjectTree(projectId));
      this.modules.set(tree.map((o) => ({ id: o.id, title: o.title })));
    } catch {
      this.modules.set([]);
    }
  }
}
