import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { NotificationService } from '../../../../../core/services/notification.service';
import { ModalComponent } from '../../../../../shared/ui/modal/modal.component';
import { RichTextEditorComponent } from '../../../../../shared/ui/rich-text-editor/rich-text-editor.component';
import { CalendarParticipantPickerComponent } from '../../../../calendar/ui/calendar-participant-picker/calendar-participant-picker.component';
import { ProjectApiService } from '../../../data-access/project-api.service';
import { MeetingApiService } from '../../data-access/meeting-api.service';
import {
  CreateMeetingRequest, EditMeetingRequest, MeetingCreatedResponse, MeetingEditResponse, MeetingOccurrenceResponse, MeetingPlatform,
  MeetingScope
} from '../../models/meeting.models';
import { meetingErrorMessage } from '../../utils/meeting-error-messages';
import { browserTimeZone, toOffsetIso, toZonedParts } from '../../utils/meeting-time';
import { RECURRENCE_PRESET_LABELS, RecurrencePreset, recurrencePresets } from '../../utils/recurrence-presets';
import { MeetingScopeDialogComponent } from '../meeting-scope-dialog/meeting-scope-dialog.component';
import { MeetingBulkInvitePanelComponent } from './meeting-bulk-invite-panel.component';

export interface MeetingPlacementInput { projectId: string | null; objectiveId: string | null; }
/** A saved edit, with the start it sent: after a split the occurrence lives at that start in the new series. */
export interface MeetingEditSaved extends MeetingEditResponse { sentStart: string | null; }
type PlatformChoice = 'none' | MeetingPlatform;
interface MeetingFormValue {
  title: string; description: string | null; location: string; isPrivate: boolean; date: string; time: string;
  durationMinutes: number; isAllDay: boolean; timezone: string; recurrence: RecurrencePreset; customRule: string; platform: PlatformChoice;
}

const RELOADED = 'Someone else changed this meeting. We reloaded it - check and save again.';
const SERIES_ONLY = 'A repeat or time zone change applies to the series: choose this and following, or all.';

