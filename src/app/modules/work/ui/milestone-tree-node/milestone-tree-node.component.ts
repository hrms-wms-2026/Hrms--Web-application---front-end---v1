import { Component, input } from '@angular/core';
import { MilestoneTreeNode } from '../../models/milestone.model';

@Component({
  selector: 'app-milestone-tree-node',
  standalone: true,
  imports: [MilestoneTreeNodeComponent],
  template: `
    <div class="rounded-md border border-[var(--color-border)] p-3">
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium text-[var(--color-text-primary)]">{{ node().title }}</span>
        <span class="text-xs text-[var(--color-text-secondary)]">{{ node().progress }}%</span>
      </div>
      <p class="mt-1 text-xs text-[var(--color-text-secondary)]">
        {{ node().startDate }} – {{ node().endDate }} · {{ node().completedHours }} / {{ node().allocatedHours }}h
      </p>
      @if (node().children.length > 0) {
        <div class="mt-2 flex flex-col gap-2 pl-4">
          @for (child of node().children; track child.id) {
            <app-milestone-tree-node [node]="child" />
          }
        </div>
      }
    </div>
  `
})
export class MilestoneTreeNodeComponent {
  node = input.required<MilestoneTreeNode>();
}
