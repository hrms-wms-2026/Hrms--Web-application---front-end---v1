import { Component, input, output } from '@angular/core';
import { MilestoneTreeNode } from '../../models/milestone.model';
import { MilestoneTreeNodeComponent } from '../milestone-tree-node/milestone-tree-node.component';

@Component({
  selector: 'app-milestone-tree',
  standalone: true,
  imports: [MilestoneTreeNodeComponent],
  template: `
    @if (parent(); as parentRef) {
      <div
        data-testid="tree-parent-row"
        class="mb-1 flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]"
        (click)="nodeSelected.emit(parentRef.id)"
      >
        <span aria-hidden="true">↑</span>
        <span class="truncate">{{ parentRef.title }}</span>
      </div>
    }
    <app-milestone-tree-node [node]="root()" [selectedId]="root().id" (selected)="nodeSelected.emit($event)" />
  `
})
export class MilestoneTreeComponent {
  root = input.required<MilestoneTreeNode>();
  parent = input<{ id: string; title: string } | null>(null);
  nodeSelected = output<string>();
}
