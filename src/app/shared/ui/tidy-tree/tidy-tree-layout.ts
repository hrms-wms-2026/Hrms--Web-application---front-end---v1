/**
 * Compact ("tidy") layout for org-chart style trees with fixed-size cards.
 *
 * Each subtree is packed against its neighbours using per-depth contours, so a sibling only keeps
 * clear of the cards that are actually on its own rows: a leaf can sit right next to a sibling whose
 * subtree spreads wide further down. A nested-box layout instead reserves the widest descendant row
 * for every row and leaves large empty strips.
 *
 * Siblings are packed left-to-right and right-to-left and the two results averaged, so a small
 * subtree between two large ones lands in the middle of the gap instead of hugging the left one.
 * Both packings keep every pair of cards apart, and so does their average.
 */

export interface TidyTreeOptions {
  readonly nodeWidth: number;
  readonly nodeHeight: number;
  /** Minimum horizontal space between two cards on the same row. */
  readonly siblingGap: number;
  /** Vertical space between a card and the row below it (connector lines live here). */
  readonly levelGap: number;
}

export interface TidyTreeNode<T> {
  /** Unique across the tree: the path of keys from the root. */
  readonly key: string;
  readonly data: T;
  readonly parent: T | null;
  readonly depth: number;
  /** Top-left corner of the card. */
  readonly x: number;
  readonly y: number;
}

export interface TidyTreeLink<T> {
  readonly key: string;
  readonly parent: TidyTreeNode<T>;
  readonly child: TidyTreeNode<T>;
}

export interface TidyTreeLayout<T> {
  readonly nodes: readonly TidyTreeNode<T>[];
  readonly links: readonly TidyTreeLink<T>[];
  readonly width: number;
  readonly height: number;
}

interface Packed<T> {
  readonly data: T;
  readonly children: readonly Packed<T>[];
  /** Child centre offsets relative to this node's centre. */
  readonly offsets: readonly number[];
  /** Leftmost / rightmost card edge per depth (0 = this node), relative to this node's centre. */
  readonly left: readonly number[];
  readonly right: readonly number[];
}

export function layoutTidyTree<T>(
  root: T,
  childrenOf: (node: T) => readonly T[],
  keyOf: (node: T) => string,
  options: TidyTreeOptions
): TidyTreeLayout<T> {
  const half = options.nodeWidth / 2;
  const gap = options.siblingGap;

  const pack = (data: T): Packed<T> => {
    const children = childrenOf(data).map(pack);
    if (children.length === 0) return { data, children, offsets: [], left: [-half], right: [half] };

    const fromLeft = packRow(children, gap);
    const fromRight = packRow([...children].reverse().map(mirror), gap).reverse().map((p) => -p);
    // Re-anchor the mirrored packing on the same first child before averaging.
    const shift = fromLeft[0] - fromRight[0];
    const positions = fromLeft.map((p, i) => (p + fromRight[i] + shift) / 2);

    const mid = (positions[0] + positions[positions.length - 1]) / 2;
    const offsets = positions.map((p) => p - mid);
    const left: number[] = [];
    const right: number[] = [];
    children.forEach((child, i) => {
      child.left.forEach((v, d) => { left[d] = Math.min(left[d] ?? Infinity, v + offsets[i]); });
      child.right.forEach((v, d) => { right[d] = Math.max(right[d] ?? -Infinity, v + offsets[i]); });
    });
    return { data, children, offsets, left: [-half, ...left], right: [half, ...right] };
  };

  const nodes: TidyTreeNode<T>[] = [];
  const links: TidyTreeLink<T>[] = [];
  const rowStep = options.nodeHeight + options.levelGap;
  let maxDepth = 0;

  const place = (packed: Packed<T>, centre: number, depth: number, parent: TidyTreeNode<T> | null): void => {
    const key = parent ? `${parent.key}/${keyOf(packed.data)}` : keyOf(packed.data);
    const node: TidyTreeNode<T> = { key, data: packed.data, parent: parent?.data ?? null, depth, x: centre - half, y: depth * rowStep };
    nodes.push(node);
    if (parent) links.push({ key, parent, child: node });
    maxDepth = Math.max(maxDepth, depth);
    packed.children.forEach((child, i) => place(child, centre + packed.offsets[i], depth + 1, node));
  };

  place(pack(root), 0, 0, null);

  const minX = Math.min(...nodes.map((n) => n.x));
  const maxX = Math.max(...nodes.map((n) => n.x + options.nodeWidth));
  const shifted = nodes.map((n) => ({ ...n, x: n.x - minX }));
  const byKey = new Map(shifted.map((n) => [n.key, n]));
  return {
    nodes: shifted,
    links: links.map((l) => ({ key: l.key, parent: byKey.get(l.parent.key)!, child: byKey.get(l.child.key)! })),
    width: maxX - minX,
    height: (maxDepth + 1) * options.nodeHeight + maxDepth * options.levelGap
  };
}

/**
 * Centre positions for a row of sibling subtrees, first one at 0, each pushed right just far
 * enough to clear everything already placed on every row they share.
 */
function packRow<T>(children: readonly Packed<T>[], gap: number): number[] {
  const positions = [0];
  const right = [...children[0].right];
  for (let i = 1; i < children.length; i++) {
    const child = children[i];
    let pos = -Infinity;
    for (let d = 0; d < Math.min(right.length, child.left.length); d++) {
      pos = Math.max(pos, right[d] - child.left[d] + gap);
    }
    positions.push(pos);
    child.right.forEach((v, d) => { right[d] = Math.max(right[d] ?? -Infinity, v + pos); });
  }
  return positions;
}

/** The same subtree seen in a mirror (left and right contours swapped and negated). */
function mirror<T>(packed: Packed<T>): Packed<T> {
  return { ...packed, left: packed.right.map((v) => -v), right: packed.left.map((v) => -v) };
}
