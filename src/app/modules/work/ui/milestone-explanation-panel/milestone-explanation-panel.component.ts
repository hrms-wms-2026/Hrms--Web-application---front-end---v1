import { Component, computed, input, output, signal } from '@angular/core';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { CalendarEventActivityEntryDto, CalendarEventDto, CalendarEventTaskSummaryDto } from '../../models/dto/calendar.dto';
import { deriveMilestoneStatus, MilestoneStatus } from '../../utils/milestone-status.utils';

type PanelTab = 'overview' | 'modules' | 'tasks' | 'activity';

const STATUS_LABEL: Record<MilestoneStatus, string> = {
  upcoming: 'Upcoming', on_track: 'On Track', at_risk: 'At Risk', completed: 'Completed'
};

@Component({
  selector: 'app-milestone-explanation-panel',
  standalone: true,
  imports: [CardComponent],
  template: `
    <app-card>
      <div data-testid="milestone-explanation-panel" class="flex flex-col gap-5 p-4">
        <div class="flex items-start justify-between gap-3 border-b border-[var(--color-border)] pb-4">
          <div class="min-w-0">
            <div class="mb-2 flex items-center gap-2">
              <span class="h-2 w-2 shrink-0 rounded-full" [style.background]="event().color" aria-hidden="true"></span>
              <span class="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Milestone</span>
            </div>
            <h2 class="truncate text-base font-bold leading-tight text-[var(--color-text-primary)]">{{ event().name }}</h2>
            <span data-testid="panel-status" class="mt-2 inline-flex rounded-full bg-[var(--color-surface-secondary)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-secondary)]">{{ statusLabel() }}</span>
          </div>
          <button type="button" class="text-[var(--color-text-secondary)]" aria-label="Close panel" (click)="dismissed.emit()">×</button>
        </div>

        <div class="flex gap-1 border-b border-[var(--color-border)]" role="tablist">
          @for (tab of tabs; track tab) {
            <button
              type="button" role="tab" [attr.data-testid]="'panel-tab-' + tab"
              [attr.aria-selected]="activeTab() === tab"
              class="px-3 py-2 text-xs font-medium capitalize {{ activeTab() === tab ? 'border-b-2 border-[var(--color-accent)] text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]' }}"
              (click)="activateTab(tab)"
            >{{ tab }}</button>
          }
        </div>

        @if (activeTab() === 'overview') {
          @if (event().description; as description) {
            <p data-testid="panel-description" class="text-xs leading-relaxed text-[var(--color-text-secondary)]">{{ description }}</p>
          }
          <div class="flex flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)]/30 px-3 py-1 text-xs">
            <div class="flex items-center justify-between py-2 border-b border-[var(--color-border)]/50">
              <span class="text-[var(--color-text-secondary)] font-medium">Owner</span>
              <span data-testid="panel-owner">{{ event().createdByName ?? '—' }}</span>
            </div>
            <div class="flex items-center justify-between py-2">
              <span class="text-[var(--color-text-secondary)] font-medium">Target Date</span>
              <span class="font-semibold text-[var(--color-text-primary)]">{{ event().endDate }}</span>
            </div>
          </div>
        }

        @if (activeTab() === 'modules') {
          <ul class="flex flex-col gap-1.5 text-xs">
            @for (objectiveId of event().objectiveIds; track objectiveId) {
              <li data-testid="panel-module-row" class="rounded-md border border-[var(--color-border)] px-2.5 py-1.5">{{ moduleTitleFor(objectiveId) }}</li>
            } @empty {
              <li data-testid="panel-modules-empty" class="text-[var(--color-text-secondary)]">No modules linked.</li>
            }
          </ul>
        }

        @if (activeTab() === 'tasks') {
          <div class="grid grid-cols-3 gap-2">
            <div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-center shadow-sm">
              <div data-testid="panel-metric-total" class="text-base font-bold text-[var(--color-text-primary)]">{{ tasks().length }}</div>
              <div class="text-[10px] font-medium text-[var(--color-text-secondary)] mt-0.5">Total Tasks</div>
            </div>
            <div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-center shadow-sm">
              <div data-testid="panel-metric-completed" class="text-base font-bold text-[var(--color-text-primary)]">{{ completedTaskCount() }}</div>
              <div class="text-[10px] font-medium text-[var(--color-text-secondary)] mt-0.5">Completed</div>
            </div>
            <div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-center shadow-sm">
              <div data-testid="panel-metric-in-progress" class="text-base font-bold text-[var(--color-text-primary)]">{{ inProgressTaskCount() }}</div>
              <div class="text-[10px] font-medium text-[var(--color-text-secondary)] mt-0.5">In Progress</div>
            </div>
          </div>
          <ul class="flex flex-col gap-1.5 text-xs">
            @for (task of tasks(); track task.id) {
              <li data-testid="panel-task-row" class="flex items-center justify-between rounded-md border border-[var(--color-border)] px-2.5 py-1.5">
                <span>{{ task.title }}</span>
                <span class="text-[var(--color-text-secondary)]">{{ task.objectiveTitle }}</span>
              </li>
            } @empty {
              <li data-testid="panel-tasks-empty" class="text-[var(--color-text-secondary)]">No tasks linked to this milestone.</li>
            }
          </ul>
        }

        @if (activeTab() === 'activity') {
          <ul class="flex flex-col gap-2 text-xs">
            @for (entry of activity(); track entry.id) {
              <li data-testid="panel-activity-row" class="rounded-md border border-[var(--color-border)] px-2.5 py-1.5">
                <span class="font-medium">{{ entry.performedByName ?? 'Someone' }}</span> {{ entry.action }} this milestone
                <span class="block text-[10px] text-[var(--color-text-secondary)]">{{ entry.performedAt }}</span>
              </li>
            } @empty {
              <li data-testid="panel-activity-empty" class="text-[var(--color-text-secondary)]">No activity yet.</li>
            }
          </ul>
        }

        <div class="border-t border-[var(--color-border)] pt-4">
          <div class="grid grid-cols-2 gap-2">
            <button type="button" class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-center text-sm font-medium text-[var(--color-text-secondary)]" data-testid="panel-edit" (click)="editRequested.emit(event().id)">Edit milestone</button>
            <button type="button" class="rounded-lg bg-[var(--color-accent)] px-3 py-2.5 text-center text-sm font-medium text-white" data-testid="panel-close" (click)="closeRequested.emit(event().id)">Close milestone</button>
          </div>
        </div>
      </div>
    </app-card>
  `
})
export class MilestoneExplanationPanelComponent {
  readonly event = input.required<CalendarEventDto>();
  readonly modules = input<readonly { objectiveId: string; title: string }[]>([]);
  readonly tasks = input<readonly CalendarEventTaskSummaryDto[]>([]);
  readonly activity = input<readonly CalendarEventActivityEntryDto[]>([]);
  readonly hasOpenAlert = input(false);
  readonly today = input(new Date().toISOString().slice(0, 10));

  readonly editRequested = output<string>();
  readonly closeRequested = output<string>();
  readonly dismissed = output<void>();
  /** Emits the tab name the first time it's activated, so the host can lazy-load its data. */
  readonly tabActivated = output<PanelTab>();

  readonly tabs: PanelTab[] = ['overview', 'modules', 'tasks', 'activity'];
  readonly activeTab = signal<PanelTab>('overview');
  private readonly activatedTabs = new Set<PanelTab>(['overview']);

  readonly statusLabel = computed(() => STATUS_LABEL[deriveMilestoneStatus(this.event(), this.today(), this.hasOpenAlert())]);
  readonly completedTaskCount = computed(() => this.tasks().filter((t) => t.statusCategory === 'done').length);
  readonly inProgressTaskCount = computed(() => this.tasks().filter((t) => t.statusCategory === 'active').length);

  moduleTitleFor(objectiveId: string): string {
    return this.modules().find((m) => m.objectiveId === objectiveId)?.title ?? objectiveId;
  }

  activateTab(tab: PanelTab): void {
    this.activeTab.set(tab);
    if (!this.activatedTabs.has(tab)) {
      this.activatedTabs.add(tab);
      this.tabActivated.emit(tab);
    }
  }
}
