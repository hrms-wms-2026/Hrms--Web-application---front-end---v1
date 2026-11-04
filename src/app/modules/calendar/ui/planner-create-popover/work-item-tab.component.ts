import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ProjectApiService } from '../../../work/data-access/project-api.service';
import { TaskApiService } from '../../../work/data-access/task-api.service';
import { TaskCategoryDto } from '../../../work/models/dto/task-category.dto';
import { WorkTaskDto } from '../../../work/models/dto/task.dto';
import { TaskKindIconComponent } from '../../../work/ui/task-kind-icon/task-kind-icon.component';
import { kindOf } from '../../../work/utils/task-kind';
import { WorkItemPlanFlow } from '../../state/work-item-plan-flow.service';
import { CreateSlot, SharedCreateDraft, clock } from './planner-create-draft';

/** What the Work item tab held, for the full Create work item form ("More options"). */
export interface WorkItemDraft {
  title: string; projectId: string | null; objectiveId: string | null; categoryId: string | null;
  priority: WorkTaskDto['priority']; estimatedHours: number | null; dueDate: string | null; slot: CreateSlot;
}

/** The task to place with the block picker after a refused plan ("Pick another time"). */
export interface WorkItemToPlace { taskId: string; shortId: string; title: string; projectId: string; estimatedMinutes: number | null; }

/** "9:00" style, for the plan label. */
function shortClock(minutes: number): string {
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
}

function duration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/**
 * Work item tab of the Planner create popover: create a work item for me and plan it at the picked slot.
 * Estimate (total effort) and the plan (this slot) are separate values: the estimate only starts at the slot length.
 */
