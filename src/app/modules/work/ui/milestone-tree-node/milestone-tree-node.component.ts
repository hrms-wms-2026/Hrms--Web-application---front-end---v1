import { Component, input, output, signal } from '@angular/core';
import { MilestoneTreeNode } from '../../models/milestone.model';

@Component({
  selector: 'app-milestone-tree-node',
  standalone: true,
  imports: [MilestoneTreeNodeComponent],
  template: `
    <div class="relative" [style.paddingLeft.px]="depth() > 0 ? 22 : 0">
      @if (depth() > 0) {
        <span class="pointer-events-none absolute left-[7px] top-0 h-[15px] w-[10px] border-b border-l border-[var(--color-border)]"></span>
      }
      <div
        data-testid="tree-row"
        class="flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-sm hover:bg-[var(--color-surface-secondary)]"
        [class.bg-[var(--color-surface-secondary)]]="selectedId() === node().id"
        [class.font-semibold]="selectedId() === node().id"
        [class.text-[var(--color-accent)]]="selectedId() === node().id"
        (click)="selected.emit(node().id)"
      >
        @if (node().children.length > 0) {
          <button
            type="button"
            data-testid="expand-toggle"
            class="flex h-4 w-4 shrink-0 items-center justify-center text-[10px] text-[var(--color-text-secondary)]"
            [attr.aria-label]="expanded() ? 'Collapse' : 'Expand'"
            (click)="toggleExpanded($event)"
          >{{ expanded() ? '▾' : '▸' }}</button>
        } @else {
          <span class="w-4 shrink-0"></span>
        }
        <span class="flex-1 truncate text-[var(--color-text-primary)]">{{ node().title }}</span>
        <span class="shrink-0 text-xs text-[var(--color-text-secondary)]">{{ node().progress }}%</span>
      </div>
      @if (expanded() && node().children.length > 0) {
        <div>
          @for (child of node().children; track child.id) {
            <app-milestone-tree-node [node]="child" [selectedId]="selectedId()" [depth]="depth() + 1" (selected)="selected.emit($event)" />
          }
        </div>
      }
    </div>
  `
})
export class MilestoneTreeNodeComponent {
  node = input.required<MilestoneTreeNode>();
  selectedId = input<string | null>(null);
  depth = input(0);
  selected = output<string>();

  expanded = signal(true);

  toggleExpanded(event: Event): void {
    event.stopPropagation();
    this.expanded.update(v => !v);
  }
}
