import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';
import { FieldIconComponent } from '../../../../shared/ui/field-icon/field-icon.component';
import { RichTextEditorComponent } from '../../../../shared/ui/rich-text-editor/rich-text-editor.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { TimePickerComponent } from '../../../../shared/ui/time-picker/time-picker.component';
import { ProjectApiService } from '../../../work/data-access/project-api.service';
import { TaskApiService } from '../../../work/data-access/task-api.service';
import { TaskCategoryDto } from '../../../work/models/dto/task-category.dto';
import { WorkTaskDto } from '../../../work/models/dto/task.dto';
import { TaskKindIconComponent } from '../../../work/ui/task-kind-icon/task-kind-icon.component';
import { toOffsetIso, toZonedParts } from '../../../work/meetings/utils/meeting-time';
import { PlannerApiService } from '../../../work/planner/data-access/planner-api.service';
import { PlannerRangeDay } from '../../../work/planner/models/planner.models';
import { kindOf } from '../../../work/utils/task-kind';
import { windowMinutes } from '../../utils/planner-grid.util';
import { WorkItemPlanFlow } from '../../state/work-item-plan-flow.service';
import { MIN_BLOCK_MINUTES, MinuteRange, PlanDay, placeMinutes } from './plan-continuation';
import { CreateSlot, SharedCreateDraft, clock } from './planner-create-draft';
import { TEXT_LIMITS } from '../../../../shared/constants/text-limits';

/** What the Work item tab held, for the full Create work item form ("More options"). */
export interface WorkItemDraft {
  title: string; description: string | null; projectId: string | null; objectiveId: string | null; categoryId: string | null;
  priority: WorkTaskDto['priority']; estimatedHours: number | null; dueDate: string | null;
  /** Null when no time was picked: the full form then creates the item without planning it. */
  slot: CreateSlot | null;
  /** The rest of the work, on later days, when the plan stops at the end of working time. */
  continuation: readonly CreateSlot[];
}

/** The task to place with the block picker after a refused plan ("Pick another time"). */
export interface WorkItemToPlace { taskId: string; shortId: string; title: string; projectId: string; estimatedMinutes: number | null; }

/** 'HH:mm' to minutes after midnight; null when empty. */
function clockMinutes(value: string): number | null {
  if (!value) return null;
  const [h, m] = value.split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
}

