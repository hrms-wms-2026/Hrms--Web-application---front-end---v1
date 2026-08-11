import { Component, OnInit, input, output, signal } from '@angular/core';
import { MilestoneTreeNode } from '../../models/milestone.model';

@Component({
  selector: 'app-milestone-tree-node',
  standalone: true,
  imports: [MilestoneTreeNodeComponent],
  template: `
    <div>
      <div
        class="flex items-center gap-1.5 rounded-md px-2 py-1.5 cursor-pointer hover:bg-[var(--color-surface-secondary)]"
        [class.ring-2]="node().id === selectedId()"
        [class.ring-[var(--color-focus-ring)]]="node().id === selectedId()"
        data-testid="tree-row"
        (click)="selected.emit(node())"
      >
        @if (node().children.length > 0) {
          <button
            type="button"
            class="flex h-4 w-4 shrink-0 items-center justify-center text-[var(--color-text-secondary)] transition-transform"
            [style.transform]="expanded() ? 'rotate(90deg)' : 'rotate(0deg)'"
            data-testid="chevron"
            [attr.aria-label]="expanded() ? 'Collapse' : 'Expand'"
            (click)="toggleExpanded($event)"
          >
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        } @else {
          <span class="h-4 w-4 shrink-0"></span>
        }
        <span class="flex-1 truncate text-sm text-[var(--color-text-primary)]">{{ node().title }}</span>
        <span class="text-xs text-[var(--color-text-secondary)]">{{ node().progress }}%</span>
      </div>

      @if (node().children.length > 0 && expanded()) {
        <div class="ml-4 flex flex-col gap-0.5 border-l border-[var(--color-border)] pl-3">
          @for (child of node().children; track child.id) {
            <app-milestone-tree-node
              [node]="child"
              [selectedId]="selectedId()"
              [expandedByDefault]="false"
              (selected)="selected.emit($event)"
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
  selected = output<MilestoneTreeNode>();

  expanded = signal(true);

  ngOnInit(): void {
    this.expanded.set(this.expandedByDefault());
  }

  toggleExpanded(event: Event): void {
    event.stopPropagation();
    this.expanded.set(!this.expanded());
  }
}
