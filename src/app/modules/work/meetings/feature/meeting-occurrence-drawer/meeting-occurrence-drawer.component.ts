import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { NotificationService } from '../../../../../core/services/notification.service';
import { ModalComponent } from '../../../../../shared/ui/modal/modal.component';
import { CalendarParticipantPickerComponent } from '../../../../calendar/ui/calendar-participant-picker/calendar-participant-picker.component';
import { MeetingApiService } from '../../data-access/meeting-api.service';
import { MeetingAttendee, MeetingScope, MeetingStatus } from '../../models/meeting.models';
import { MeetingOccurrenceKey, MeetingOccurrenceStore } from '../../state/meeting-occurrence.store';
import { meetingErrorMessage } from '../../utils/meeting-error-messages';
import { MeetingEditSaved, MeetingFormModalComponent } from '../../ui/meeting-form-modal/meeting-form-modal.component';
import { MeetingLinkPanelComponent } from '../../ui/meeting-link-panel/meeting-link-panel.component';
import { MeetingAttendanceTableComponent } from '../../ui/meeting-attendance-table/meeting-attendance-table.component';
import { MeetingActionItemsComponent } from '../../ui/meeting-action-items/meeting-action-items.component';
import { MeetingMoveDialogComponent, MeetingMoveChoice } from '../../ui/meeting-move-dialog/meeting-move-dialog.component';
import { MeetingScopeDialogComponent } from '../../ui/meeting-scope-dialog/meeting-scope-dialog.component';

const STATUS_LABELS: Record<MeetingStatus, string> = {
  scheduled: 'Scheduled', in_progress: 'In progress', completed: 'Completed', cancelled: 'Cancelled',
};
const RESPONSE_LABELS: Record<string, string> = { accepted: 'Accepted', rejected: 'Declined', pending: 'Not answered' };

/**
 * One meeting occurrence (spec 5.1-5.8): details, attendees, the caller's RSVP, agenda and notes, and the link. Only the
 * organizer sees the controls that change it (Review Focus 4); after it ends, only its notes (D19).
 */
