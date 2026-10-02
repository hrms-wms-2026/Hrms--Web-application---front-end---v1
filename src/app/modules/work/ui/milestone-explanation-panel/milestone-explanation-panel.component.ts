import { Component, computed, input, output, signal } from '@angular/core';
import { CalendarEventActivityEntryDto, CalendarEventDto, CalendarEventTaskSummaryDto } from '../../models/dto/calendar.dto';
import { deriveMilestoneStatus, MilestoneStatus } from '../../utils/milestone-status.utils';

type PanelTab = 'overview' | 'modules' | 'tasks' | 'activity';

const STATUS_LABEL: Record<MilestoneStatus, string> = {
  upcoming: 'Upcoming', on_track: 'On Track', at_risk: 'At Risk', completed: 'Completed'
};
const STATUS_COLOR: Record<MilestoneStatus, string> = {
  upcoming: '#F59E0B', on_track: '#16A34A', at_risk: '#EF4444', completed: '#2563EB'
};

@Component({
  selector: 'app-milestone-explanation-panel',
  standalone: true,
  template: `
    <aside class="mp" data-testid="milestone-explanation-panel">
      <header class="mp__header">
        <span class="mp__diamond" [style.background]="statusColor()" aria-hidden="true"></span>
        <div class="mp__heading">
          <span class="mp__kind">Milestone</span>
          <h2 class="mp__title" [title]="event().name">{{ event().name }}</h2>
        </div>
        <div class="mp__menu-wrap">
          <button type="button" class="mp__icon-btn" aria-label="More actions" data-testid="panel-menu" (click)="menuOpen.set(!menuOpen())">⋮</button>
          @if (menuOpen()) {
            <div class="mp__menu">
              <button type="button" data-testid="panel-edit" (click)="menuOpen.set(false); editRequested.emit(event().id)">Edit milestone</button>
              <button type="button" class="mp__menu-danger" data-testid="panel-close" (click)="menuOpen.set(false); closeRequested.emit(event().id)">Close milestone</button>
            </div>
          }
        </div>
        <button type="button" class="mp__icon-btn" aria-label="Close panel" data-testid="panel-dismiss" (click)="dismissed.emit()">×</button>
      </header>

      <nav class="mp__tabs" role="tablist">
        @for (tab of tabs; track tab.id) {
          <button
            type="button" role="tab" [attr.data-testid]="'panel-tab-' + tab.id"
            [attr.aria-selected]="activeTab() === tab.id"
            class="mp__tab" [class.mp__tab--active]="activeTab() === tab.id"
            (click)="activateTab(tab.id)"
          >{{ tab.label }}@if (tabCount(tab.id) !== null) { ({{ tabCount(tab.id) }}) }</button>
        }
      </nav>

      <div class="mp__body">
        @if (activeTab() === 'overview') {
          <section class="mp__card">
            <div class="mp__row">
              <span class="mp__label">Status</span>
              <span data-testid="panel-status" class="mp__pill" [style.color]="statusColor()" [style.background]="statusTint()">{{ statusLabel() }}</span>
            </div>
            <div class="mp__row">
              <span class="mp__label">Target Date</span>
              <span class="mp__value" data-testid="panel-target-date">{{ event().endDate }}</span>
            </div>
            <div class="mp__row">
              <span class="mp__label">Start Date</span>
              <span class="mp__value" data-testid="panel-start-date">{{ event().startDate }}</span>
            </div>
            <div class="mp__row">
              <span class="mp__label">Progress</span>
              <span class="mp__progress">
                <span class="mp__bar"><span class="mp__bar-fill mp__bar-fill--green" [style.width.%]="progressPercent() ?? 0"></span></span>
                <span data-testid="panel-progress" class="mp__pct">{{ progressPercent() === null ? '—' : progressPercent() + '%' }}</span>
              </span>
            </div>
            <div class="mp__row">
              <span class="mp__label">Owner</span>
              <span class="mp__owner" data-testid="panel-owner">
                <span class="mp__avatar" aria-hidden="true">{{ ownerInitials() }}</span>{{ event().createdByName ?? '—' }}
              </span>
            </div>
            <div class="mp__row mp__row--top">
              <span class="mp__label">Description</span>
              <span data-testid="panel-description" class="mp__desc">{{ event().description || '—' }}</span>
            </div>
          </section>
        }

        @if (activeTab() === 'overview' || activeTab() === 'modules') {
          <section>
            <div class="mp__section-head">
              <h3 class="mp__section-title">Linked Modules ({{ event().objectiveIds.length }})</h3>
              <button type="button" class="mp__add" data-testid="panel-add-module" (click)="editRequested.emit(event().id)">+ Add Module</button>
            </div>
            <ul class="mp__modules">
              @for (objectiveId of event().objectiveIds; track objectiveId) {
                <li data-testid="panel-module-row" class="mp__module">
                  <svg class="mp__folder" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z" /></svg>
                  <span class="mp__module-name">{{ moduleTitleFor(objectiveId) }}</span>
                  <span class="mp__bar mp__bar--sm"><span class="mp__bar-fill" [style.width.%]="moduleProgress(objectiveId) ?? 0"></span></span>
                  <span class="mp__pct mp__pct--sm">{{ moduleProgress(objectiveId) === null ? '—' : moduleProgress(objectiveId) + '%' }}</span>
                </li>
              } @empty {
                <li data-testid="panel-modules-empty" class="mp__empty">No modules linked.</li>
              }
            </ul>
          </section>
        }

        @if (activeTab() === 'overview') {
          <section>
            <h3 class="mp__section-title">Key Metrics</h3>
            <div class="mp__metrics">
              <div class="mp__metric mp__metric--blue">
                <div data-testid="panel-metric-total" class="mp__metric-value">{{ tasks().length }}</div>
                <div class="mp__metric-label">Total Tasks</div>
              </div>
              <div class="mp__metric mp__metric--green">
                <div data-testid="panel-metric-completed" class="mp__metric-value">{{ completedTaskCount() }}</div>
                <div class="mp__metric-label">Completed</div>
              </div>
              <div class="mp__metric mp__metric--amber">
                <div data-testid="panel-metric-in-progress" class="mp__metric-value">{{ inProgressTaskCount() }}</div>
                <div class="mp__metric-label">In Progress</div>
              </div>
            </div>
          </section>
        }

        @if (activeTab() === 'tasks') {
          <ul class="mp__list">
            @for (task of tasks(); track task.id) {
              <li data-testid="panel-task-row" class="mp__list-row">
                <span>{{ task.title }}</span>
                <span class="mp__muted">{{ task.objectiveTitle }}</span>
              </li>
            } @empty {
              <li data-testid="panel-tasks-empty" class="mp__empty">No tasks linked to this milestone.</li>
            }
          </ul>
        }

        @if (activeTab() === 'activity') {
          <ul class="mp__list">
            @for (entry of activity(); track entry.id) {
              <li data-testid="panel-activity-row" class="mp__list-row mp__list-row--col">
                <span><strong>{{ entry.performedByName ?? 'Someone' }}</strong> {{ entry.action }} this milestone</span>
                <span class="mp__muted">{{ entry.performedAt }}</span>
              </li>
            } @empty {
              <li data-testid="panel-activity-empty" class="mp__empty">No activity yet.</li>
            }
          </ul>
        }
      </div>
    </aside>
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    .mp { border: 1px solid var(--color-border); border-radius: 14px; background: var(--color-surface); box-shadow: 0 1px 3px rgb(15 23 42 / .05); }
    .mp__header { display: flex; align-items: center; gap: 12px; padding: 18px 16px 12px; }
    .mp__diamond { width: 20px; height: 20px; flex: 0 0 auto; border-radius: 3px; transform: rotate(45deg) scale(.85); }
    .mp__heading { min-width: 0; flex: 1; }
    .mp__kind { display: block; color: var(--color-text-secondary); font-size: 10px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; }
    .mp__title { margin: 2px 0 0; overflow: hidden; color: var(--color-text-primary); font-size: 16px; font-weight: 700; line-height: 1.25; text-overflow: ellipsis; white-space: nowrap; }
    .mp__icon-btn { width: 26px; height: 26px; border: 0; border-radius: 6px; background: transparent; color: var(--color-text-secondary); font-size: 18px; line-height: 1; cursor: pointer; }
    .mp__icon-btn:hover { background: var(--color-surface-secondary); color: var(--color-text-primary); }
    .mp__menu-wrap { position: relative; }
    .mp__menu { position: absolute; right: 0; top: 30px; z-index: 20; min-width: 160px; border: 1px solid var(--color-border); border-radius: 10px; padding: 4px; background: var(--color-surface); box-shadow: 0 8px 24px rgb(15 23 42 / .14); }
    .mp__menu button { display: block; width: 100%; border: 0; border-radius: 6px; padding: 8px 10px; background: transparent; color: var(--color-text-primary); font-size: 12px; text-align: left; cursor: pointer; }
    .mp__menu button:hover { background: var(--color-surface-secondary); }
    .mp__menu-danger { color: var(--color-danger) !important; }
    .mp__tabs { display: flex; gap: 20px; padding: 0 16px; border-bottom: 1px solid var(--color-border); }
    .mp__tab { margin-bottom: -1px; border: 0; border-bottom: 2px solid transparent; padding: 8px 0 10px; background: transparent; color: var(--color-text-secondary); font-size: 13px; font-weight: 500; cursor: pointer; }
    .mp__tab--active { border-bottom-color: var(--color-accent); color: var(--color-accent); font-weight: 600; }
    .mp__body { display: flex; flex-direction: column; gap: 18px; padding: 16px; }
    .mp__card { border: 1px solid var(--color-border); border-radius: 12px; padding: 4px 14px; }
    .mp__row { display: flex; align-items: center; gap: 12px; padding: 9px 0; }
    .mp__row--top { align-items: flex-start; }
    .mp__label { width: 84px; flex: 0 0 auto; color: var(--color-text-secondary); font-size: 12px; }
    .mp__value { color: var(--color-text-primary); font-size: 13px; font-weight: 500; }
    .mp__pill { border-radius: 999px; padding: 3px 12px; font-size: 12px; font-weight: 600; }
    .mp__progress { display: flex; flex: 1; align-items: center; gap: 10px; min-width: 0; }
    .mp__bar { display: block; flex: 1; height: 6px; overflow: hidden; border-radius: 999px; background: var(--color-surface-secondary); }
    .mp__bar--sm { flex: 0 0 90px; height: 5px; }
    .mp__bar-fill { display: block; height: 100%; border-radius: 999px; background: var(--color-accent); }
    .mp__bar-fill--green { background: #16A34A; }
    .mp__pct { color: var(--color-text-primary); font-size: 12px; font-weight: 500; }
    .mp__pct--sm { width: 34px; text-align: right; }
    .mp__owner { display: flex; align-items: center; gap: 8px; color: var(--color-text-primary); font-size: 13px; font-weight: 500; }
    .mp__avatar { display: inline-flex; width: 24px; height: 24px; align-items: center; justify-content: center; border-radius: 999px; background: color-mix(in srgb, var(--color-accent) 18%, var(--color-surface)); color: var(--color-accent); font-size: 10px; font-weight: 700; }
    .mp__desc { color: var(--color-text-primary); font-size: 13px; line-height: 1.5; }
    .mp__section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
    .mp__section-title { margin: 0; color: var(--color-text-primary); font-size: 14px; font-weight: 700; }
    .mp__add { border: 1px solid var(--color-border); border-radius: 8px; padding: 5px 12px; background: var(--color-surface); color: var(--color-accent); font-size: 12px; font-weight: 600; cursor: pointer; }
    .mp__add:hover { background: var(--color-surface-secondary); }
    .mp__modules { display: flex; flex-direction: column; gap: 4px; margin: 0; padding: 0; list-style: none; }
    .mp__module { display: flex; align-items: center; gap: 10px; padding: 7px 0; font-size: 13px; }
    .mp__folder { width: 18px; height: 18px; flex: 0 0 auto; fill: none; stroke: var(--color-accent); stroke-width: 1.8; stroke-linejoin: round; }
    .mp__module-name { min-width: 0; flex: 1; overflow: hidden; color: var(--color-text-primary); text-overflow: ellipsis; white-space: nowrap; }
    .mp__metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 10px; }
    .mp__metric { border: 1px solid var(--color-border); border-left-width: 3px; border-radius: 8px; padding: 10px 12px; }
    .mp__metric--blue { border-left-color: #2563EB; }
    .mp__metric--green { border-left-color: #16A34A; }
    .mp__metric--amber { border-left-color: #F59E0B; }
    .mp__metric-value { color: var(--color-text-primary); font-size: 20px; font-weight: 700; line-height: 1.1; }
    .mp__metric-label { margin-top: 3px; color: var(--color-text-secondary); font-size: 11px; }
    .mp__list { display: flex; flex-direction: column; gap: 6px; margin: 0; padding: 0; list-style: none; font-size: 12px; }
    .mp__list-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; border: 1px solid var(--color-border); border-radius: 8px; padding: 8px 10px; }
    .mp__list-row--col { flex-direction: column; align-items: flex-start; }
    .mp__muted, .mp__empty { color: var(--color-text-secondary); font-size: 12px; }
  `]
})
export class MilestoneExplanationPanelComponent {
  readonly event = input.required<CalendarEventDto>();
  readonly modules = input<readonly { objectiveId: string; title: string; progressPercent?: number | null }[]>([]);
  readonly tasks = input<readonly CalendarEventTaskSummaryDto[]>([]);
  readonly activity = input<readonly CalendarEventActivityEntryDto[]>([]);
  readonly hasOpenAlert = input(false);
  readonly today = input(new Date().toISOString().slice(0, 10));