@Component({
  selector: 'app-planner-work-item-tab',
  standalone: true,
  imports: [TaskKindIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-2 text-sm">
      <input data-testid="work-item-title" class="ui-input" placeholder="Add work item title" [value]="shared().title()"
        (input)="shared().title.set($any($event.target).value)" />
      <p data-testid="work-item-plan" class="font-medium">{{ planLabel() }}</p>
      <div class="grid grid-cols-2 gap-2">
        <select data-testid="work-item-project" aria-label="Project" (change)="selectProject($any($event.target).value)">
          <option value="" [selected]="!projectId()">Choose a project</option>
          @for (p of projects(); track p.id) { <option [value]="p.id" [selected]="p.id === projectId()">{{ p.name }}</option> }
        </select>
        <select data-testid="work-item-module" aria-label="Module" [disabled]="!projectId()" (change)="objectiveId.set($any($event.target).value || null)">
          <option value="" [selected]="!objectiveId()">Choose a module</option>
          @for (m of modules(); track m.id) { <option [value]="m.id" [selected]="m.id === objectiveId()">{{ m.title }}</option> }
        </select>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <label class="flex items-center gap-2">
          @if (selectedKind(); as kind) { <app-task-kind-icon data-testid="work-item-type-icon" [kind]="kind" /> }
          <select data-testid="work-item-type" aria-label="Type" class="flex-1" (change)="categoryId.set($any($event.target).value || null)">
            @for (c of categories(); track c.id) { <option [value]="c.id" [selected]="c.id === categoryId()">{{ c.name }}</option> }
          </select>
        </label>
        <select data-testid="work-item-priority" aria-label="Priority" (change)="priority.set($any($event.target).value)">
          @for (p of priorities; track p) { <option [value]="p" [selected]="p === priority()">{{ p }}</option> }
        </select>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <label class="flex flex-col gap-1 text-xs">Estimate (total effort, h)
          <input data-testid="work-item-estimate" type="number" min="0" step="0.25" [value]="estimate()"
            (input)="estimate.set($any($event.target).value === '' ? null : +$any($event.target).value)" />
        </label>
        <label class="flex flex-col gap-1 text-xs">Due
          <input data-testid="work-item-due" type="date" [value]="dueDate() ?? ''" (input)="dueDate.set($any($event.target).value || null)" />
        </label>
      </div>
      <p class="text-xs text-[var(--color-text-secondary)]">Assignee: Me</p>

      @if (shared().isAllDay()) {
        <p data-testid="work-item-all-day-note" class="text-xs text-[var(--color-danger)]">Turn off All day to plan a work item.</p>
      }
      @if (overlaps()) {
        <p data-testid="work-item-overlap" class="text-xs text-amber-700">This overlaps one of your planned blocks, so planning it here will be refused.</p>
      }

      @switch (flow.state().kind) {
        @case ('pending') { <p data-testid="work-item-pending" class="text-xs">{{ pendingMessage() }}</p> }
        @case ('unknown') {
          <p data-testid="work-item-unknown" class="text-xs text-[var(--color-danger)]">We couldn't confirm the work item was created. Check your Task queue before trying again.</p>
        }
        @case ('error') { <p data-testid="work-item-error" class="text-xs text-[var(--color-danger)]">{{ errorMessage() }}</p> }
        @case ('notPlanned') {
          <div data-testid="work-item-not-planned" class="flex flex-col gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs">
            <span>{{ notPlannedMessage() }}</span>
            <div class="flex gap-2">
              <button type="button" data-testid="work-item-retry" class="rounded-md border px-2 py-1" (click)="flow.retryPlanning()">Retry planning</button>
              <button type="button" data-testid="work-item-pick-time" class="rounded-md border px-2 py-1" (click)="pickTime()">Pick another time</button>
            </div>
          </div>
        }
      }

      <div class="flex justify-end gap-2 pt-1">
        <button type="button" data-testid="work-item-more" class="rounded-md border px-3 py-1" (click)="moreOptions.emit(draft())">More options</button>
        <button type="button" data-testid="work-item-create" class="rounded-md bg-[var(--color-accent)] px-3 py-1 text-white"
          [disabled]="!canCreate()" (click)="create()">{{ flow.state().kind === 'busy' ? 'Creating…' : 'Create & plan' }}</button>
      </div>
    </div>
  `,
})
export class WorkItemTabComponent implements OnInit {
  readonly flow = inject(WorkItemPlanFlow);
  private readonly projectApi = inject(ProjectApiService);
  private readonly taskApi = inject(TaskApiService);

  readonly slot = input.required<CreateSlot>();
  readonly shared = input.required<SharedCreateDraft>();
  /** My planned blocks: a slot over one of them would be refused. */
  readonly myBlocks = input<readonly { startAt: string; endAt: string }[]>([]);
  readonly done = output<void>();
  readonly moreOptions = output<WorkItemDraft>();
  readonly pickAnotherTime = output<WorkItemToPlace>();

  readonly priorities: readonly WorkTaskDto['priority'][] = ['low', 'medium', 'high', 'critical'];
  readonly projects = signal<readonly { id: string; name: string }[]>([]);
  readonly modules = signal<readonly { id: string; title: string }[]>([]);
  readonly categories = signal<readonly TaskCategoryDto[]>([]);
  readonly projectId = signal<string | null>(null);
  readonly objectiveId = signal<string | null>(null);
  readonly categoryId = signal<string | null>(null);
  readonly priority = signal<WorkTaskDto['priority']>('medium');
  readonly estimate = signal<number | null>(null);
  readonly dueDate = signal<string | null>(null);

  readonly planMinutes = computed(() => this.slot().endMinutes - this.slot().startMinutes);
  readonly planLabel = computed(() =>
    `Plan ${shortClock(this.slot().startMinutes)}–${shortClock(this.slot().endMinutes)} · ${duration(this.planMinutes())}`);
  readonly selectedKind = computed(() => {
    const category = this.categories().find((c) => c.id === this.categoryId());
    return category ? kindOf(category.kind) : null;
  });
  readonly overlaps = computed(() => {
    const start = Date.parse(this.slot().startIso);
    const end = Date.parse(this.slot().endIso);
    return this.myBlocks().some((b) => Date.parse(b.startAt) < end && Date.parse(b.endAt) > start);
  });
  // Only before a create or after a refused one: in every other state the item exists or may exist.
  readonly canCreate = computed(() => ['idle', 'error'].includes(this.flow.state().kind) && !this.shared().isAllDay()
    && this.shared().title().trim() !== '' && !!this.objectiveId() && !!this.categoryId());
  readonly pendingMessage = computed(() => {
    const [y, m, d] = this.slot().date.split('-').map(Number);
    const day = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
    return `Sent for approval. Once approved it's yours and planned for ${day} ${clock(this.slot().startMinutes)}–${clock(this.slot().endMinutes)}.`;
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
    this.estimate.set(Math.round((this.planMinutes() / 60) * 4) / 4);
    void this.loadProjects();
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
      title: this.shared().title().trim(), projectId: this.projectId(), objectiveId: this.objectiveId(), categoryId: this.categoryId(),
      priority: this.priority(), estimatedHours: this.estimate(), dueDate: this.dueDate(), slot: this.slot(),
    };
  }

  create(): void {
    if (!this.canCreate()) return;
    void this.flow.createAndPlan(this.objectiveId()!, {
      title: this.shared().title().trim(), categoryId: this.categoryId()!, priority: this.priority(), sprintId: null,
      ...(this.estimate() !== null ? { estimatedHours: this.estimate()! } : {}),
      ...(this.dueDate() ? { dueDate: this.dueDate()! } : {}),
    }, this.slot());
  }

  pickTime(): void {
    const s = this.flow.state();
    if (s.kind !== 'notPlanned') return;
    const estimate = this.estimate();
    this.pickAnotherTime.emit({ taskId: s.taskId, shortId: s.shortId, title: this.shared().title().trim(),
      projectId: this.projectId() ?? '', estimatedMinutes: estimate === null ? null : Math.round(estimate * 60) });
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
