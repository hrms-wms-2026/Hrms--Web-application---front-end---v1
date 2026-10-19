import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FileApiService } from '../../../../../shared/data-access/file-api.service';
import { AvatarComponent } from '../../../../../shared/ui/avatar/avatar.component';
import { EmployeeWorkGraphResponse, WorkGraphNode, WorkGraphPerson } from '../../../models/work-graph.model';
import { TASK_TONE_LABELS, TaskTone, progressPercent, taskTone, tasksByParent } from './explorer-layout';

type PanelTab = 'overview' | 'tasks' | 'team';

/** 'Sep 1, 2026' from an ISO calendar date, without a timezone shift. */
function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return value;
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Details for the selected project or module, built only from the graph response (no request per
 * click). Stats are module/project-wide; the task list is only this employee's open tasks, and is
 * labelled that way so the two numbers never look contradictory.
 */
@Component({
  selector: 'app-work-network-detail-panel',
  standalone: true,
  imports: [AvatarComponent, NgTemplateOutlet],
  template: `
    @let node = selected();
    <aside class="wgp" data-testid="work-network-panel" [attr.aria-label]="node.label + ' details'">
      <header class="wgp-head">
        <span class="wgp-code" [class.wgp-code--module]="node.kind === 'module'">{{ code() }}</span>
        <div class="min-w-0 flex-1">
          <h3 class="wgp-title" [title]="node.label">{{ node.label }}</h3>
          <p class="wgp-kind">{{ kindLine() }}</p>
        </div>
        <button type="button" class="wgp-close" aria-label="Close details" (click)="closed.emit()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
        </button>
      </header>

      <nav class="wgp-tabs" role="tablist">
        <button type="button" role="tab" [attr.aria-selected]="tab() === 'overview'" [class.wgp-tab--on]="tab() === 'overview'" (click)="tab.set('overview')">Overview</button>
        <button type="button" role="tab" data-testid="panel-tab-tasks" [attr.aria-selected]="tab() === 'tasks'" [class.wgp-tab--on]="tab() === 'tasks'" (click)="tab.set('tasks')">
          {{ node.kind === 'project' ? 'Modules' : 'Tasks' }} ({{ node.kind === 'project' ? modules().length : myTasks().length }})
        </button>
        @if (node.kind === 'module') {
          <button type="button" role="tab" data-testid="panel-tab-team" [attr.aria-selected]="tab() === 'team'" [class.wgp-tab--on]="tab() === 'team'" (click)="tab.set('team')">Team</button>
        }
      </nav>

      <div class="wgp-body">
        @switch (tab()) {
          @case ('overview') {
            @if (node.stats; as s) {
              <section class="wgp-stats" data-testid="panel-stats">
                <div><strong>{{ s.totalTasks }}</strong><span>Total tasks</span></div>
                <div><strong class="text-blue-600">{{ s.inProgress }}</strong><span>In progress</span></div>
                <div><strong class="text-emerald-600">{{ s.completed }}</strong><span>Completed</span></div>
                <div><strong>{{ s.notStarted }}</strong><span>Not started</span></div>
                <div class="wgp-progress">
                  <span class="wgp-track"><span class="wgp-fill" [style.width.%]="progress()"></span></span>
                  <span>{{ progress() }}% completed</span>
                </div>
                @if (s.overdue > 0) {
                  <p class="wgp-overdue">{{ s.overdue }} overdue</p>
                }
              </section>
            }

            <dl class="wgp-rows">
              @if (node.kind === 'module' && node.module; as m) {
                <div><dt>Module owner</dt><dd>{{ m.owner ? m.owner.name + (isMe(m.owner) ? ' (You)' : '') : '—' }}</dd></div>
                <div>
                  <dt>Members</dt>
                  <dd class="wgp-avatars">
                    @for (p of m.members.slice(0, 4); track p.employeeId) {
                      <app-avatar size="xs" [avatarUrl]="avatar(p)" [userName]="p.name" [attr.title]="p.name" />
                    }
                    @let shown = m.members.length < 4 ? m.members.length : 4;
                    @if (m.memberCount > shown) { <span class="wgp-more">+{{ m.memberCount - shown }}</span> }
                    @if (m.memberCount === 0) { <span>—</span> }
                  </dd>
                </div>
                <div><dt>Start date</dt><dd>{{ date(m.startDate) }}</dd></div>
                <div><dt>End date</dt><dd>{{ date(m.endDate) }}</dd></div>
              }
              @if (node.stats; as s) {
                <div><dt>Allocated effort</dt><dd>{{ s.allocatedHours }} hours</dd></div>
              }
              @if (node.kind === 'module' && projectNode(); as p) {
                <div><dt>Project</dt><dd><button type="button" class="wgp-link" (click)="open.emit(p)">{{ p.label }}</button></dd></div>
              }
            </dl>

            @if (node.kind === 'module') {
              <section class="wgp-section">
                <div class="wgp-section-head">
                  <h4>{{ tasksHeading() }}</h4>
                  @if (myTasks().length > 5) {
                    <button type="button" class="wgp-link" (click)="tab.set('tasks')">View all</button>
                  }
                </div>
                <ng-container *ngTemplateOutlet="taskList; context: { $implicit: myTasks().slice(0, 5) }" />
              </section>
            } @else {
              <section class="wgp-section">
                <div class="wgp-section-head"><h4>Modules</h4></div>
                <ng-container *ngTemplateOutlet="moduleList; context: { $implicit: modules().slice(0, 5) }" />
              </section>
            }
          }
          @case ('tasks') {
            @if (node.kind === 'module') {
              <p class="wgp-note">{{ tasksNote() }}</p>
              <ng-container *ngTemplateOutlet="taskList; context: { $implicit: myTasks() }" />
            } @else {
              <ng-container *ngTemplateOutlet="moduleList; context: { $implicit: modules() }" />
            }
          }
          @case ('team') {
            @if (node.module; as m) {
              <ul class="wgp-people">
                @if (m.owner; as o) {
                  <li><app-avatar size="sm" [avatarUrl]="avatar(o)" [userName]="o.name" /><span>{{ o.name }}{{ isMe(o) ? ' (You)' : '' }}</span><em>Owner</em></li>
                }
                @for (p of m.members; track p.employeeId) {
                  <li><app-avatar size="sm" [avatarUrl]="avatar(p)" [userName]="p.name" /><span>{{ p.name }}{{ isMe(p) ? ' (You)' : '' }}</span><em>Member</em></li>
                }
              </ul>
              @if (m.memberCount > m.members.length) {
                <p class="wgp-note">+{{ m.memberCount - m.members.length }} more members</p>
              }
            }
          }
        }
      </div>

      <footer class="wgp-foot">
        <button type="button" class="wgp-primary" data-testid="panel-open" (click)="open.emit(node)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>
          Open {{ node.kind === 'module' ? 'module' : 'project' }} in Work Management
        </button>
      </footer>
    </aside>

    <ng-template #taskList let-tasks>
      @if (tasks.length === 0) {
        <p class="wgp-note">No open tasks assigned.</p>
      }
      <ul class="wgp-list">
        @for (t of tasks; track t.id) {
          <li>
            <button type="button" class="wgp-item" data-testid="panel-task" (click)="taskClicked.emit(t)">
              <span [class]="'wgp-dot wgp-tone--' + tone(t)"></span>
              <span class="min-w-0 flex-1">
                <span class="wgp-item-title">{{ t.label }}</span>
                <span class="wgp-item-sub">{{ t.sublabel }}@if (t.task?.dueDate) { · due {{ date(t.task!.dueDate) }} }</span>
              </span>
              <span [class]="'wgp-pill wgp-pill--' + tone(t)">{{ toneLabel(t) }}</span>
            </button>
          </li>
        }
      </ul>
    </ng-template>

    <ng-template #moduleList let-mods>
      @if (mods.length === 0) {
        <p class="wgp-note">{{ noModulesNote() }}</p>
      }
      <ul class="wgp-list">
        @for (m of mods; track m.id) {
          <li>
            <button type="button" class="wgp-item" (click)="selectModule.emit(m)">
              <span class="wgp-dot wgp-dot--module" [class.wgp-dot--hollow]="m.role !== 'owner'"></span>
              <span class="min-w-0 flex-1">
                <span class="wgp-item-title">{{ m.label }}</span>
                <span class="wgp-item-sub">{{ m.stats?.totalTasks ?? 0 }} tasks · {{ pct(m) }}% · {{ m.role === 'owner' ? 'Owner' : 'Member' }}</span>
              </span>
            </button>
          </li>
        }
      </ul>
    </ng-template>
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .wgp { display: flex; height: 100%; flex-direction: column; background: var(--color-surface); border-left: 1px solid var(--color-border); animation: wgp-in 220ms cubic-bezier(0.16, 1, 0.3, 1) both; }
    .wgp-head { display: flex; align-items: center; gap: 0.75rem; padding: 1rem 1rem 0.75rem; }
    .wgp-code { display: flex; height: 2.75rem; width: 2.75rem; flex-shrink: 0; align-items: center; justify-content: center; border-radius: 9999px; background: linear-gradient(135deg, #4f8bff, #2563eb); color: #fff; font-weight: 700; font-size: 0.875rem; }
    .wgp-code--module { background: linear-gradient(135deg, #a26bff, #7c3aed); }
    .wgp-title { margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 1rem; font-weight: 700; color: var(--color-text-primary); }
    .wgp-kind { margin: 0; font-size: 0.75rem; color: var(--color-text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .wgp-close { display: flex; height: 2rem; width: 2rem; align-items: center; justify-content: center; border: 1px solid var(--color-border); border-radius: 0.5rem; background: transparent; color: var(--color-text-secondary); cursor: pointer; }
    .wgp-close svg { width: 1rem; height: 1rem; }
    .wgp-close:hover { background: var(--color-surface-secondary); color: var(--color-text-primary); }
    .wgp-tabs { display: flex; gap: 1rem; padding: 0 1rem; border-bottom: 1px solid var(--color-border); }
    .wgp-tabs button { border: 0; border-bottom: 2px solid transparent; background: transparent; padding: 0.5rem 0; font-size: 0.8rem; font-weight: 500; color: var(--color-text-secondary); cursor: pointer; }
    .wgp-tabs .wgp-tab--on { border-bottom-color: #2563eb; color: #2563eb; font-weight: 600; }
    .wgp-body { flex: 1; min-height: 0; overflow-y: auto; padding: 0.875rem 1rem; }
    .wgp-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.25rem; padding: 0.75rem; border: 1px solid var(--color-border); border-radius: 0.75rem; }
    .wgp-stats > div { display: flex; flex-direction: column; }
    .wgp-stats strong { font-size: 1.1rem; font-weight: 700; color: var(--color-text-primary); }
    .wgp-stats span { font-size: 0.68rem; color: var(--color-text-secondary); }
    .wgp-stats .wgp-progress { grid-column: 1 / -1; flex-direction: row; align-items: center; gap: 0.5rem; margin-top: 0.5rem; }
    .wgp-track { flex: 1; height: 0.375rem; border-radius: 9999px; background: #e2e8f0; overflow: hidden; }
    .wgp-fill { display: block; height: 100%; border-radius: 9999px; background: #22c55e; transition: width 400ms ease-out; }
    .wgp-overdue { grid-column: 1 / -1; margin: 0.25rem 0 0; font-size: 0.72rem; font-weight: 600; color: #dc2626; }
    .wgp-rows { margin: 0.875rem 0 0; display: flex; flex-direction: column; gap: 0.55rem; font-size: 0.8rem; }
    .wgp-rows > div { display: grid; grid-template-columns: 7.5rem 1fr; align-items: center; }
    .wgp-rows dt { color: var(--color-text-secondary); }
    .wgp-rows dd { margin: 0; color: var(--color-text-primary); font-weight: 500; }
    .wgp-avatars { display: flex; align-items: center; gap: 0.15rem; }
    .wgp-more { margin-left: 0.25rem; font-size: 0.7rem; font-weight: 600; color: #2563eb; }
    .wgp-link { border: 0; background: transparent; padding: 0; color: #2563eb; font: inherit; font-weight: 600; cursor: pointer; }
    .wgp-link:hover { text-decoration: underline; }
    .wgp-section { margin-top: 1rem; border-top: 1px solid var(--color-border); padding-top: 0.75rem; }
    .wgp-section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.25rem; }
    .wgp-section-head h4 { margin: 0; font-size: 0.82rem; font-weight: 700; color: var(--color-text-primary); }
    .wgp-note { margin: 0.25rem 0 0.5rem; font-size: 0.72rem; color: var(--color-text-secondary); }
    .wgp-list { margin: 0; padding: 0; list-style: none; }
    .wgp-item { display: flex; width: 100%; align-items: center; gap: 0.6rem; border: 0; border-radius: 0.5rem; background: transparent; padding: 0.4rem 0.35rem; text-align: left; cursor: pointer; }
    .wgp-item:hover { background: var(--color-surface-secondary); }
    .wgp-item-title { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.78rem; font-weight: 600; color: var(--color-text-primary); }
    .wgp-item-sub { display: block; font-size: 0.68rem; color: var(--color-text-secondary); }
    .wgp-dot { width: 0.6rem; height: 0.6rem; flex-shrink: 0; border-radius: 9999px; }
    .wgp-dot--module { background: #8b5cf6; }
    .wgp-dot--hollow { background: transparent; border: 2px solid #8b5cf6; }
    .wgp-tone--progress { background: #2563eb; }
    .wgp-tone--not-started { background: #94a3b8; }
    .wgp-tone--overdue { background: #ef4444; }
    .wgp-pill { flex-shrink: 0; border-radius: 9999px; padding: 0.15rem 0.5rem; font-size: 0.65rem; font-weight: 600; }
    .wgp-pill--progress { background: #eff6ff; color: #1d4ed8; }
    .wgp-pill--not-started { background: #f1f5f9; color: #475569; }
    .wgp-pill--overdue { background: #fef2f2; color: #dc2626; }
    .wgp-people { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 0.5rem; }
    .wgp-people li { display: flex; align-items: center; gap: 0.6rem; font-size: 0.8rem; color: var(--color-text-primary); }
    .wgp-people span { flex: 1; }
    .wgp-people em { font-style: normal; font-size: 0.68rem; color: var(--color-text-secondary); }
    .wgp-foot { padding: 0.75rem 1rem 1rem; }
    .wgp-primary { display: flex; width: 100%; align-items: center; justify-content: center; gap: 0.5rem; border: 0; border-radius: 0.6rem; background: #2563eb; padding: 0.6rem; color: #fff; font-size: 0.8rem; font-weight: 600; cursor: pointer; }
    .wgp-primary:hover { background: #1d4ed8; }
    .wgp-primary svg { width: 1rem; height: 1rem; }
    @keyframes wgp-in { from { opacity: 0; transform: translateX(12px); } }
    @media (prefers-reduced-motion: reduce) { .wgp { animation: none; } }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkNetworkDetailPanelComponent {
  private readonly files = inject(FileApiService);

  readonly graph = input.required<EmployeeWorkGraphResponse>();
  /** A project or module node from the graph. */
  readonly selected = input.required<WorkGraphNode>();
  readonly code = input('');
  /**
   * Project mode: the graph is rooted on a project's module tree, so it has no employee node and
   * no project node. The kind line names the parent module instead of the project and drops the
   * viewer-relative role word, and the task copy speaks about the module rather than a person.
   * Left false, every line reads exactly as it did for the employee Work Network.
   */
  readonly projectMode = input(false);
  readonly closed = output<void>();
  /** "Open in Work Management" (and the project link): the parent navigates. */
  readonly open = output<WorkGraphNode>();
  readonly taskClicked = output<WorkGraphNode>();
  readonly selectModule = output<WorkGraphNode>();

  readonly tab = signal<PanelTab>('overview');

  private readonly employee = computed(() => this.graph().nodes.find((n) => n.kind === 'employee') ?? null);
  readonly firstName = computed(() => this.employee()?.label.split(/\s+/)[0] ?? 'Employee');
  readonly tasksHeading = computed(() =>
    this.projectMode() ? 'Open tasks' : `Assigned to ${this.firstName()} (open)`
  );
  readonly tasksNote = computed(() =>
    this.projectMode()
      ? 'Open tasks in this module. The overview counts every task in the module.'
      : `${this.firstName()}'s open tasks in this module. The overview counts every task in the module.`
  );
  readonly noModulesNote = computed(() =>
    this.projectMode() ? 'No modules in this project.' : `No modules in this project for ${this.firstName()}.`
  );
  readonly progress = computed(() => progressPercent(this.selected().stats));
  readonly myTasks = computed(() => tasksByParent(this.graph()).get(this.selected().id) ?? []);
  readonly modules = computed(() =>
    this.graph().nodes.filter((n) => n.kind === 'module' && n.projectId === this.selected().projectId)
  );
  readonly projectNode = computed(() =>
    this.graph().nodes.find((n) => n.kind === 'project' && n.projectId === this.selected().projectId) ?? null
  );
  /** Project mode: the module this one hangs off, from the graph's own `contains` links. */
  readonly parentModule = computed(() => {
    const id = this.selected().id;
    const link = this.graph().links.find((l) => l.target === id && l.kind === 'contains');
    return link ? this.graph().nodes.find((n) => n.id === link.source && n.kind === 'module') ?? null : null;
  });
  readonly kindLine = computed(() => {
    const node = this.selected();
    if (node.kind === 'project') return `Project${node.sublabel ? ' • ' + node.sublabel : ''}`;
    if (this.projectMode()) {
      const parent = this.parentModule();
      const kind = node.kind === 'sprint' ? 'Sprint' : 'Module';
      return parent ? `${kind} • ${parent.label}` : kind;
    }
    const role = node.role === 'owner' ? 'You own' : node.role === 'member' ? 'Member' : 'Contributor';
    return `Module • ${this.projectNode()?.label ?? ''} • ${role}`;
  });

  constructor() {
    // A different selection starts on Overview.
    effect(() => {
      this.selected().id;
      untracked(() => this.tab.set('overview'));
    });
  }

  isMe(person: WorkGraphPerson): boolean {
    return this.employee()?.id === `employee:${person.employeeId}`;
  }

  avatar(person: WorkGraphPerson): string | null {
    return person.avatarFileId ? this.files.getFileUrl(person.avatarFileId) : null;
  }

  date(value: string | null | undefined): string {
    return formatDate(value);
  }

  tone(task: WorkGraphNode): TaskTone {
    return taskTone(task);
  }

  toneLabel(task: WorkGraphNode): string {
    return TASK_TONE_LABELS[taskTone(task)];
  }

  pct(node: WorkGraphNode): number {
    return progressPercent(node.stats);
  }
}