@Component({
  selector: 'app-meeting-occurrence-drawer',
  standalone: true,
  imports: [ModalComponent, MeetingLinkPanelComponent, MeetingFormModalComponent, MeetingScopeDialogComponent,
    MeetingMoveDialogComponent, CalendarParticipantPickerComponent, MeetingAttendanceTableComponent, MeetingActionItemsComponent],
  providers: [MeetingOccurrenceStore],
  template: `
    <app-modal [open]="true" size="xl" [title]="store.occurrence()?.title ?? 'Meeting'" (closed)="closed.emit()">
      @if (store.notFound()) {
        <p data-testid="meeting-drawer-unavailable" class="text-sm">{{ unavailable }}</p>
      } @else if (store.occurrence(); as occ) {
        <div class="flex flex-col gap-4 text-sm">
          <header class="flex items-center gap-2">
            <h2 data-testid="meeting-drawer-title" class="text-base font-semibold">{{ occ.title }}</h2>
            <span data-testid="meeting-drawer-shortid" class="text-xs text-[var(--color-text-secondary)]">{{ occ.shortId }}</span>
            <span data-testid="meeting-status-pill" class="rounded-full bg-[var(--color-surface-secondary)] px-2 text-xs">{{ statusLabel(occ.status) }}</span>
          </header>

          <section class="text-xs text-[var(--color-text-secondary)]">
            <div>{{ when(occ.startAt, occ.endAt) }}</div>
            <div>{{ occ.placement.isOffice ? 'Office' : occ.placement.projectName + ' / ' + occ.placement.moduleTitle }}@if (occ.location) { · {{ occ.location }} }</div>
            <div data-testid="meeting-organized-by">Organized by {{ occ.organizer.name }}</div>
            <!-- Set when a meeting delegate created it for the organizer; the server sends it to the organizer role only. -->
            @if (occ.scheduledByName) {
              <div data-testid="meeting-scheduled-by">Scheduled by {{ occ.scheduledByName }}</div>
            }
          </section>

          @if (isOrganizer() && occ.status !== 'cancelled') {
            <div class="flex flex-wrap gap-2">
              @if (ended()) {
                <button type="button" data-testid="meeting-notes-edit" class="rounded-md border px-3 py-1" (click)="formOpen.set(true)">Edit notes</button>
              } @else if (occ.status === 'scheduled') {
                <!-- Once it has started the server refuses edit, cancel and move (409); notes wait for the end. -->
                @if (occ.canEdit) {
                  <button type="button" data-testid="meeting-edit" class="rounded-md border px-3 py-1" (click)="formOpen.set(true)">Edit</button>
                }
                <button type="button" data-testid="meeting-cancel" class="rounded-md border px-3 py-1" (click)="startCancel()">Cancel meeting</button>
                <button type="button" data-testid="meeting-move" class="rounded-md border px-3 py-1" (click)="moveOpen.set(true)">Move</button>
              }
            </div>
          }

          @if (occ.myRole === 'attendee' && occ.status !== 'cancelled') {
            <section class="flex flex-col gap-2">
              <div class="font-medium">Your response: <span data-testid="meeting-my-response">{{ responseLabel(occ.myResponse) }}</span></div>
              <div class="flex flex-wrap items-center gap-2">
                <button type="button" data-testid="meeting-rsvp-accept" class="rounded-md border px-3 py-1" (click)="respond('accepted', null)">Accept</button>
                <input class="rounded-md border px-2 py-1 text-xs" placeholder="Reason (optional)" [value]="declineReason()"
                  (input)="declineReason.set($any($event.target).value)" />
                <button type="button" data-testid="meeting-rsvp-decline" class="rounded-md border px-3 py-1"
                  (click)="respond('rejected', declineReason() || null)">Decline</button>
              </div>
            </section>
          }

          <section class="flex flex-col gap-1">
            <div class="flex items-center justify-between">
              <span class="font-medium">Attendees</span>
              @if (canManageAttendees()) {
                <button type="button" data-testid="meeting-attendee-add" class="text-xs" (click)="addingAttendees.set(!addingAttendees())">Add people</button>
              }
            </div>
            @if (addingAttendees()) {
              <div class="flex flex-col gap-2 rounded-md border p-2">
                <app-calendar-participant-picker [selectedIds]="newEmployeeIds()" [guestEmails]="newGuestEmails()"
                  (selectedIdsChange)="newEmployeeIds.set($event)" (guestEmailsChange)="newGuestEmails.set($event)" />
                <div class="flex gap-2 text-xs">
                  <button type="button" class="rounded-md border px-2 py-1" (click)="addAttendees('series')">Add to the series</button>
                  <button type="button" class="rounded-md border px-2 py-1" (click)="addAttendees('occurrence')">Add to this occurrence only</button>
                </div>
              </div>
            }
            @for (attendee of occ.attendees; track attendee.employeeId ?? attendee.email) {
              <div data-testid="meeting-attendee-row" class="flex items-center justify-between gap-2 text-xs">
                <span class="truncate">{{ attendee.name ?? attendee.email }}@if (attendee.source === 'occurrence') { · this occurrence only }</span>
                <span class="flex shrink-0 items-center gap-2 text-[var(--color-text-secondary)]">
                  {{ attendee.kind === 'guest' ? 'Guest' : responseLabel(attendee.response) }}
                  @if (canManageAttendees() && attendee.employeeId !== occ.organizer.employeeId) {
                    <button type="button" data-testid="meeting-attendee-remove" [attr.aria-label]="'Remove ' + (attendee.name ?? attendee.email)"
                      (click)="removeAttendee(attendee)">Remove</button>
                  }
                </span>
              </div>
            }
          </section>

          @if (occ.description) {
            <section class="flex flex-col gap-1">
              <span class="font-medium">{{ ended() ? 'Notes' : 'Agenda' }}</span>
              <div class="prose prose-sm" [innerHTML]="occ.description"></div>
            </section>
          }

          <section class="flex flex-col gap-1">
            <span class="font-medium">Online meeting</span>
            <app-meeting-link-panel [seriesId]="occ.seriesId" [isOrganizer]="isOrganizer()" />
          </section>

          @if (occ.status === 'in_progress' || occ.status === 'completed') {
            <section class="flex flex-col gap-1">
              <span class="font-medium">Attendance</span>
              <app-meeting-attendance-table [seriesId]="occ.seriesId" [originalStart]="occ.originalStart" [endAt]="occ.endAt"
                [isOrganizer]="isOrganizer()" [attendees]="occ.attendees" />
            </section>
          }

          <!-- A virtual occurrence (no short id yet) has no task to link an action item to. -->
          @if (occ.placement.projectId && occ.placement.objectiveId && occ.status !== 'cancelled' && occ.shortId) {
            <section class="flex flex-col gap-1">
              <span class="font-medium">Action items</span>
              <app-meeting-action-items [occurrenceTaskId]="occ.taskId" [projectId]="occ.placement.projectId"
                [objectiveId]="occ.placement.objectiveId" [isOrganizer]="isOrganizer()" />
            </section>
          }
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

  readonly isOrganizer = computed(() => this.store.occurrence()?.myRole === 'organizer');
  readonly ended = computed(() => this.store.occurrence()?.status === 'completed');
  readonly canManageAttendees = computed(() => this.isOrganizer() && !this.ended() && this.store.occurrence()?.status !== 'cancelled');

  ngOnInit(): void {
    void this.store.load(this.key());
  }

  protected statusLabel(status: MeetingStatus): string {
    return STATUS_LABELS[status];
  }

  /** Times come back as UTC; they are shown in the viewer's own zone. */
  protected when(startUtc: string, endUtc: string): string {
    const day = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
    const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
    return `${day.format(new Date(startUtc))} – ${time.format(new Date(endUtc))}`;
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