/** "6:00 PM". */
function clock12(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  return `${h % 12 || 12}:${String(minutes % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** "Mon 9 Nov". */
function dayLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).replace(',', '');
}

/** How far ahead the rest of a work item may be planned. */
const CONTINUE_DAYS = 14;
const LAST_MINUTE = 24 * 60 - 1;

function duration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/**
 * Work item tab of the Planner create popover: create a work item for me and plan it at the picked slot, whose
 * times can be changed here. A new Estimate moves the End; a new End leaves the Estimate alone (a plan can be part of the effort).
 * A due date is a deadline, not the plan: it only fills an empty plan date. New event's stand-in time is never used here.
 * A plan past working time is allowed: the tab says so, and offers to stop at the end of working time and carry on later.
 */
@Component({
  selector: 'app-planner-work-item-tab',
  standalone: true,
  imports: [DatePickerComponent, FieldIconComponent, RichTextEditorComponent, SelectComponent, TimePickerComponent, TaskKindIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wi">
      <input data-testid="work-item-title" class="wi-title" placeholder="Work item title" aria-label="Work item title" [value]="shared().title()"
        (input)="shared().title.set($any($event.target).value)" />
      <app-rich-text-editor class="wi-description" ariaLabel="Description" [compact]="true" [allowAttachments]="false" [allowImages]="false"
        [maxLength]="limits.richTextDescription" (htmlChange)="onDescription($event)" />

      <div class="wi-chips">
        <span class="wi-chip-static" title="A work item planned here is yours"><app-field-icon name="user" /> Me</span>
        <app-select class="wi-chip" [class.wi-chip--active]="projectId()" data-testid="work-item-project" icon="briefcase" ariaLabel="Project"
          placeholder="Select project" [options]="projectOptions()" [value]="projectId() ?? ''" (valueChange)="selectProject($event)" />
        <app-select class="wi-chip" [class.wi-chip--active]="objectiveId()" data-testid="work-item-module" icon="folder" ariaLabel="Milestone"
          placeholder="Select milestone" [options]="moduleOptions()" [value]="objectiveId() ?? ''" [disabled]="!projectId()"
          (valueChange)="objectiveId.set($event || null)" />
        <app-select class="wi-chip wi-chip--active" data-testid="work-item-priority" icon="flag" ariaLabel="Priority" [searchable]="false"
          [options]="priorityOptions" [value]="priority()" (valueChange)="setPriority($event)" />
        <app-date-picker variant="chip" chipClass="wi-date-chip" btnTestId="work-item-due" emptyLabel="Due date" [value]="dueDate() ?? ''"
          (valueChange)="setDue($event)" />
        <span class="wi-type" [class.wi-type--icon]="selectedKind()">
          @if (selectedKind(); as kind) { <app-task-kind-icon class="wi-type__icon" data-testid="work-item-type-icon" [kind]="kind" [icon]="selectedIcon()" /> }
          <app-select class="wi-chip" [class.wi-chip--active]="categoryId()" data-testid="work-item-type" ariaLabel="Type" placeholder="Type"
            [searchable]="false" [options]="categoryOptions()" [value]="categoryId() ?? ''" [disabled]="!projectId()"
            (valueChange)="categoryId.set($event || null)" />
        </span>
      </div>
      <div class="wi-section"><span class="wi-section__title">Planning &amp; details</span><span class="wi-section__line"></span></div>
      <div class="wi-planning">
        <label class="wi-field">
          <span class="wi-field__label">Estimated</span>
          <span class="wi-box">
            <input data-testid="work-item-estimate" class="wi-box__input" type="number" min="0" step="0.25" placeholder="0" [value]="estimate()"
              (input)="setEstimate($any($event.target).value)" />
            <span class="wi-box__unit">h</span>
          </span>
        </label>
        <div class="wi-field wi-time wi-date">
          <span class="wi-field__label">Date</span>
          <app-date-picker data-testid="work-item-date" ariaLabel="Plan date" placeholder="Select date" [showClear]="false" [minDate]="minDate()"
            [value]="planDate() ?? ''" (valueChange)="setPlanDate($event)" />
        </div>
        <div class="wi-field wi-time">
          <span class="wi-field__label">Start</span>
          <app-time-picker data-testid="work-item-start" [value]="startClock()" (valueChange)="setStart($event)" />
        </div>
        <svg class="wi-arrow" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        <div class="wi-field wi-time">
          <span class="wi-field__label">End</span>
          <app-time-picker data-testid="work-item-end" [value]="endClock()" (valueChange)="setEnd($event)" />
        </div>
        <p data-testid="work-item-plan" class="wi-plan">{{ planLabel() }}</p>
      </div>
      @if (timeInvalid()) {
        <p data-testid="work-item-time-invalid" role="alert" class="wi-error">End must be after Start.</p>
      } @else if (!plan()) {
        <p data-testid="work-item-pick-time-hint" class="wi-hint">Pick a date, start and end to plan this work item.</p>
      }
      @if (afterDue()) {
        <p data-testid="work-item-after-due" class="wi-warning">This plan finishes after the due date.</p>
      }
      @if (outsideWorkMessage(); as message) {
        <div class="wi-notice" data-testid="work-item-overtime">
          <p class="wi-notice__text">{{ message }}</p>
          @if (canContinue()) {
            <div class="wi-choices" role="radiogroup" aria-label="When to finish this work item">
              <label class="wi-choice">
                <input type="radio" name="work-item-overtime" data-testid="work-item-keep-working" [checked]="!continuing()" (change)="overtimeChoice.set('keep')" />
                <span>Keep working until {{ endLabel() }}</span>
              </label>
              <label class="wi-choice">
                <input type="radio" name="work-item-overtime" data-testid="work-item-continue" [checked]="continuing()" (change)="overtimeChoice.set('continue')" />
                <span>Stop at {{ workEndLabel() }} and continue on {{ continueDayLabel() }}</span>
              </label>
            </div>
          }
          @if (continuing()) {
            <p class="wi-notice__text" data-testid="work-item-continue-preview">{{ continuePreview() }}</p>
          }
        </div>
      }

      @if (shared().isAllDay()) {
        <p data-testid="work-item-all-day-note" class="text-xs text-[var(--color-danger)]">Turn off All day to plan a work item.</p>
      }
      @if (overlaps()) {
        <p data-testid="work-item-overlap" class="text-xs text-[var(--color-warning-text)]">This overlaps one of your planned blocks, so planning it here will be refused.</p>
      }

      @switch (flow.state().kind) {
        @case ('pending') { <p data-testid="work-item-pending" class="text-xs">{{ pendingMessage() }}</p> }
        @case ('unknown') {
          <p data-testid="work-item-unknown" class="text-xs text-[var(--color-danger)]">We couldn't confirm the work item was created. Check your Task list before trying again.</p>
        }
        @case ('error') { <p data-testid="work-item-error" class="text-xs text-[var(--color-danger)]">{{ errorMessage() }}</p> }
        @case ('notPlanned') {
          <div data-testid="work-item-not-planned" class="flex flex-col gap-2 rounded-md border border-[var(--color-warning)] bg-[var(--color-warning-subtle)] p-2 text-xs">
            <span>{{ notPlannedMessage() }}</span>
            <div class="flex gap-2">
              <button type="button" data-testid="work-item-retry" class="rounded-md border px-2 py-1" (click)="flow.retryPlanning()">Retry planning</button>
              <button type="button" data-testid="work-item-pick-time" class="rounded-md border px-2 py-1" (click)="pickTime()">Pick another time</button>
            </div>
          </div>
        }
      }

      <div class="wi-footer">
        <button type="button" data-testid="work-item-more" class="wi-more" (click)="moreOptions.emit(draft())">More options</button>
        <button type="button" data-testid="work-item-cancel" class="wi-btn" (click)="closed.emit()">Cancel</button>
        <button type="button" data-testid="work-item-create" class="wi-btn wi-btn--primary"
          [disabled]="!canCreate()" (click)="create()">{{ flow.state().kind === 'busy' ? 'Creating…' : 'Create & plan' }}</button>
      </div>
    </div>
  `,
  styles: [`
    /* The same smaller field as the Meeting tab: fields.css reads these two. */
    .wi { --field-height: 2.125rem; --field-font-size: 0.8125rem; display: flex; flex-direction: column; gap: 12px; font-size: 13px; color: var(--color-text-primary); }
    /* The same look as the full Create work item form. */
    .wi-title { width: 100%; padding: 8px; border: 1px solid transparent; border-radius: 8px; font-size: 18px; font-weight: 650; outline: none;
      color: var(--color-text-primary); background: transparent; transition: background-color 140ms ease, border-color 140ms ease; }
    .wi-title:hover:not(:focus) { background: var(--color-surface-secondary); }
    .wi-title:focus { border-color: var(--color-border); }
    .wi-title::placeholder { color: var(--color-text-secondary); }

    .wi-chips { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; }
    .wi-chip-static { display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 12px; border: 1px solid var(--color-border); border-radius: 9999px;
      font-weight: 500; background: var(--color-surface); }
    .wi-chip { display: inline-block; flex: none; width: auto; }
    .wi-chip ::ng-deep .ui-field { position: relative; height: 34px; padding: 0 12px; border-radius: 9999px; background: var(--color-surface-secondary);
      box-shadow: none; cursor: pointer; transition: background-color 140ms ease, border-color 140ms ease; }
    .wi-chip ::ng-deep .ui-field:hover { background: var(--color-surface); border-color: color-mix(in srgb, var(--color-accent) 45%, var(--color-border)); }
    .wi-chip--active ::ng-deep .ui-field { background: var(--color-surface); }
    .wi-chip ::ng-deep .ui-field__addon { min-width: 0; padding: 0; border-right: 0; color: var(--color-text-primary); }
    .wi-chip ::ng-deep .ui-field__addon svg { width: 14px; height: 14px; }
    .wi-chip ::ng-deep .app-select__trigger { padding: 0 0 0 6px; font-size: 13px; font-weight: 500; }
    .wi-chip ::ng-deep .app-select__trigger > svg { display: none; }
    .wi-chip ::ng-deep .app-select__value { max-width: 180px; color: var(--color-text-primary); }
    /* The whole chip opens the list, icon included: the icon sits outside the select's button. */
    .wi-chip ::ng-deep .app-select__trigger::before { content: ''; position: absolute; inset: 0; }

    .wi-type { position: relative; display: inline-flex; }
    .wi-type__icon { position: absolute; left: 12px; top: 50%; z-index: 1; transform: translateY(-50%); pointer-events: none; }
    .wi-type--icon .wi-chip ::ng-deep .ui-field { padding-left: 28px; }

    :host ::ng-deep .dp-chip.wi-date-chip { display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 12px; border: 1px solid var(--color-border);
      border-radius: 9999px; font-size: 13px; font-weight: 500; color: var(--color-text-primary); background: var(--color-surface-secondary); cursor: pointer; }
    :host ::ng-deep .dp-chip.wi-date-chip:hover { background: var(--color-surface); border-color: color-mix(in srgb, var(--color-accent) 45%, var(--color-border)); }
    :host ::ng-deep .dp-chip.wi-date-chip.dp-chip--active { background: var(--color-surface); }
    :host ::ng-deep .dp-chip.wi-date-chip svg { width: 14px; height: 14px; }

    .wi-section { display: flex; align-items: center; gap: 12px; margin-top: 4px; }
    .wi-section__title { font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--color-text-secondary); }
    .wi-section__line { flex: 1; height: 1px; background: var(--color-border); }
    .wi-planning { display: flex; align-items: flex-end; gap: 16px; }
    .wi-field { display: flex; flex-direction: column; gap: 4px; }
    .wi-field__label { font-size: 11px; font-weight: 600; color: var(--color-text-secondary); }
    .wi-box { display: inline-flex; align-items: center; gap: 4px; height: 34px; padding: 0 10px; border: 1px solid var(--color-border); border-radius: 7px;
      background: var(--color-surface); }
    .wi-box__input { width: 56px; border: 0; outline: none; font-size: 13px; font-weight: 600; color: var(--color-text-primary); background: transparent; }
    .wi-box__unit { font-size: 12px; font-weight: 600; color: var(--color-text-secondary); }
    .wi-time { width: 126px; flex: none; }
    .wi-time ::ng-deep .ui-field__addon { min-width: 0; padding: 0 0 0 12px; border-right: 0; color: var(--color-text-primary); }
    .wi-time ::ng-deep .ui-field__control { padding-left: 6px; padding-right: 0; }
    .wi-time ::ng-deep .ui-field__trailing { padding-right: 2px; }
    .wi-arrow { flex: none; height: 34px; margin: 0 -8px; }
    .wi-plan { display: flex; align-items: center; height: 34px; margin: 0; font-weight: 500; color: var(--color-accent); }
    .wi-date { width: 122px; }
    .wi-date ::ng-deep .ui-field__trailing { display: none; }
    .wi-error { margin: 0; font-size: 12px; color: var(--color-danger); }
    .wi-hint { margin: 0; font-size: 12px; color: var(--color-text-secondary); }
    .wi-warning { margin: 0; font-size: 12px; color: var(--color-warning-text); }
    .wi-notice { display: flex; flex-direction: column; gap: 8px; padding: 10px 12px; border: 1px solid var(--color-warning); border-radius: 8px;
      background: var(--color-warning-subtle); }
    .wi-notice__text { margin: 0; font-size: 12px; color: var(--color-warning-text); }
    .wi-choices { display: flex; flex-direction: column; gap: 6px; }
    .wi-choice { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 500; cursor: pointer; }
    .wi-choice input { width: 15px; height: 15px; accent-color: var(--color-accent); cursor: pointer; }

    .wi-footer { display: flex; align-items: center; justify-content: flex-end; gap: 10px; padding-top: 12px; border-top: 1px solid var(--color-border); }
    .wi-more { margin-right: auto; padding: 6px 8px; border: 0; border-radius: 7px; font-size: 13px; font-weight: 500; color: var(--color-text-secondary); background: transparent; cursor: pointer; }
    .wi-more:hover { color: var(--color-text-primary); background: var(--color-surface-secondary); }
    .wi-btn { min-width: 80px; height: 34px; padding: 0 16px; border: 1px solid var(--color-border); border-radius: 8px; font-size: 13px; font-weight: 600;
      color: var(--color-text-primary); background: var(--color-surface); cursor: pointer; }
    .wi-btn:hover { background: var(--color-surface-secondary); }
    .wi-btn--primary { border-color: var(--color-accent); color: var(--color-text-on-solid); background: var(--color-accent); }
    .wi-btn--primary:hover { background: var(--color-accent); opacity: 0.9; }
    .wi-btn--primary:disabled { opacity: 0.55; cursor: not-allowed; }
  `],
})
export class WorkItemTabComponent implements OnInit {
  readonly limits = TEXT_LIMITS;
  readonly flow = inject(WorkItemPlanFlow);
  private readonly projectApi = inject(ProjectApiService);
  private readonly taskApi = inject(TaskApiService);
  private readonly plannerApi = inject(PlannerApiService);

