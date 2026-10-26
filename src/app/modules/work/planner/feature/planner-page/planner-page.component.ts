import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { NotificationService } from '../../../../../core/services/notification.service';
import { MeetingOccurrenceDrawerComponent } from '../../../meetings/feature/meeting-occurrence-drawer/meeting-occurrence-drawer.component';
import { MeetingOccurrenceKey } from '../../../meetings/state/meeting-occurrence.store';
import { toOffsetIso, toZonedParts } from '../../../meetings/utils/meeting-time';
import { PlannerApiService } from '../../data-access/planner-api.service';
import { PlannerBlockView, PlannerDayResponse, PlannerMeetingView } from '../../models/planner.models';
import { PlannerAvailabilityService } from '../../state/planner-availability.service';
import { plannerErrorMessage } from '../../utils/planner-error-messages';

const DAY_START_MINUTES = 6 * 60;
const DAY_END_MINUTES = 22 * 60;
const SLOT_MINUTES = 30;
const NEW_BLOCK_MINUTES = 60;
const RESIZE_STEP_MINUTES = 15;
const MINUTES_PER_DAY = 24 * 60;

type TimelineItem = { kind: 'block'; block: PlannerBlockView; start: number } | { kind: 'meeting'; meeting: PlannerMeetingView; start: number };

/**
 * Day planner (backend docs/api/planner-v1.md): today's task blocks next to today's meetings, planned vs actual per row and
 * for the day. Due or overdue tasks are dragged onto a time slot to plan them; a block can be dragged to another slot,
 * made 15 minutes longer or shorter, or removed. Earlier days are read-only.
 */
