import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { NotificationService } from '../../../../../core/services/notification.service';
import { ModalComponent } from '../../../../../shared/ui/modal/modal.component';
import { AvatarComponent } from '../../../../../shared/ui/avatar/avatar.component';
import { EmployeeDirectoryStore } from '../../../state/employee-directory.store';
import { CalendarParticipantPickerComponent } from '../../../../calendar/ui/calendar-participant-picker/calendar-participant-picker.component';
import { MeetingApiService } from '../../data-access/meeting-api.service';
import { MeetingAttendanceResponse, MeetingAttendee, MeetingOccurrenceResponse, MeetingScope, MeetingStatus } from '../../models/meeting.models';
import { MeetingOccurrenceKey, MeetingOccurrenceStore } from '../../state/meeting-occurrence.store';
import { meetingErrorMessage } from '../../utils/meeting-error-messages';
import { MeetingJoinLink, joinLinkOf } from '../../utils/meeting-join-link';
import { MeetingParticipation, PARTICIPATION_LABELS, orderedParticipants } from '../../utils/meeting-participation';
import { MeetingEditSaved, MeetingFormModalComponent } from '../../ui/meeting-form-modal/meeting-form-modal.component';
import { MeetingActionItemsComponent } from '../../ui/meeting-action-items/meeting-action-items.component';
import { MeetingMoveDialogComponent, MeetingMoveChoice } from '../../ui/meeting-move-dialog/meeting-move-dialog.component';
import { MeetingScopeDialogComponent } from '../../ui/meeting-scope-dialog/meeting-scope-dialog.component';

const STATUS_LABELS: Record<MeetingStatus, string> = {
  scheduled: 'Scheduled', in_progress: 'In progress', completed: 'Completed', cancelled: 'Cancelled',
};
const RESPONSE_LABELS: Record<string, string> = { accepted: 'Accepted', rejected: 'Declined', pending: 'Not answered' };
const STATUS_PILLS: Record<MeetingStatus, string> = {
  scheduled: 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)]',
  in_progress: 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)]',
  completed: 'bg-[var(--color-success-subtle)] text-[var(--color-success-text)]',
  cancelled: 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]',
};
/** Avatars shown before "+N"; the full list opens from the stack. */
const MAX_AVATARS = 8;
const RING_CLASSES: Record<MeetingParticipation, string> = {
  absent: 'ring-[var(--color-danger)]',
  left_early: 'ring-[var(--color-warning)]',
  attended: 'ring-[var(--color-success)]',
  unknown: 'ring-[var(--color-border-strong)]',
};

/** The app a meeting's free-text location names, for its icon; null for anything else. */
export function meetingPlatformOf(location: string | null): 'teams' | 'zoom' | null {
  const text = (location ?? '').toLowerCase();
  if (text.includes('teams')) return 'teams';
  if (text.includes('zoom')) return 'zoom';
  return null;
}