  readonly slot = input.required<CreateSlot>();
  /** The planner's zone: the slot's wall-clock times are in it. */
  readonly timezone = input.required<string>();
  readonly shared = input.required<SharedCreateDraft>();
  /** My planned blocks: a slot over one of them would be refused. */
  readonly myBlocks = input<readonly { startAt: string; endAt: string }[]>([]);
  readonly done = output<void>();
  readonly moreOptions = output<WorkItemDraft>();
  readonly closed = output<void>();
  readonly pickAnotherTime = output<WorkItemToPlace>();

  readonly priorityOptions: readonly SelectOption[] = [
    { value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }, { value: 'critical', label: 'Critical' },
  ];
  readonly projects = signal<readonly { id: string; name: string }[]>([]);
  readonly modules = signal<readonly { id: string; title: string }[]>([]);
  readonly categories = signal<readonly TaskCategoryDto[]>([]);
  readonly projectId = signal<string | null>(null);
  readonly objectiveId = signal<string | null>(null);
  readonly categoryId = signal<string | null>(null);
  readonly priority = signal<WorkTaskDto['priority']>('medium');
  readonly estimate = signal<number | null>(null);
  readonly dueDate = signal<string | null>(null);
  readonly description = signal<string | null>(null);

  readonly projectOptions = computed<readonly SelectOption[]>(() => this.projects().map((p) => ({ value: p.id, label: p.name })));
  readonly moduleOptions = computed<readonly SelectOption[]>(() => this.modules().map((m) => ({ value: m.id, label: m.title })));
  readonly categoryOptions = computed<readonly SelectOption[]>(() => this.categories().map((c) => ({ value: c.id, label: c.name })));