  readonly editRequested = output<string>();
  readonly closeRequested = output<string>();
  readonly dismissed = output<void>();
  /** Emits the tab name the first time it's activated, so the host can lazy-load its data. */
  readonly tabActivated = output<PanelTab>();

  readonly tabs: { id: PanelTab; label: string }[] = [
    { id: 'overview', label: 'Overview' }, { id: 'modules', label: 'Modules' },
    { id: 'tasks', label: 'Tasks' }, { id: 'activity', label: 'Activity' }
  ];
  readonly activeTab = signal<PanelTab>('overview');
  readonly menuOpen = signal(false);
  private readonly activatedTabs = new Set<PanelTab>(['overview']);

  private readonly status = computed(() => deriveMilestoneStatus(this.event(), this.today(), this.hasOpenAlert()));
  readonly statusLabel = computed(() => STATUS_LABEL[this.status()]);
  readonly statusColor = computed(() => STATUS_COLOR[this.status()]);
  readonly statusTint = computed(() => `color-mix(in srgb, ${this.statusColor()} 14%, transparent)`);
  readonly completedTaskCount = computed(() => this.tasks().filter((t) => t.statusCategory === 'done').length);
  readonly inProgressTaskCount = computed(() => this.tasks().filter((t) => t.statusCategory === 'active').length);
  /** Done / total over the milestone's own tasks; null (shown "—") when there is nothing to measure. */
  readonly progressPercent = computed(() =>
    this.tasks().length === 0 ? null : Math.round((100 * this.completedTaskCount()) / this.tasks().length));
  readonly ownerInitials = computed(() => {
    const parts = (this.event().createdByName ?? '').trim().split(/\s+/).filter(Boolean);
    return parts.length ? parts.slice(0, 2).map((p) => p[0].toUpperCase()).join('') : '—';
  });

  tabCount(tab: PanelTab): number | null {
    if (tab === 'modules') return this.event().objectiveIds.length;
    if (tab === 'tasks') return this.tasks().length;
    return null;
  }

  moduleTitleFor(objectiveId: string): string {
    return this.modules().find((m) => m.objectiveId === objectiveId)?.title ?? objectiveId;
  }

  moduleProgress(objectiveId: string): number | null {
    return this.modules().find((m) => m.objectiveId === objectiveId)?.progressPercent ?? null;
  }

  activateTab(tab: PanelTab): void {
    this.activeTab.set(tab);
    if (!this.activatedTabs.has(tab)) {
      this.activatedTabs.add(tab);
      this.tabActivated.emit(tab);
    }
  }
}
