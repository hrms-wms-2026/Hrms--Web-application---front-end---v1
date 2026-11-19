import { NgTemplateOutlet } from '@angular/common';
import { MeetingListItem } from '../../meetings/models/meeting.models';
import { MeetingCardComponent } from '../../meetings/ui/meeting-card/meeting-card.component';
import { Component, OnInit, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { MilestoneTreeNode } from '../../models/milestone.model';
import { isLeafObjective } from '../../utils/project.mapper';
import { treeNodeKey } from '../../utils/tree-highlight.utils';
import { ModuleTreeRowComponent } from '../module-tree-row/module-tree-row.component';
import { SprintTreeRowComponent } from '../sprint-tree-row/sprint-tree-row.component';
import { TaskTreeRowComponent } from '../task-tree-row/task-tree-row.component';
import { ProjectMonitorStore } from '../../state/project-monitor.store';

export type TreeExpandCommand =
  | { seq: number; mode: 'all' | 'none' }
  | { seq: number; mode: 'keys'; keys: ReadonlySet<string> };

const NO_KEYS: ReadonlySet<string> = new Set();
const NO_MEETINGS: ReadonlyMap<string, readonly MeetingListItem[]> = new Map();

@Component({
  selector: 'app-milestone-tree-node',
  standalone: true,
  imports: [NgTemplateOutlet, MilestoneTreeNodeComponent, ModuleTreeRowComponent, SprintTreeRowComponent, TaskTreeRowComponent, MeetingCardComponent],
  template: `
    <div>
      <div
        class="rounded-md"
        [class.tree-highlight]="isHighlighted()"
        [attr.data-highlighted]="isHighlighted() || null"
        [style.--tree-highlight]="isHighlighted() ? highlightColor() : null"
        [style.--tree-row-glow]="isHighlighted() ? highlightColor() : null"
      >
      @if ((node().kind ?? 'objective') === 'objective') {
        <app-module-tree-row
          [node]="node()"
          [selected]="isSelected()"
          [alerts]="monitor.alertsFor(node().id)"
          [depth]="depth()"
          [showChevron]="showChevron()"
          [expanded]="expanded()"
          (selectedRow)="selected.emit($event)"
          (chevronClicked)="toggleExpanded($event)"
          (retryClicked)="onRetryLoad($event)"
          (createRequested)="createRequested.emit($event)"
          (editRequested)="editRequested.emit($event)"
          (membersRequested)="membersRequested.emit($event)"
          (createTaskRequested)="createTaskRequested.emit($event)"
          (createSprintRequested)="createSprintRequested.emit($event)"
          (achieveRequested)="achieveRequested.emit($event)"
        />
      } @else if (node().kind === 'sprint') {
        <app-sprint-tree-row
          [node]="node()"
          [selected]="isSelected()"
          [alerts]="monitor.alertsFor(node().id)"
          [depth]="depth()"
          [showChevron]="showChevron()"
          [expanded]="expanded()"
          (selectedRow)="selected.emit($event)"
          (chevronClicked)="toggleExpanded($event)"
          (retryClicked)="onRetryLoad($event)"
          (createTaskRequested)="createTaskRequested.emit($event)"
          (editRequested)="editRequested.emit($event)"
          (achieveSprintRequested)="achieveSprintRequested.emit($event)"
          (completeSprintRequested)="completeSprintRequested.emit($event)"
          (deleteSprintRequested)="deleteSprintRequested.emit($event)"
        />
      } @else {
        <app-task-tree-row
          [node]="node()"
          [selected]="isSelected()"
          [alerts]="monitor.alertsFor(node().id)"
          [depth]="depth()"
          (selectedRow)="selected.emit($event)"
          (viewRequested)="viewRequested.emit($event)"
          (editRequested)="editRequested.emit($event)"
          (deleteRequested)="deleteRequested.emit($event)"
        />
      }
      </div>

      @if (node().children.length > 0 && expanded()) {
        <div class="flex flex-col gap-0.5">
          @for (child of node().children; track child.id; let i = $index) {
            @if (i === meetingSlot()) {
              <ng-container [ngTemplateOutlet]="meetingRows" />
            }
            <app-milestone-tree-node
              [node]="child"
              [selectedId]="selectedId()"
              [expandedByDefault]="false"
              [depth]="depth() + 1"
              [parentKey]="nodeKey()"
              [highlightedKeys]="highlightedKeys()"
              [highlightColor]="highlightColor()"
              [expandCommand]="expandCommand()"
              (selected)="selected.emit($event)"
              (createRequested)="createRequested.emit($event)"
              (expandLeafRequested)="expandLeafRequested.emit($event)"
              (createSprintRequested)="createSprintRequested.emit($event)"
              (createTaskRequested)="createTaskRequested.emit($event)"
              (viewRequested)="viewRequested.emit($event)"
              (editRequested)="editRequested.emit($event)"
              (membersRequested)="membersRequested.emit($event)"
              (achieveRequested)="achieveRequested.emit($event)"
              (achieveSprintRequested)="achieveSprintRequested.emit($event)"
              (completeSprintRequested)="completeSprintRequested.emit($event)"
              (deleteSprintRequested)="deleteSprintRequested.emit($event)"
              (deleteRequested)="deleteRequested.emit($event)"
              [meetingsByModule]="meetingsByModule()"
              (meetingOpened)="meetingOpened.emit($event)"
            />
          }
          @if (meetingSlot() === node().children.length) {
            <ng-container [ngTemplateOutlet]="meetingRows" />
          }
        </div>
      } @else if (node().children.length === 0 && moduleMeetings().length > 0) {
        <div class="flex flex-col gap-0.5">
          <ng-container [ngTemplateOutlet]="meetingRows" />
        </div>
      }

      <!-- A meeting is a leaf work item under its module (D2), shown as a row with the module's own tasks, after them and
           before its sprints and sub-modules; its status follows the clock. -->
      <ng-template #meetingRows>
        @for (meeting of moduleMeetings(); track meeting.taskId) {
          <div data-testid="tree-meeting-row">
            <app-meeting-card variant="row" [depth]="depth() + 1" [item]="meeting" (open)="meetingOpened.emit($event)" />
          </div>
        }
      </ng-template>
    </div>
  `,
  styles: [`
    .tree-highlight {
      background: color-mix(in srgb, var(--tree-highlight) 20%, transparent);
    }
  `]
})
export class MilestoneTreeNodeComponent implements OnInit {
  protected readonly monitor = inject(ProjectMonitorStore);
  node = input.required<MilestoneTreeNode>();
  selectedId = input<string | null>(null);
  expandedByDefault = input(true);
  depth = input(0);
  /** Ancestry path of this row (see treeNodeKey); the root passes nothing. */
  parentKey = input('');
  highlightedKeys = input<ReadonlySet<string>>(NO_KEYS);
  readonly nodeKey = computed(() => treeNodeKey(this.parentKey(), this.node().id));
  highlightColor = input<string | null>(null);
  /** Tree-wide expand/collapse broadcast; each new seq is applied once, and newly created nodes apply the latest on init. */
  expandCommand = input<TreeExpandCommand | null>(null);
  selected = output<MilestoneTreeNode>();
  createRequested = output<MilestoneTreeNode>();
  expandLeafRequested = output<MilestoneTreeNode>();
  createSprintRequested = output<MilestoneTreeNode>();
  createTaskRequested = output<MilestoneTreeNode>();
  viewRequested = output<MilestoneTreeNode>();
  editRequested = output<MilestoneTreeNode>();
  membersRequested = output<MilestoneTreeNode>();
  achieveRequested = output<MilestoneTreeNode>();
  achieveSprintRequested = output<MilestoneTreeNode>();
  completeSprintRequested = output<MilestoneTreeNode>();
  deleteSprintRequested = output<MilestoneTreeNode>();
  deleteRequested = output<MilestoneTreeNode>();
  /** The project's meetings in the board/tree window, by module (objective) id; passed down the whole tree. */
  meetingsByModule = input<ReadonlyMap<string, readonly MeetingListItem[]>>(NO_MEETINGS);
  meetingOpened = output<{ seriesId: string; originalStart: string }>();
  protected readonly moduleMeetings = computed(() =>
    (this.node().kind ?? 'objective') === 'objective' ? this.meetingsByModule().get(this.node().id) ?? [] : []);
  /** Where the meeting rows go among the children: after the module's own tasks, before its first sprint or sub-module. */
  protected readonly meetingSlot = computed(() => {
    const children = this.node().children;
    const firstContainer = children.findIndex((c) => (c.kind ?? 'objective') !== 'task');
    return firstContainer === -1 ? children.length : firstContainer;
  });

  expanded = signal(true);
  private appliedCommandSeq: number | null = null;

  constructor() {
    effect(() => {
      const command = this.expandCommand();
      untracked(() => this.applyExpandCommand(command));
    });
  }

  ngOnInit(): void {
    this.expanded.set(this.expandedByDefault());
    this.appliedCommandSeq = null;
    this.applyExpandCommand(this.expandCommand());
  }

  private applyExpandCommand(command: TreeExpandCommand | null): void {
    if (!command || command.seq === this.appliedCommandSeq) return;
    this.appliedCommandSeq = command.seq;
    switch (command.mode) {
      case 'all': this.expanded.set(true); break;
      // The root stays open on collapse-all so the first level is still visible.
      case 'none': this.expanded.set(this.depth() === 0); break;
      case 'keys': if (command.keys.has(this.nodeKey())) this.expanded.set(true); break;
    }
  }

  isHighlighted(): boolean {
    return this.highlightColor() !== null && this.highlightedKeys().has(this.nodeKey());
  }

  isSelected(): boolean {
    return this.node().id === this.selectedId();
  }

  showChevron(): boolean {
    return this.node().children.length > 0 || this.canLazyExpand();
  }

  canLazyExpand(): boolean {
    const n = this.node();
    const state = n.sprintTaskLoadState;
    const needsFetch = state === undefined || state === 'unloaded' || state === 'error';
    return needsFetch && (isLeafObjective(n) || n.kind === 'sprint');
  }

  toggleExpanded(event: Event): void {
    event.stopPropagation();
    this.expanded.set(!this.expanded());
    if (this.canLazyExpand()) {
      this.expandLeafRequested.emit(this.node());
    }
  }

  onRetryLoad(event: Event): void {
    event.stopPropagation();
    this.expandLeafRequested.emit(this.node());
  }
}