  /** The slot's day and the days after it: their work windows and planned blocks. */
  private readonly days = signal<readonly PlannerRangeDay[]>([]);
  /** Past working time: work on, or stop at the end of it and carry on later. */
  readonly overtimeChoice = signal<'keep' | 'continue'>('keep');
  /** The times picked here; null keeps the slot's own. */
  private readonly startMinutes = signal<number | null>(null);
  private readonly endMinutes = signal<number | null>(null);
  /** The day to plan on: the picked slot's, and empty until chosen when no slot was picked. */
  readonly planDate = signal<string | null>(null);
  /** Today in the planner's zone: earlier days can't be planned. */
  readonly minDate = computed(() => toZonedParts(new Date().toISOString(), this.timezone()).date);
  private readonly shownStart = computed(() => this.startMinutes() ?? (this.slot().isDefault ? null : this.slot().startMinutes));
  private readonly shownEnd = computed(() => this.endMinutes() ?? (this.slot().isDefault ? null : this.slot().endMinutes));
  /** The slot to plan, once it has a date, a start and an end. An edge the user left alone keeps its exact instant. */
  readonly plan = computed<CreateSlot | null>(() => {
    const slot = this.slot();
    const date = this.planDate();
    const start = this.shownStart();
    const end = this.shownEnd();
    if (!date || start === null || end === null) return null;
    const sameDay = date === slot.date && !slot.isDefault;
    return {
      date, startMinutes: start, endMinutes: end,
      startIso: sameDay && start === slot.startMinutes ? slot.startIso : this.toIso(date, start),
      endIso: sameDay && end === slot.endMinutes ? slot.endIso : this.toIso(date, end),
    };
  });
  private readonly today = computed(() => this.days().find((d) => d.date === this.planDate()) ?? null);
  private readonly workWindow = computed(() => {
    const window = this.today()?.workWindow;
    return window?.isWorkingDay ? windowMinutes(window) : null;
  });
  /** The part of the plan after working time. */
  private readonly overtimeMinutes = computed(() => {
    const window = this.workWindow();
    const plan = this.plan();
    return window && plan ? Math.max(plan.endMinutes - Math.max(window.end, plan.startMinutes), 0) : 0;
  });
  /** An estimate too long for the day: End stops at midnight, and this much is left. */
  private readonly pastMidnightMinutes = computed(() => {
    const estimate = this.estimate();
    const plan = this.plan();
    return estimate && plan && plan.endMinutes >= LAST_MINUTE ? Math.max(plan.startMinutes + Math.round(estimate * 60) - LAST_MINUTE, 0) : 0;
  });
  private readonly laterDays = computed<readonly PlanDay[]>(() => this.days()
    .filter((d) => d.date > (this.planDate() ?? '') && d.editable && d.workWindow?.isWorkingDay)
    .map((d) => {
      const window = windowMinutes(d.workWindow!);
      const lunch: MinuteRange[] = window.breakStart !== null && window.breakEnd !== null ? [{ start: window.breakStart, end: window.breakEnd }] : [];
      return { date: d.date, window: { start: window.start, end: window.end },
        busy: [...lunch, ...d.blocks.map((b) => ({ start: this.minutesOf(b.startAt), end: this.minutesOf(b.endAt) }))] };
    }));
  private readonly continuation = computed(() => placeMinutes(this.laterDays(), this.overtimeMinutes() + this.pastMidnightMinutes()));
  /** There must be a block's worth of today left, and somewhere to put the rest. */
  readonly canContinue = computed(() => {
    const window = this.workWindow();
    const plan = this.plan();
    return !!window && !!plan && this.overtimeMinutes() > 0 && window.end - plan.startMinutes >= MIN_BLOCK_MINUTES && this.continuation().parts.length > 0;
  });
  readonly continuing = computed(() => this.overtimeChoice() === 'continue' && this.canContinue());
  /** What gets planned: the whole plan, or today's part and the rest. */
  readonly slots = computed<readonly CreateSlot[]>(() => {
    const plan = this.plan();
    if (!plan) return [];
    if (!this.continuing()) return [plan];
    const end = this.workWindow()!.end;
    return [
      { ...plan, endMinutes: end, endIso: this.toIso(plan.date, end) },
      ...this.continuation().parts.map((part) => ({ ...part, startIso: this.toIso(part.date, part.startMinutes), endIso: this.toIso(part.date, part.endMinutes) })),
    ];
  });
  readonly endLabel = computed(() => clock12(this.plan()?.endMinutes ?? 0));
  readonly workEndLabel = computed(() => clock12(this.workWindow()?.end ?? 0));
  readonly continueDayLabel = computed(() => {
    const first = this.continuation().parts[0]?.date;
    return first ? dayLabel(first) : '';
  });
  readonly outsideWorkMessage = computed(() => {
    if (this.timeInvalid() || !this.plan()) return '';
    const day = this.today();
    if (day?.workWindow && !day.workWindow.isWorkingDay) return 'This is not a working day. You can still plan it.';
    const window = this.workWindow();
    const over = this.overtimeMinutes();
    if (!window || over === 0) return '';
    return `This plan runs ${duration(over)} past your working time, which ends at ${clock12(window.end)}.`;
  });
  readonly continuePreview = computed(() => {
    const parts = this.slots().map((s) => `${dayLabel(s.date)} ${clock12(s.startMinutes)}–${clock12(s.endMinutes)}`);
    const unplaced = this.continuation().unplaced;
    return `${parts.join(', ')}.${unplaced > 0 ? ` ${duration(unplaced)} doesn't fit in the next two weeks and stays unplanned.` : ''}`;
  });
  /** A plan that ends after the deadline, the carried-over parts included. */
  readonly afterDue = computed(() => {
    const due = this.dueDate();
    const last = this.slots().at(-1);
    return !!due && !!last && last.date > due;
  });
  readonly startClock = computed(() => {
    const start = this.shownStart();
    return start === null ? '' : clock(start);
  });
  /** A slot running to midnight ends at 24:00, which the time picker can't show. */
  readonly endClock = computed(() => {
    const end = this.shownEnd();
    return end === null ? '' : clock(Math.min(end, LAST_MINUTE));
  });
  /** Null until both times are set. */
  readonly planMinutes = computed(() => {
    const start = this.shownStart();
    const end = this.shownEnd();
    return start === null || end === null ? null : end - start;
  });
  readonly timeInvalid = computed(() => (this.planMinutes() ?? 1) <= 0);
  readonly planLabel = computed(() => {
    const minutes = this.planMinutes();
    return minutes === null || minutes <= 0 ? '' : duration(minutes);
  });
  readonly selectedKind = computed(() => {
    const category = this.categories().find((c) => c.id === this.categoryId());
    return category ? kindOf(category.kind) : null;
  });
  readonly selectedIcon = computed(() => this.categories().find((c) => c.id === this.categoryId())?.icon ?? null);
  readonly overlaps = computed(() => {
    const first = this.slots().at(0);
    if (!first) return false;
    const start = Date.parse(first.startIso);
    const end = Date.parse(first.endIso);
    const blocks = this.today()?.blocks ?? (first.date === this.slot().date ? this.myBlocks() : []);
    return blocks.some((b) => Date.parse(b.startAt) < end && Date.parse(b.endAt) > start);
  });
  // Only before a create or after a refused one: in every other state the item exists or may exist.
  readonly canCreate = computed(() => ['idle', 'error'].includes(this.flow.state().kind) && !this.shared().isAllDay()
    && !this.timeInvalid() && !!this.plan() && this.shared().title().trim() !== '' && !!this.objectiveId() && !!this.categoryId());
  readonly pendingMessage = computed(() => {
    const first = this.slots().at(0);
    if (!first) return '';
    const [y, m, d] = first.date.split('-').map(Number);
    const day = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
    const message = `Sent for approval. Once approved it's yours and planned for ${day} ${clock(first.startMinutes)}–${clock(first.endMinutes)}.`;
    // An approval plans one slot only.
    return this.slots().length > 1 ? `${message} Plan the rest from your Task list once it's approved.` : message;
  });
  readonly notPlannedMessage = computed(() => {
    const s = this.flow.state();
    return s.kind === 'notPlanned' ? `Created${s.shortId ? ' ' + s.shortId : ''}, not planned: ${s.reason}` : '';
  });
  readonly errorMessage = computed(() => {
    const s = this.flow.state();
    return s.kind === 'error' ? s.message : '';
  });

