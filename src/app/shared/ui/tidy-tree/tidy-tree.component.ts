import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, TemplateRef, computed, contentChild, input } from '@angular/core';
import { TidyTreeLayout, layoutTidyTree } from './tidy-tree-layout';

/** Template context for the card: `<ng-template let-node let-parent="parent" let-depth="depth">`. */
export interface TidyTreeCardContext<T> {
  readonly $implicit: T;
  readonly parent: T | null;
  readonly depth: number;
}

interface DropLine {
  readonly key: string;
  readonly d: string;
  readonly dashed: boolean;
}

/**
 * Org-chart canvas: lays a tree out compactly (see tidy-tree-layout) and draws each card from the
 * projected template, with elbow connectors underneath. Cards are fixed-size slots; the card itself
 * owns all interaction (selection, drag/drop, menus, hover cards).
 *
 * Slots are positioned with left/top and no z-index on purpose: that keeps a card's own popups
 * (menus, drop hints) in the chart's stacking context, so they paint above neighbouring cards.
 */
@Component({
  selector: 'app-tidy-tree',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `
    <div class="tt-canvas" role="tree" [attr.aria-label]="label()" [style.width.px]="layout().width" [style.height.px]="layout().height">
      <svg class="tt-links" [attr.width]="layout().width" [attr.height]="layout().height" aria-hidden="true">
        @for (stem of stems(); track $index) {
          <path class="tt-link" [attr.d]="stem" />
        }
        @for (line of drops(); track line.key) {
          <path class="tt-link" [class.tt-link--dashed]="line.dashed" [attr.d]="line.d" />
        }
      </svg>
      @for (node of layout().nodes; track node.key) {
        <div class="tt-slot" [style.left.px]="node.x" [style.top.px]="node.y" [style.width.px]="nodeWidth()" [style.height.px]="nodeHeight()">
          <ng-container *ngTemplateOutlet="card(); context: { $implicit: node.data, parent: node.parent, depth: node.depth }" />
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .tt-canvas { position: relative; }
    .tt-links { position: absolute; left: 0; top: 0; overflow: visible; pointer-events: none; }
    .tt-link { fill: none; stroke: var(--color-accent); stroke-width: 2; }
    .tt-link--dashed { stroke: var(--color-warning); stroke-dasharray: 5 4; }
    .tt-slot { position: absolute; display: flex; justify-content: center; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TidyTreeComponent<T> {
  readonly root = input.required<T>();
  readonly childrenOf = input.required<(node: T) => readonly T[]>();
  readonly keyOf = input.required<(node: T) => string>();
  readonly nodeWidth = input.required<number>();
  readonly nodeHeight = input.required<number>();
  readonly siblingGap = input(32);
  readonly levelGap = input(48);
  /** Draws the line into this card dashed amber (e.g. a one-off reporting line). */
  readonly dashedLink = input<(child: T) => boolean>(() => false);
  readonly label = input('Hierarchy');

  readonly card = contentChild.required<TemplateRef<TidyTreeCardContext<T>>>(TemplateRef);

  readonly layout = computed<TidyTreeLayout<T>>(() =>
    layoutTidyTree(this.root(), this.childrenOf(), this.keyOf(), {
      nodeWidth: this.nodeWidth(),
      nodeHeight: this.nodeHeight(),
      siblingGap: this.siblingGap(),
      levelGap: this.levelGap()
    })
  );

  /** Per parent: the stem down from the card and the bar across its children. */
  readonly stems = computed(() => {
    const { links } = this.layout();
    const half = this.nodeWidth() / 2;
    const byParent = new Map<string, number[]>();
    const parents = new Map<string, { x: number; bottom: number }>();
    for (const link of links) {
      const p = link.parent;
      parents.set(p.key, { x: p.x + half, bottom: p.y + this.nodeHeight() });
      byParent.set(p.key, [...(byParent.get(p.key) ?? []), link.child.x + half]);
    }
    const mid = this.levelGap() / 2;
    return [...parents].map(([key, p]) => {
      const xs = byParent.get(key)!;
      const y = p.bottom + mid;
      const bar = xs.length > 1 ? ` M${Math.min(...xs)},${y} H${Math.max(...xs)}` : '';
      return `M${p.x},${p.bottom} V${y}${bar}`;
    });
  });

  /** Per child: the drop from the bar into the card, dashed when `dashedLink` says so. */
  readonly drops = computed<DropLine[]>(() => {
    const half = this.nodeWidth() / 2;
    const mid = this.levelGap() / 2;
    const dashed = this.dashedLink();
    return this.layout().links.map((link) => {
      const x = link.child.x + half;
      return { key: link.key, d: `M${x},${link.child.y - mid} V${link.child.y}`, dashed: dashed(link.child.data) };
    });
  });
}