/** The one meeting form (spec D3): create from the calendar or a project's board, and edit an occurrence or its series. */
@Component({
  selector: 'app-meeting-form-modal',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent, RichTextEditorComponent, CalendarParticipantPickerComponent, MeetingBulkInvitePanelComponent,
    MeetingScopeDialogComponent],
  template: `
    <app-modal [open]="open()" [title]="mode() === 'create' ? 'New meeting' : 'Edit meeting'" size="lg" (closed)="closed.emit()">
      <form [formGroup]="form" class="flex flex-col gap-3 text-sm" (ngSubmit)="save()">
        @if (mode() === 'create') {
          <div class="grid grid-cols-2 gap-2">
            <label class="flex flex-col gap-1">Project
              <!-- [selected] per option: the options load after the value is known, and a select-level [value] is not re-applied. -->
              <select data-testid="meeting-project" (change)="selectProject($any($event.target).value)">
                <option value="" [selected]="!projectId()">Office (no project)</option>
                @for (project of projects(); track project.id) {
                  <option [value]="project.id" [selected]="project.id === projectId()">{{ project.name }}</option>
                }
              </select>
            </label>
            @if (projectId()) {
              <label class="flex flex-col gap-1">Module
                <select data-testid="meeting-module" (change)="objectiveId.set($any($event.target).value || null)">
                  <option value="" [selected]="!objectiveId()">Choose a module</option>
                  @for (module of modules(); track module.id) {
                    <option [value]="module.id" [selected]="module.id === objectiveId()">{{ module.title }}</option>
                  }
                </select>
              </label>
            }
          </div>
        } @else if (occurrence(); as occ) {
          <p class="text-xs text-[var(--color-text-secondary)]">
            {{ occ.placement.isOffice ? 'Office' : occ.placement.projectName + ' / ' + occ.placement.moduleTitle }}
          </p>
        }

        <input data-testid="meeting-title" formControlName="title" placeholder="Meeting title" class="rounded-md border px-2 py-1"
          [readOnly]="notesOnly()" />
        <app-rich-text-editor [initialHtml]="form.controls.description.value ?? ''" ariaLabel="Agenda" placeholder="Agenda"
          [compact]="true" [allowAttachments]="false" [allowImages]="false" (htmlChange)="onAgenda($event)" />

        @if (!notesOnly()) {
          <div class="grid grid-cols-4 gap-2">
            <label class="flex flex-col gap-1">Date<input type="date" formControlName="date" /></label>
            <label class="flex flex-col gap-1">Start<input type="time" formControlName="time" /></label>
            <label class="flex flex-col gap-1">Minutes<input type="number" min="15" max="480" step="15" formControlName="durationMinutes" /></label>
            <label class="flex flex-col gap-1">Time zone<input formControlName="timezone" /></label>
          </div>
          <div class="flex flex-wrap items-center gap-4">
            <label class="flex items-center gap-2"><input type="checkbox" formControlName="isAllDay" /> All day</label>
            <label class="flex items-center gap-2"><input type="checkbox" formControlName="isPrivate" /> Private</label>
            <input formControlName="location" placeholder="Location" class="rounded-md border px-2 py-1" />
          </div>
          <label class="flex flex-col gap-1">Repeats
            <select formControlName="recurrence">
              @for (preset of presets; track preset) { <option [value]="preset">{{ presetLabel(preset) }}</option> }
            </select>
          </label>
          @if (form.controls.recurrence.value === 'custom') {
            <input formControlName="customRule" placeholder="RRULE, e.g. FREQ=WEEKLY;BYDAY=MO,WE" class="rounded-md border px-2 py-1" />
          }
        } @else {
          <p class="text-xs text-[var(--color-text-secondary)]">This meeting has ended: only its notes can change.</p>
        }

        @if (mode() === 'create') {
          <label class="flex flex-col gap-1">Platform
            <select formControlName="platform">
              <option value="none">No online meeting</option>
              <option value="microsoft_teams">Microsoft Teams</option>
              <option value="zoom">Zoom</option>
            </select>
          </label>
          <div class="flex flex-col gap-1">Participants
            <app-calendar-participant-picker [selectedIds]="participantIds()" [guestEmails]="guestEmails()"
              (selectedIdsChange)="participantIds.set($event)" (guestEmailsChange)="guestEmails.set($event)" />
          </div>
          <app-meeting-bulk-invite-panel [projectId]="projectId()" [objectiveId]="objectiveId()" [platform]="platformValue()"
            (added)="mergeParticipants($event)" />
        }

        <div class="flex justify-end gap-2">
          <button type="button" class="rounded-md border px-3 py-1" (click)="closed.emit()">Cancel</button>
          <button type="submit" data-testid="meeting-save" class="rounded-md bg-[var(--color-primary)] px-3 py-1 text-white"
            [disabled]="saving() || !canSave()">{{ mode() === 'create' ? 'Create' : 'Save' }}</button>
        </div>
      </form>
    </app-modal>
    <app-meeting-scope-dialog [open]="scopeDialogOpen()" title="Edit which occurrences?" (chosen)="applyScope($event)"
      (cancelled)="scopeDialogOpen.set(false)" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MeetingFormModalComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly meetings = inject(MeetingApiService);
  private readonly projectApi = inject(ProjectApiService);
  private readonly notify = inject(NotificationService);

  readonly open = input(false);
  readonly mode = input<'create' | 'edit'>('create');
  readonly placement = input<MeetingPlacementInput | null>(null);
  readonly occurrence = input<MeetingOccurrenceResponse | null>(null);
  readonly saved = output<MeetingCreatedResponse | MeetingEditSaved>();
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
  private readonly current = signal<MeetingOccurrenceResponse | null>(null);
  private initial: MeetingFormValue | null = null;

  /** D19: after an occurrence ends, the organizer may still edit its notes, and nothing else. */
  readonly notesOnly = computed(() => this.mode() === 'edit' && this.current()?.status === 'completed');
  readonly platformValue = computed<MeetingPlatform | null>(() => this.platformChoice() === 'none' ? null : this.platformChoice() as MeetingPlatform);
  private readonly platformChoice = signal<PlatformChoice>('none');

  ngOnInit(): void {
    this.form.controls.platform.valueChanges.subscribe((p) => this.platformChoice.set(p));
    const occ = this.occurrence();
    if (this.mode() === 'edit' && occ) {
      this.load(occ);
      return;
    }
    const placement = this.placement();
    this.projectId.set(placement?.projectId ?? null);
    this.objectiveId.set(placement?.objectiveId ?? null);
    void this.loadProjects();
    if (placement?.projectId) void this.loadModules(placement.projectId);
  }

  canSave(): boolean {
    if (this.form.controls.title.value.trim() === '' || !this.form.controls.date.value) return false;
    return this.mode() === 'edit' || this.projectId() === null || this.objectiveId() !== null;
  }

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
  }

  buildCreateRequest(): CreateMeetingRequest {
    const v = this.form.getRawValue();
    return {
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
      const result = await firstValueFrom(this.meetings.create(this.buildCreateRequest()));
      this.notify.success(result.outcome === 'requested' ? 'Sent for approval' : 'Meeting created');
      if (result.skipped.length > 0) {
        const reasons = [...new Set(result.skipped.map((s) => s.reason))].join(', ');
        this.notify.warning(`${result.skipped.length} people were not invited: ${reasons}`);
      }
      this.saved.emit(result);
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

  protected presetLabel(preset: RecurrencePreset): string {
    return RECURRENCE_PRESET_LABELS[preset];
  }

  private async loadProjects(): Promise<void> {
    try {
      const page = await firstValueFrom(this.projectApi.listMine(1, 100));
      this.projects.set(page.items.map((p) => ({ id: p.id, name: p.name })));
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