@Component({
  selector: 'app-planner-page',
  standalone: true,
  imports: [MeetingOccurrenceDrawerComponent],
  template: `
    <div class="flex flex-col gap-4 p-4">
      <header class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 class="text-lg font-semibold">Planner</h1>
          @if (day(); as d) {
            <p class="text-xs text-[var(--color-text-secondary)]">{{ d.date }} · {{ d.timezone }}@if (!d.editable) { · read-only }</p>
          }
        </div>
        <div class="flex items-center gap-2 text-sm">
          <button type="button" class="rounded-md border px-2 py-1" (click)="shiftDay(-1)">Previous day</button>
          @if (date()) {
            <button type="button" class="rounded-md border px-2 py-1" (click)="goToday()">Today</button>
          }
        </div>
      </header>

      @if (unavailable(); as message) {
        <p data-testid="planner-unavailable" class="text-sm">{{ message }}</p>
      } @else if (day(); as d) {
        <section data-testid="planner-totals" class="flex gap-6 rounded-md border p-3 text-sm">
          <span>Planned <strong>{{ duration(d.totals.plannedMinutes) }}</strong></span>
          <span>Actual <strong>{{ duration(d.totals.actualMinutes) }}</strong></span>
          <span data-testid="planner-attendance">Attendance <strong>{{ duration(d.attendanceMinutes) }}</strong></span>
        </section>

        <div class="grid gap-4 md:grid-cols-[1fr_18rem]">
          <section class="flex flex-col rounded-md border">
            @for (slot of slots; track slot) {
              <div class="flex min-h-10 gap-2 border-b px-2 py-1 text-xs" data-testid="planner-slot"
                (dragover)="d.editable && $event.preventDefault()" (drop)="onDrop($event, slot)">
                <span class="w-12 shrink-0 text-[var(--color-text-secondary)]">{{ clock(slot) }}</span>
                <div class="flex flex-1 flex-col gap-1">
                  @for (item of itemsIn(slot); track $index) {
                    @if (item.kind === 'meeting') {
                      <button type="button" data-testid="planner-meeting" class="rounded-md bg-[var(--color-surface-secondary)] px-2 py-1 text-left"
                        [class.line-through]="item.meeting.cancelled || item.meeting.declined" (click)="openMeeting(item.meeting)">
                        {{ range(item.meeting.startAt, item.meeting.endAt) }} · {{ item.meeting.title }}
                        · {{ duration(item.meeting.plannedMinutes) }} planned · {{ duration(item.meeting.actualMinutes) }} actual
                      </button>
                    } @else {
                      <div data-testid="planner-block" class="flex flex-wrap items-center gap-2 rounded-md border px-2 py-1"
                        [attr.draggable]="d.editable ? 'true' : null" (dragstart)="drag($event, 'block', item.block.id)">
                        <span class="font-medium">{{ item.block.taskTitle }}</span>
                        <span>{{ range(item.block.startAt, item.block.endAt) }}</span>
                        <span>{{ duration(item.block.plannedMinutes) }} planned · {{ duration(item.block.actualMinutes) }} actual</span>
                        @if (item.block.overlapsMeeting) {
                          <span data-testid="planner-block-conflict" class="text-[var(--color-warning)]">Overlaps a meeting</span>
                        }
                        @if (!item.block.stillAssigned) {
                          <span class="text-[var(--color-text-secondary)]">No longer assigned to you</span>
                        }
                        @if (d.editable) {
                          <button type="button" data-testid="planner-block-shorter" aria-label="15 minutes shorter" (click)="resize(item.block, -15)">−15</button>
                          <button type="button" data-testid="planner-block-longer" aria-label="15 minutes longer" (click)="resize(item.block, 15)">+15</button>
                          <button type="button" data-testid="planner-block-delete" [attr.aria-label]="'Remove ' + item.block.taskTitle" (click)="remove(item.block)">✕</button>
                        }
                      </div>
                    }
                  }
                </div>
              </div>
            }
          </section>

          <aside class="flex flex-col gap-2">
            <h2 class="text-sm font-semibold">Due or overdue</h2>
            @for (task of d.dueTasks; track task.taskId) {
              <div data-testid="planner-due-task" class="rounded-md border px-2 py-1 text-xs"
                [attr.draggable]="d.editable ? 'true' : null" (dragstart)="drag($event, 'task', task.taskId)">
                <div class="font-medium">{{ task.title }}</div>
                <div class="text-[var(--color-text-secondary)]">Due {{ task.dueDate }}@if (task.estimatedHours) { · {{ task.estimatedHours }} h }</div>
              </div>
            } @empty {
              <p class="text-xs text-[var(--color-text-secondary)]">Nothing due.</p>
            }
            @if (d.editable) {
              <p class="text-xs text-[var(--color-text-secondary)]">Drag a task onto a time to plan it.</p>
            }
          </aside>
        </div>
      }
    </div>

    @if (openKey(); as key) {
      <app-meeting-occurrence-drawer [key]="key" (closed)="openKey.set(null)" />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlannerPageComponent implements OnInit {
  private readonly api = inject(PlannerApiService);
  private readonly notify = inject(NotificationService);
  private readonly availability = inject(PlannerAvailabilityService);

  readonly slots: readonly number[] = Array.from({ length: (DAY_END_MINUTES - DAY_START_MINUTES) / SLOT_MINUTES },
    (_, i) => DAY_START_MINUTES + i * SLOT_MINUTES);
  readonly day = signal<PlannerDayResponse | null>(null);
  /** Null means today. */
  readonly date = signal<string | null>(null);
  readonly unavailable = signal<string | null>(null);
  readonly openKey = signal<MeetingOccurrenceKey | null>(null);

  private readonly items = computed<TimelineItem[]>(() => {
    const d = this.day();
    if (!d) return [];
    return [
      ...d.meetings.map((meeting) => ({ kind: 'meeting' as const, meeting, start: this.minutesOf(meeting.startAt, d.timezone) })),
      ...d.blocks.map((block) => ({ kind: 'block' as const, block, start: this.minutesOf(block.startAt, d.timezone) })),
    ].sort((a, b) => a.start - b.start);
  });

  ngOnInit(): void {
    void this.load();
  }

  itemsIn(slot: number): TimelineItem[] {
    const first = slot === DAY_START_MINUTES;
    const last = slot + SLOT_MINUTES >= DAY_END_MINUTES;
    // Items outside 06:00-22:00 still show, in the first or the last row.
    return this.items().filter((i) => (i.start >= slot && i.start < slot + SLOT_MINUTES) || (first && i.start < slot) || (last && i.start >= slot + SLOT_MINUTES));
  }

  async dropTask(taskId: string, slotMinutes: number): Promise<void> {
    const d = this.day();
    if (!d?.editable) return;
    await this.write(() => this.api.createBlock({
      taskId, startAt: this.at(d, slotMinutes), endAt: this.at(d, slotMinutes + NEW_BLOCK_MINUTES),
    }));
  }

  async moveTo(block: PlannerBlockView, slotMinutes: number): Promise<void> {
    const d = this.day();
    if (!d?.editable) return;
    const length = (Date.parse(block.endAt) - Date.parse(block.startAt)) / 60000;
    await this.write(() => this.api.moveBlock(block.id, { startAt: this.at(d, slotMinutes), endAt: this.at(d, slotMinutes + length) }));
  }

  async resize(block: PlannerBlockView, deltaMinutes: number): Promise<void> {
    const d = this.day();
    if (!d?.editable) return;
    // From the start and length, not the end's clock time: a block ending at midnight ends at 24:00, not 00:00.
    const length = (Date.parse(block.endAt) - Date.parse(block.startAt)) / 60000;
    const end = this.minutesOf(block.startAt, d.timezone) + length + Math.sign(deltaMinutes) * RESIZE_STEP_MINUTES;
    await this.write(() => this.api.moveBlock(block.id, { startAt: block.startAt, endAt: this.at(d, end) }));
  }

  async remove(block: PlannerBlockView): Promise<void> {
    await this.write(() => this.api.deleteBlock(block.id));
  }

  drag(event: DragEvent, kind: 'task' | 'block', id: string): void {
    event.dataTransfer?.setData('text/plain', `${kind}:${id}`);
  }

  async onDrop(event: DragEvent, slot: number): Promise<void> {
    event.preventDefault();
    const [kind, id] = (event.dataTransfer?.getData('text/plain') ?? '').split(':');
    if (kind === 'task' && id) await this.dropTask(id, slot);
    const block = kind === 'block' ? this.day()?.blocks.find((b) => b.id === id) : undefined;
    if (block) await this.moveTo(block, slot);
  }

  openMeeting(meeting: PlannerMeetingView): void {
    this.openKey.set({ seriesId: meeting.seriesId, originalStart: meeting.originalStart });
  }

  shiftDay(days: number): void {
    const base = this.date() ?? this.day()?.date;
    if (!base) return;
    const next = new Date(`${base}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + days);
    this.date.set(next.toISOString().slice(0, 10));
    void this.load();
  }

  goToday(): void {
    this.date.set(null);
    void this.load();
  }

  protected duration(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  protected clock(minutes: number): string {
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  }

  protected range(startIso: string, endIso: string): string {
    const zone = this.day()?.timezone ?? 'UTC';
    return `${toZonedParts(startIso, zone).time}–${toZonedParts(endIso, zone).time}`;
  }

  private async load(): Promise<void> {
    try {
      this.day.set(await firstValueFrom(this.api.getMyDay(this.date())));
      this.unavailable.set(null);
      this.availability.markAvailable(true);
    } catch (e) {
      if (this.codeOf(e) === 'planner_disabled') this.availability.markAvailable(false);
      this.unavailable.set(plannerErrorMessage(this.codeOf(e)));
    }
  }

  private async write(run: () => ReturnType<PlannerApiService['createBlock']>): Promise<void> {
    try {
      this.day.set(await firstValueFrom(run()));
    } catch (e) {
      this.notify.error(plannerErrorMessage(this.codeOf(e)));
    }
  }

  /** The day's date at <minutes> past midnight; minutes beyond 24:00 fall on the next date (never "24:30"). */
  private at(d: PlannerDayResponse, minutes: number): string {
    const date = new Date(`${d.date}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + Math.floor(minutes / MINUTES_PER_DAY));
    const wrapped = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    return toOffsetIso(date.toISOString().slice(0, 10), this.clock(wrapped), d.timezone);
  }

  private minutesOf(iso: string, zone: string): number {
    const [h, m] = toZonedParts(iso, zone).time.split(':').map(Number);
    return h * 60 + m;
  }

  private codeOf(e: unknown): string | undefined {
    return e instanceof HttpErrorResponse ? (e.error?.code as string | undefined) : undefined;
  }
}