  constructor() {
    effect(() => {
      if (this.flow.state().kind === 'done') untracked(() => this.done.emit());
    });
  }

  ngOnInit(): void {
    const slot = this.slot();
    if (!slot.isDefault) {
      this.estimate.set(Math.round(((slot.endMinutes - slot.startMinutes) / 60) * 4) / 4);
      this.setPlanDate(slot.date);
    }
    void this.loadProjects();
  }

  /** The End follows the estimate: the plan covers the whole effort, up to the end of the day. */
  setEstimate(value: string): void {
    const hours = value === '' ? null : +value;
    this.estimate.set(hours);
    const start = this.shownStart();
    if (hours && hours > 0 && start !== null) this.endMinutes.set(Math.min(start + Math.round(hours * 60), LAST_MINUTE));
  }

  /** Moving the start keeps the length, up to the end of the day. */
  setStart(value: string): void {
    const start = clockMinutes(value);
    if (start === null) return;
    const length = Math.max(this.planMinutes() ?? Math.round((this.estimate() ?? 0) * 60), 0);
    this.startMinutes.set(start);
    if (length > 0) this.endMinutes.set(Math.min(start + length, LAST_MINUTE));
  }

  setEnd(value: string): void {
    const end = clockMinutes(value);
    if (end !== null) this.endMinutes.set(end);
  }