/** "1h", "45m" or "1h 30m". */
export function meetingDurationLabel(startUtc: string, endUtc: string): string {
  const minutes = Math.max(0, Math.round((Date.parse(endUtc) - Date.parse(startUtc)) / 60_000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h ${m}m`;
  return h ? `${h}h` : `${m}m`;
}

/**
 * One meeting occurrence (spec 5.1-5.8): details, attendees, the caller's RSVP, agenda and notes, and the link. Only the
 * organizer sees the controls that change it (Review Focus 4); after it ends, only its notes (D19).
 */
@Component({
  selector: 'app-meeting-occurrence-drawer',
  standalone: true,
  imports: [ModalComponent, AvatarComponent, MeetingFormModalComponent, MeetingScopeDialogComponent,
    MeetingMoveDialogComponent, CalendarParticipantPickerComponent, MeetingActionItemsComponent],
  providers: [MeetingOccurrenceStore],
  template: `
    <app-modal [open]="true" size="xl" [title]="store.occurrence()?.title ?? 'Meeting'" (closed)="closed.emit()">
      @if (store.notFound()) {
        <p data-testid="meeting-drawer-unavailable" class="text-sm">{{ unavailable }}</p>
      } @else if (store.occurrence(); as occ) {
        <div class="flex flex-col gap-5 text-sm">
          <!-- Hero: icon, title, id and status; then date, time, platform and organizer on one line -->
          <header class="flex flex-col gap-4 border-b border-[var(--color-border)] pb-5 md:flex-row md:items-start md:justify-between">
            <div class="flex min-w-0 gap-4">
              <div class="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-accent-subtle)] text-[var(--color-accent)]" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="4.5" width="18" height="16" rx="2.5" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
                </svg>
              </div>
              <div class="flex min-w-0 flex-col gap-2">
                <h2 data-testid="meeting-drawer-title" class="truncate text-xl font-bold text-[var(--color-text-primary)]">{{ occ.title }}</h2>
                <div class="flex flex-wrap items-center gap-2.5">
                  @if (occ.shortId) {
                    <span data-testid="meeting-drawer-shortid" class="text-sm text-[var(--color-text-secondary)]">{{ occ.shortId }}</span>
                  }
                  <span data-testid="meeting-status-pill" class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold" [class]="statusPillClass(occ.status)"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" />@if (occ.status === 'completed') {<path d="m8.5 12 2.5 2.5 4.5-5" />} @else if (occ.status === 'cancelled') {<path d="m9 9 6 6M15 9l-6 6" />} @else {<path d="M12 7.5V12l3 2" />}</svg>{{ statusLabel(occ.status) }}</span>
                </div>
                <div data-testid="meeting-drawer-meta" class="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[var(--color-text-secondary)]">
                  <span class="inline-flex items-center gap-1.5">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4.5" width="18" height="16" rx="2.5" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" /></svg>
                    {{ dayLabel(occ.startAt) }}
                  </span>
                  <span class="hidden h-4 w-px bg-[var(--color-border)] sm:inline-block" aria-hidden="true"></span>
                  <span data-testid="meeting-drawer-time" class="inline-flex items-center gap-1.5">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3 2" /></svg>
                    {{ occ.isAllDay ? 'All day' : timeLabel(occ.startAt, occ.endAt) }}
                  </span>
                  @if (occ.location) {
                    <span class="hidden h-4 w-px bg-[var(--color-border)] sm:inline-block" aria-hidden="true"></span>
                    <span data-testid="meeting-drawer-location" class="inline-flex items-center gap-1.5">
                      @switch (platformOf(occ.location)) {
                        @case ('teams') {
                          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="18.5" cy="7" r="2.5" fill="#7B83EB" /><path d="M15.5 10.5h6a1 1 0 0 1 1 1v4a3.5 3.5 0 0 1-7 0v-5Z" fill="#7B83EB" /><rect x="1.5" y="6" width="13" height="13" rx="2.5" fill="#5059C9" /><path d="M5 9.5h6M8 9.5v6.5" stroke="#fff" stroke-width="1.8" stroke-linecap="round" /></svg>
                        }
                        @case ('zoom') {
                          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#2D8CFF" /><path d="M6.5 9.5h6.5a1.5 1.5 0 0 1 1.5 1.5v4H8a1.5 1.5 0 0 1-1.5-1.5v-4Zm8.5 2 3-2v5.5l-3-2" fill="#fff" /></svg>
                        }
                        @default {
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
                        }
                      }
                      {{ occ.location }}
                    </span>
                  }
                  <span class="hidden h-4 w-px bg-[var(--color-border)] sm:inline-block" aria-hidden="true"></span>
                  <span class="inline-flex items-center gap-1.5">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="10" cy="8" r="4" /><path d="M3 20a7 7 0 0 1 11.5-5.4M17 15.5l2 2 3-3.5" /></svg>
                    Organizer: {{ occ.organizer.name }}
                  </span>
                </div>
              </div>
            </div>

            @if (joinLink() || (isOrganizer() && occ.status !== 'cancelled')) {
              <div class="flex shrink-0 flex-wrap gap-2">
                <!-- Join: only before the end (scheduled or in progress) and only with a working link -->
                @if (joinLink(); as join) {
                  <a data-testid="meeting-join" [href]="join.url" target="_blank" rel="noopener noreferrer" [title]="join.label"
                    class="inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-text-on-solid)] shadow-2xs transition-colors hover:bg-[var(--color-accent-hover)]">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="6" width="13" height="12" rx="2" /><path d="m15.5 10.5 6-3.5v10l-6-3.5" /></svg>
                    Join
                  </a>
                }
                @if (!isOrganizer() || occ.status === 'cancelled') {
                  <!-- Only the organizer edits; everyone else reads. -->
                } @else if (ended()) {
                  <button type="button" data-testid="meeting-notes-edit" [class]="actionButton" (click)="formOpen.set(true)">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></svg>
                    Edit notes
                  </button>
                } @else if (occ.status === 'scheduled') {
                  <!-- Once it has started the server refuses edit, cancel and move (409); notes wait for the end. -->
                  @if (occ.canEdit) {
                    <button type="button" data-testid="meeting-edit" [class]="actionButton" (click)="formOpen.set(true)">Edit</button>
                  }
                  <button type="button" data-testid="meeting-move" [class]="actionButton" (click)="moveOpen.set(true)">Move</button>
                  <button type="button" data-testid="meeting-cancel" [class]="actionButton + ' text-[var(--color-danger)]'" (click)="startCancel()">Cancel meeting</button>
                }
              </div>
            }
          </header>

          @if (occ.myRole === 'attendee' && occ.status !== 'cancelled') {
            <section [class]="card + ' flex flex-col gap-3'">
              <div class="font-semibold text-[var(--color-text-primary)]">Your response: <span data-testid="meeting-my-response" class="font-medium text-[var(--color-text-secondary)]">{{ responseLabel(occ.myResponse) }}</span></div>
              <div class="flex flex-wrap items-center gap-2">
                <button type="button" data-testid="meeting-rsvp-accept" [class]="actionButton" (click)="respond('accepted', null)">Accept</button>
                <input class="min-w-0 flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs" placeholder="Reason (optional)" aria-label="Reason for declining (optional)" [value]="declineReason()"
                  (input)="declineReason.set($any($event.target).value)" />
                <button type="button" data-testid="meeting-rsvp-decline" [class]="actionButton" (click)="respond('rejected', declineReason() || null)">Decline</button>
              </div>
            </section>
          }

          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <!-- Left: notes or agenda, action items -->
            <div class="flex min-w-0 flex-col gap-4">
              @if (occ.description) {
                <section [class]="card + ' flex flex-col gap-2'">
                  <h3 [class]="cardTitle">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 3.5h10l4 4V20a.5.5 0 0 1-.5.5h-13A.5.5 0 0 1 5 20V3.5Z" /><path d="M8.5 10h7M8.5 13.5h7M8.5 17h4" /></svg>
                    {{ ended() ? 'Notes' : 'Agenda' }}
                  </h3>
                  <div class="prose prose-sm max-w-none text-[var(--color-text-primary)]" [innerHTML]="occ.description"></div>
                </section>
              }

              <!-- A virtual occurrence (no short id yet) has no task to link an action item to. -->
              @if (occ.placement.projectId && occ.placement.objectiveId && occ.status !== 'cancelled' && occ.shortId) {
                <section [class]="card + ' flex flex-col gap-3'">
                  <h3 [class]="cardTitle">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="2.5" /><path d="m8 12 3 3 5-6" /></svg>
                    Action items
                  </h3>
                  <app-meeting-action-items [occurrenceTaskId]="occ.taskId" [projectId]="occ.placement.projectId"
                    [objectiveId]="occ.placement.objectiveId" [isOrganizer]="isOrganizer()" />
                </section>
              }
            </div>

            <!-- Right: participants, as photos ringed by how they took part -->
            <div class="flex min-w-0 flex-col gap-4">
              <section [class]="card + ' flex flex-col gap-4'" data-testid="meeting-attendees">
                <div class="flex items-center justify-between gap-2">
                  <h3 [class]="cardTitle">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M21.5 20a6.5 6.5 0 0 0-4-6" /></svg>
                    Participants ({{ occ.attendees.length }})
                  </h3>
                  <span data-testid="meeting-participants-status" class="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold" [class]="statusPillClass(occ.status)"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" />@if (occ.status === 'completed') {<path d="m8.5 12 2.5 2.5 4.5-5" />} @else if (occ.status === 'cancelled') {<path d="m9 9 6 6M15 9l-6 6" />} @else {<path d="M12 7.5V12l3 2" />}</svg>{{ statusLabel(occ.status) }}</span>
                </div>

                @if (occ.attendees.length > 0) {
                  <!-- Photos only: red no join recorded, amber left early, green attended (in that order); grey not known yet. -->
                  <button type="button" data-testid="meeting-attendee-toggle" class="flex items-center -space-x-2 self-start rounded-full text-left"
                    [attr.aria-expanded]="attendeesExpanded()" [attr.aria-label]="(attendeesExpanded() ? 'Hide' : 'Show') + ' all ' + occ.attendees.length + ' participants'"
                    (click)="attendeesExpanded.set(!attendeesExpanded())">
                    @for (p of visibleParticipants(); track p.attendee.employeeId ?? p.attendee.email) {
                      <span data-testid="meeting-participant" [attr.data-participation]="p.participation"
                        class="mp-photo relative inline-flex rounded-full bg-[var(--color-surface)] p-[2px] ring-[2.5px]" [class]="ringClass(p.participation)"
                        [attr.title]="(p.attendee.name ?? p.attendee.email ?? '') + ' · ' + participationLabel(p.participation)">
                        <app-avatar size="lg" [userName]="p.attendee.name ?? p.attendee.email" [email]="p.attendee.email" [avatarUrl]="avatarOf(p.attendee)" />
                      </span>
                    }
                    @if (hiddenAttendeeCount() > 0) {
                      <span class="relative flex size-12 items-center justify-center rounded-full bg-[var(--color-surface-secondary)] text-sm font-semibold text-[var(--color-text-secondary)] ring-2 ring-[var(--color-surface)]">+{{ hiddenAttendeeCount() }}</span>
                    }
                  </button>
                }

                @if (canManageAttendees()) {
                  <button type="button" data-testid="meeting-attendee-add" class="self-start text-xs font-semibold text-[var(--color-accent)] hover:underline" (click)="addingAttendees.set(!addingAttendees())">+ Add people</button>
                }
                @if (addingAttendees()) {
                  <div class="flex flex-col gap-2 rounded-xl border border-[var(--color-border)] p-3">
                    <app-calendar-participant-picker [selectedIds]="newEmployeeIds()" [guestEmails]="newGuestEmails()"
                      (selectedIdsChange)="newEmployeeIds.set($event)" (guestEmailsChange)="newGuestEmails.set($event)" />
                    <div class="flex gap-2 text-xs">
                      <button type="button" [class]="actionButton" (click)="addAttendees('series')">Add to the series</button>
                      <button type="button" [class]="actionButton" (click)="addAttendees('occurrence')">Add to this occurrence only</button>
                    </div>
                  </div>
                }

                @if (attendeesExpanded()) {
                  <div class="flex flex-col divide-y divide-[var(--color-border)]">
                    @for (p of participants(); track p.attendee.employeeId ?? p.attendee.email) {
                      @let attendee = p.attendee;
                      <div data-testid="meeting-attendee-row" class="flex items-center justify-between gap-2 py-2 text-xs">
                        <span class="flex min-w-0 items-center gap-2">
                          <span class="inline-flex rounded-full p-[1.5px] ring-2" [class]="ringClass(p.participation)">
                            <app-avatar size="sm" [userName]="attendee.name ?? attendee.email" [email]="attendee.email" [avatarUrl]="avatarOf(attendee)" />
                          </span>
                          <span class="truncate text-[var(--color-text-primary)]">{{ attendee.name ?? attendee.email }}@if (attendee.source === 'occurrence') {<span class="text-[var(--color-text-muted)]"> · this occurrence only</span>}</span>
                        </span>
                        <span class="flex shrink-0 items-center gap-2 text-[var(--color-text-secondary)]">
                          @if (p.participation !== 'unknown') {
                            {{ participationLabel(p.participation) }}
                          } @else {
                            {{ attendee.kind === 'guest' ? 'Guest' : responseLabel(attendee.response) }}
                          }
                          @if (canManageAttendees() && attendee.employeeId !== occ.organizer.employeeId) {
                            <button type="button" data-testid="meeting-attendee-remove" class="font-semibold text-[var(--color-danger)] hover:underline" [attr.aria-label]="'Remove ' + (attendee.name ?? attendee.email)"
                              (click)="removeAttendee(attendee)">Remove</button>
                          }
                        </span>
                      </div>
                    }
                  </div>
                }
              </section>
            </div>
          </div>
        </div>

        @if (formOpen()) {
          <app-meeting-form-modal [open]="true" mode="edit" [occurrence]="occ" (saved)="onEdited($any($event))" (closed)="formOpen.set(false)" />
        }
        <app-meeting-scope-dialog [open]="cancelScopeOpen()" title="Cancel which occurrences?" (chosen)="cancel($event)"
          (cancelled)="cancelScopeOpen.set(false)" />
        @if (moveOpen()) {
          <app-meeting-move-dialog [recurring]="!!occ.recurrenceRule" [currentObjectiveId]="occ.placement.objectiveId"
            (chosen)="move($event)" (cancelled)="moveOpen.set(false)" />
        }
      }
    </app-modal>
  `,
  // Here, not as Tailwind hover utilities: those would land in the app-wide stylesheet.
  styles: [`
    .mp-photo { transition: transform 150ms ease-out, box-shadow 150ms ease-out; }
    .mp-photo:hover { z-index: 10; transform: translateY(-4px) scale(1.12); box-shadow: 0 6px 14px rgb(0 0 0 / 0.18); }
    @media (prefers-reduced-motion: reduce) { .mp-photo { transition: none; } }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MeetingOccurrenceDrawerComponent implements OnInit {
  readonly store = inject(MeetingOccurrenceStore);
  private readonly api = inject(MeetingApiService);
  private readonly notify = inject(NotificationService);

  readonly key = input.required<MeetingOccurrenceKey>();
  readonly closed = output<void>();

  readonly unavailable = meetingErrorMessage('meeting_not_found');
  readonly formOpen = signal(false);
  readonly cancelScopeOpen = signal(false);
  readonly moveOpen = signal(false);
  readonly addingAttendees = signal(false);
  readonly newEmployeeIds = signal<readonly string[]>([]);
  readonly newGuestEmails = signal<readonly string[]>([]);
  readonly declineReason = signal('');

  private readonly directory = inject(EmployeeDirectoryStore);

  protected readonly card = 'rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xs';
  protected readonly cardTitle = 'flex items-center gap-2.5 text-base font-semibold text-[var(--color-text-primary)]';
  protected readonly actionButton =
    'inline-flex items-center gap-2 rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-secondary)]';
  /** The full attendee list (responses, Remove) opens from the avatar stack. */
  readonly attendeesExpanded = signal(false);

  /** The occurrence's attendance, once it has started; null before, or when it can't be read. */
  readonly attendance = signal<MeetingAttendanceResponse | null>(null);
  /** The Teams/Zoom link to Join by: only while the meeting is scheduled or in progress. */
  readonly joinLink = signal<MeetingJoinLink | null>(null);

  /** Everyone invited, absent first, then left early, then attended. */
  readonly participants = computed(() => {
    const occ = this.store.occurrence();
    return occ ? orderedParticipants(occ.attendees, this.attendance(), occ.startAt, occ.endAt) : [];
  });
  readonly visibleParticipants = computed(() => this.participants().slice(0, MAX_AVATARS));
  readonly hiddenAttendeeCount = computed(() => Math.max(0, this.participants().length - MAX_AVATARS));

  readonly isOrganizer = computed(() => this.store.occurrence()?.myRole === 'organizer');
  readonly ended = computed(() => this.store.occurrence()?.status === 'completed');
  readonly canManageAttendees = computed(() => this.isOrganizer() && !this.ended() && this.store.occurrence()?.status !== 'cancelled');

  constructor() {
    // Attendees come back as names only; their photos are the directory's.
    effect(() => {
      const ids = (this.store.occurrence()?.attendees ?? []).map((a) => a.employeeId).filter((id): id is string => !!id);
      if (ids.length > 0) void this.directory.ensureLoaded(ids);
    });
    // The Join link and the attendance follow the occurrence on show (it can change after an edit or a split).
    effect(() => {
      const occ = this.store.occurrence();
      untracked(() => {
        void this.loadJoinLink(occ);
        void this.loadAttendance(occ);
      });
    });
  }

  private async loadJoinLink(occ: MeetingOccurrenceResponse | null): Promise<void> {
    this.joinLink.set(null);
    if (!occ || (occ.status !== 'scheduled' && occ.status !== 'in_progress')) return;
    try {
      const link = joinLinkOf(await firstValueFrom(this.api.getLink(occ.seriesId)));
      if (this.store.occurrence() === occ) this.joinLink.set(link);
    } catch {
      this.joinLink.set(null);
    }
  }

  private async loadAttendance(occ: MeetingOccurrenceResponse | null): Promise<void> {
    this.attendance.set(null);
    if (!occ || (occ.status !== 'in_progress' && occ.status !== 'completed')) return;
    try {
      const attendance = await firstValueFrom(this.api.getAttendance(occ.seriesId, occ.originalStart));
      if (this.store.occurrence() === occ) this.attendance.set(attendance);
    } catch {
      this.attendance.set(null);
    }
  }

  protected ringClass(participation: MeetingParticipation): string {
    return RING_CLASSES[participation];
  }

  protected participationLabel(participation: MeetingParticipation): string {
    return PARTICIPATION_LABELS[participation];
  }

  ngOnInit(): void {
    void this.store.load(this.key());
  }

  protected avatarOf(attendee: MeetingAttendee): string | null {
    return attendee.employeeId ? this.directory.get(attendee.employeeId)?.avatarUrl ?? null : null;
  }

  protected statusPillClass(status: MeetingStatus): string {
    return STATUS_PILLS[status];
  }

  protected platformOf(location: string | null): 'teams' | 'zoom' | null {
    return meetingPlatformOf(location);
  }

  /** "Mon, 9 Nov" in the viewer's own zone. */
  protected dayLabel(startUtc: string): string {
    return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(startUtc));
  }

  /** "10:00 – 11:00 (1h)" in the viewer's own zone. */
  protected timeLabel(startUtc: string, endUtc: string): string {
    const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });
    return `${time.format(new Date(startUtc))} – ${time.format(new Date(endUtc))} (${meetingDurationLabel(startUtc, endUtc)})`;
  }

  protected statusLabel(status: MeetingStatus): string {
    return STATUS_LABELS[status];
  }

  protected responseLabel(response: string | null): string {
    return RESPONSE_LABELS[response ?? 'pending'] ?? 'Not answered';
  }

  async respond(status: 'accepted' | 'rejected', reason: string | null): Promise<void> {
    if (await this.store.respond(status, reason)) this.notify.success(status === 'accepted' ? 'You accepted' : 'You declined');
    else this.toastError();
  }

  /** After the form saved: a splitting edit moved this occurrence to a new series, so follow it (Review Focus 3). */
  async onEdited(result: MeetingEditSaved): Promise<void> {
    this.formOpen.set(false);
    await this.store.afterEdit(result, result.sentStart);
  }

  startCancel(): void {
    if (this.store.occurrence()?.recurrenceRule) this.cancelScopeOpen.set(true);
    else void this.cancel('this');
  }

  async cancel(scope: MeetingScope): Promise<void> {
    this.cancelScopeOpen.set(false);
    if (await this.store.cancel(scope)) this.notify.success('Meeting cancelled');
    else this.toastError();
  }

  async move(choice: MeetingMoveChoice): Promise<void> {
    this.moveOpen.set(false);
    const outcome = await this.store.move(choice.scope, choice.projectId, choice.objectiveId);
    if (outcome === 'moved') this.notify.success('Meeting moved');
    else if (outcome === 'requested') this.notify.success('Move sent for approval');
    else this.toastError();
  }

  async addAttendees(target: 'series' | 'occurrence'): Promise<void> {
    const occ = this.store.occurrence();
    if (!occ) return;
    const request = { employeeIds: [...this.newEmployeeIds()], guestEmails: [...this.newGuestEmails()] };
    try {
      const result = await firstValueFrom(target === 'series'
        ? this.api.addSeriesAttendees(occ.seriesId, request)
        : this.api.addOccurrenceAttendees(occ.seriesId, occ.originalStart, request));
      this.notify.success(`Added ${result.added}`);
      if (result.skipped.length > 0) this.notify.warning(`${result.skipped.length} people were not invited: inactive`);
      this.addingAttendees.set(false);
      this.newEmployeeIds.set([]);
      this.newGuestEmails.set([]);
      await this.store.reload();
    } catch (e) {
      this.notify.error(meetingErrorMessage((e as { error?: { code?: string } })?.error?.code));
    }
  }

  async removeAttendee(attendee: MeetingAttendee): Promise<void> {
    const occ = this.store.occurrence();
    if (!occ) return;
    const fromOccurrence = attendee.source === 'occurrence';
    try {
      if (attendee.kind === 'guest' && attendee.email) {
        await firstValueFrom(fromOccurrence
          ? this.api.removeOccurrenceGuest(occ.seriesId, occ.originalStart, attendee.email)
          : this.api.removeSeriesGuest(occ.seriesId, attendee.email));
      } else if (attendee.employeeId) {
        await firstValueFrom(fromOccurrence
          ? this.api.removeOccurrenceEmployee(occ.seriesId, occ.originalStart, attendee.employeeId)
          : this.api.removeSeriesEmployee(occ.seriesId, attendee.employeeId));
      }
      await this.store.reload();
    } catch (e) {
      this.notify.error(meetingErrorMessage((e as { error?: { code?: string } })?.error?.code));
    }
  }

  private toastError(): void {
    const error = this.store.error();
    if (error) this.notify.error(error);
  }
}
