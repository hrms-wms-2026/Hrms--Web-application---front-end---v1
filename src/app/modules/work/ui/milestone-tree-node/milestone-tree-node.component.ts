import { Component, OnInit, input, output, signal } from '@angular/core';
import { MilestoneTreeNode } from '../../models/milestone.model';
import { isLeafObjective } from '../../utils/project.mapper';
import { ModuleTreeRowComponent } from '../module-tree-row/module-tree-row.component';
import { SprintTreeRowComponent } from '../sprint-tree-row/sprint-tree-row.component';
import { TaskTreeRowComponent } from '../task-tree-row/task-tree-row.component';

@Component({
  selector: 'app-milestone-tree-node',
  standalone: true,
  imports: [MilestoneTreeNodeComponent, ModuleTreeRowComponent, SprintTreeRowComponent, TaskTreeRowComponent],
  template: `
    <div>
      @if ((node().kind ?? 'objective') === 'objective') {
        <app-module-tree-row
          [node]="node()"
          [selected]="isSelected()"
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
        />
      } @else {
        <app-task-tree-row
          [node]="node()"
          [selected]="isSelected()"
          [depth]="depth()"
          (selectedRow)="selected.emit($event)"
          (editRequested)="editRequested.emit($event)"
          (deleteRequested)="deleteRequested.emit($event)"
        />
      }

      @if (node().children.length > 0 && expanded()) {
        <div class="flex flex-col gap-0.5">
          @for (child of node().children; track child.id) {
            <app-milestone-tree-node
              [node]="child"
              [selectedId]="selectedId()"
              [expandedByDefault]="false"
              [depth]="depth() + 1"
              (selected)="selected.emit($event)"
              (createRequested)="createRequested.emit($event)"
              (expandLeafRequested)="expandLeafRequested.emit($event)"
              (createSprintRequested)="createSprintRequested.emit($event)"
              (createTaskRequested)="createTaskRequested.emit($event)"
              (editRequested)="editRequested.emit($event)"
              (membersRequested)="membersRequested.emit($event)"
              (achieveRequested)="achieveRequested.emit($event)"
              (achieveSprintRequested)="achieveSprintRequested.emit($event)"
              (completeSprintRequested)="completeSprintRequested.emit($event)"
              (deleteRequested)="deleteRequested.emit($event)"
            />
          }
        </div>
      }
    </div>
  `
})
export class MilestoneTreeNodeComponent implements OnInit {
  node = input.required<MilestoneTreeNode>();
  selectedId = input<string | null>(null);
  expandedByDefault = input(true);
  depth = input(0);
  selected = output<MilestoneTreeNode>();
  createRequested = output<MilestoneTreeNode>();
  expandLeafRequested = output<MilestoneTreeNode>();
  createSprintRequested = output<MilestoneTreeNode>();
  createTaskRequested = output<MilestoneTreeNode>();
  editRequested = output<MilestoneTreeNode>();
  membersRequested = output<MilestoneTreeNode>();
  achieveRequested = output<MilestoneTreeNode>();
  achieveSprintRequested = output<MilestoneTreeNode>();
  completeSprintRequested = output<MilestoneTreeNode>();
  deleteRequested = output<MilestoneTreeNode>();

  expanded = signal(true);

  ngOnInit(): void {
    this.expanded.set(this.expandedByDefault());
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