  private toIso(date: string, minutes: number): string {
    return new Date(toOffsetIso(date, clock(minutes), this.timezone())).toISOString();
  }

  private minutesOf(instant: string): number {
    const [h, m] = toZonedParts(instant, this.timezone()).time.split(':').map(Number);
    return h * 60 + m;
  }

  setPlanDate(date: string): void {
    this.planDate.set(date || null);
    this.days.set([]);
    if (date) void this.loadDays(date);
  }

  /** A deadline: it fills the plan date only while that is empty. */
  setDue(date: string): void {
    this.dueDate.set(date || null);
    if (date && !this.planDate()) this.setPlanDate(date);
  }

  setPriority(priority: string): void {
    this.priority.set(priority as WorkTaskDto['priority']);
  }

  onDescription(html: string): void {
    this.description.set(html.replace(/<[^>]*>/g, '').trim() === '' ? null : html);
  }

  async selectProject(projectId: string): Promise<void> {
    this.projectId.set(projectId || null);
    this.objectiveId.set(null);
    this.modules.set([]);
    this.categories.set([]);
    this.categoryId.set(null);
    if (!projectId) return;
    const [tree, categories] = await Promise.all([
      firstValueFrom(this.projectApi.getProjectTree(projectId)).catch(() => []),
      firstValueFrom(this.taskApi.getCategories(projectId)).catch(() => []),
    ]);
    this.modules.set(tree.map((o) => ({ id: o.id, title: o.title })));
    // The system "meeting" category belongs to real meetings (the Meeting tab), never to a work item.
    const usable = [...categories].filter((c) => c.systemKey !== 'meeting').sort((a, b) => a.displayOrder - b.displayOrder);
    this.categories.set(usable);
    this.categoryId.set(usable[0]?.id ?? null);
  }

