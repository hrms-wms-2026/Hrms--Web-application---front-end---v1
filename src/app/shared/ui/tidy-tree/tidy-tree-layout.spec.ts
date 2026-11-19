import { TidyTreeLayout, TidyTreeOptions, layoutTidyTree } from './tidy-tree-layout';

interface T { readonly id: string; readonly children: readonly T[] }

const OPTS: TidyTreeOptions = { nodeWidth: 250, nodeHeight: 64, siblingGap: 32, levelGap: 48 };
const n = (id: string, ...children: T[]): T => ({ id, children });
const layout = (root: T) => layoutTidyTree(root, (t) => t.children, (t) => t.id, OPTS);
const at = (l: TidyTreeLayout<T>, id: string) => l.nodes.find((node) => node.data.id === id)!;

describe('layoutTidyTree', () => {
  it('a leaf sibling packs right next to a sibling whose subtree spreads wide further down (the gap from the screenshot)', () => {
    // Kavisna -> Nilaxan -> two reports; Sangavi is a leaf. Nested boxes pushed Sangavi past the grandchildren.
    const l = layout(n('suthershan', n('kavisna', n('nilaxan', n('a'), n('kiru'))), n('sangavi')));
    expect(at(l, 'sangavi').x - at(l, 'kavisna').x).toBe(OPTS.nodeWidth + OPTS.siblingGap);
    // ...and it is now left of the wide grandchild row's right edge, which the old layout could not do.
    expect(at(l, 'sangavi').x).toBeLessThan(at(l, 'kiru').x + OPTS.nodeWidth);
  });

  it('centres a parent over its first and last child and puts rows levelGap apart', () => {
    const l = layout(n('root', n('a'), n('b'), n('c')));
    const root = at(l, 'root');
    expect(root.x).toBeCloseTo((at(l, 'a').x + at(l, 'c').x) / 2);
    expect(at(l, 'a').y - root.y).toBe(OPTS.nodeHeight + OPTS.levelGap);
    expect(l.height).toBe(2 * OPTS.nodeHeight + OPTS.levelGap);
    expect(Math.min(...l.nodes.map((node) => node.x))).toBe(0);
    expect(l.width).toBe(3 * OPTS.nodeWidth + 2 * OPTS.siblingGap);
  });

  it('a single child sits straight under its parent', () => {
    const l = layout(n('root', n('only')));
    expect(at(l, 'only').x).toBe(at(l, 'root').x);
  });

  it('a small subtree between two wide ones sits in the middle of the gap, not against the left one', () => {
    const wide = (id: string) => n(id, n(`${id}1`), n(`${id}2`), n(`${id}3`));
    const l = layout(n('root', wide('left'), n('small'), wide('right')));
    const small = at(l, 'small');
    const toLeft = small.x - at(l, 'left').x;
    const toRight = at(l, 'right').x - small.x;
    expect(toLeft).toBeCloseTo(toRight);
  });

  it('emits one link per parent-child pair and keys unique across the tree', () => {
    const l = layout(n('root', n('a', n('x')), n('b', n('x'))));
    expect(l.links.length).toBe(4);
    expect(new Set(l.nodes.map((node) => node.key)).size).toBe(l.nodes.length);
    const link = l.links.find((k) => k.child.data.id === 'a')!;
    expect(link.parent.data.id).toBe('root');
  });

  it('never lets two cards on the same row get closer than nodeWidth + siblingGap (random trees)', () => {
    let seed = 7;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    let counter = 0;
    const build = (depth: number): T => {
      const count = depth >= 5 ? 0 : Math.floor(rand() * (depth === 0 ? 5 : 4));
      return n(`n${counter++}`, ...Array.from({ length: count }, () => build(depth + 1)));
    };
    for (let trial = 0; trial < 40; trial++) {
      const l = layout(build(0));
      const rows = new Map<number, number[]>();
      for (const node of l.nodes) rows.set(node.y, [...(rows.get(node.y) ?? []), node.x]);
      for (const xs of rows.values()) {
        xs.sort((a, b) => a - b);
        for (let i = 1; i < xs.length; i++) {
          expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(OPTS.nodeWidth + OPTS.siblingGap - 1e-6);
        }
      }
    }
  });
});