  draft(): WorkItemDraft {
    return {
      title: this.shared().title().trim(), description: this.description(), projectId: this.projectId(), objectiveId: this.objectiveId(), categoryId: this.categoryId(),
      priority: this.priority(), estimatedHours: this.estimate(), dueDate: this.dueDate(), slot: this.slots().at(0) ?? null, continuation: this.slots().slice(1),
    };
  }

  create(): void {
    if (!this.canCreate()) return;
    void this.flow.createAndPlan(this.objectiveId()!, {
      title: this.shared().title().trim(), categoryId: this.categoryId()!, priority: this.priority(), sprintId: null,
      ...(this.description() ? { description: this.description()! } : {}),
      ...(this.estimate() !== null ? { estimatedHours: this.estimate()! } : {}),
      ...(this.dueDate() ? { dueDate: this.dueDate()! } : {}),
    }, this.slots()[0], this.slots().slice(1));
  }

  pickTime(): void {
    const s = this.flow.state();
    if (s.kind !== 'notPlanned') return;
    const estimate = this.estimate();
    this.pickAnotherTime.emit({ taskId: s.taskId, shortId: s.shortId, title: this.shared().title().trim(),
      projectId: this.projectId() ?? '', estimatedMinutes: estimate === null ? null : Math.round(estimate * 60) });
  }

  private async loadDays(date: string): Promise<void> {
    try {
      const range = await firstValueFrom(this.plannerApi.getRange(date, addDays(date, CONTINUE_DAYS)));
      // A newer date may have been picked meanwhile.
      if (date === this.planDate()) this.days.set(range.days);
    } catch {
      // Without them the plan is only not checked against working time; it can still be made.
      this.days.set([]);
    }
  }

  private async loadProjects(): Promise<void> {
    try {
      const page = await firstValueFrom(this.projectApi.listMine(1, 100));
      // Office project categories are system-managed; work items go to real projects.
      this.projects.set(page.items.filter((p) => p.systemPurpose !== 'office').map((p) => ({ id: p.id, name: p.name })));
    } catch {
      this.projects.set([]);
    }
  }
}
