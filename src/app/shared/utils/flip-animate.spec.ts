import { captureFlipRects, playFlipAnimation } from './flip-animate';

function mockElement(id: string, rect: Partial<DOMRect>): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('data-flip-id', id);
  el.getBoundingClientRect = () => ({
    top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}), ...rect
  });
  return el;
}

describe('captureFlipRects', () => {
  it('maps each [data-flip-id] element to its bounding rect, keyed by id', () => {
    const container = document.createElement('div');
    const a = mockElement('a', { left: 10, top: 20, width: 100, height: 50 });
    const b = mockElement('b', { left: 200, top: 20, width: 100, height: 50 });
    container.append(a, b);

    const snapshot = captureFlipRects(container);

    expect(snapshot['a']).toEqual(expect.objectContaining({ left: 10, top: 20, width: 100, height: 50 }));
    expect(snapshot['b']).toEqual(expect.objectContaining({ left: 200, top: 20, width: 100, height: 50 }));
  });

  it('ignores elements without a data-flip-id', () => {
    const container = document.createElement('div');
    const plain = document.createElement('div');
    container.append(plain);

    const snapshot = captureFlipRects(container);

    expect(Object.keys(snapshot)).toHaveLength(0);
  });
});

describe('playFlipAnimation', () => {
  const originalMatchMedia = window.matchMedia;

  // defineProperty, not assignment: another spec in the same run may leave matchMedia non-writable.
  function setMatchMedia(value: typeof window.matchMedia): void {
    Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value });
  }

  afterEach(() => {
    setMatchMedia(originalMatchMedia);
  });

  function setPrefersReducedMotion(matches: boolean): void {
    setMatchMedia(vi.fn().mockReturnValue({ matches } as MediaQueryList));
  }

  it('animates an element that moved, from its old position back to the new one', () => {
    setPrefersReducedMotion(false);
    const container = document.createElement('div');
    const el = mockElement('a', { left: 300, top: 20, width: 100, height: 50 });
    el.animate = vi.fn();
    container.append(el);

    const before = { a: { left: 100, top: 20, width: 100, height: 50 } as DOMRect };
    playFlipAnimation(container, before);

    expect(el.animate).toHaveBeenCalledTimes(1);
    const [keyframes] = (el.animate as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(keyframes[0].transform).toContain('translate(-200px, 0px)');
    expect(keyframes[1].transform).toBe('none');
  });

  it('does not animate an element that did not move or resize', () => {
    setPrefersReducedMotion(false);
    const container = document.createElement('div');
    const el = mockElement('a', { left: 100, top: 20, width: 100, height: 50 });
    el.animate = vi.fn();
    container.append(el);

    playFlipAnimation(container, { a: { left: 100, top: 20, width: 100, height: 50 } as DOMRect });

    expect(el.animate).not.toHaveBeenCalled();
  });

  it('skips animating entirely when the id has no prior snapshot (newly added element)', () => {
    setPrefersReducedMotion(false);
    const container = document.createElement('div');
    const el = mockElement('new', { left: 0, top: 0, width: 100, height: 50 });
    el.animate = vi.fn();
    container.append(el);

    playFlipAnimation(container, {});

    expect(el.animate).not.toHaveBeenCalled();
  });

  it('does nothing when the user prefers reduced motion', () => {
    setPrefersReducedMotion(true);
    const container = document.createElement('div');
    const el = mockElement('a', { left: 300, top: 20, width: 100, height: 50 });
    el.animate = vi.fn();
    container.append(el);

    playFlipAnimation(container, { a: { left: 100, top: 20, width: 100, height: 50 } as DOMRect });

    expect(el.animate).not.toHaveBeenCalled();
  });

  it('computes a scale transform for elements that resized', () => {
    setPrefersReducedMotion(false);
    const container = document.createElement('div');
    const el = mockElement('a', { left: 0, top: 0, width: 200, height: 100 });
    el.animate = vi.fn();
    container.append(el);

    playFlipAnimation(container, { a: { left: 0, top: 0, width: 100, height: 50 } as DOMRect });

    const [keyframes] = (el.animate as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(keyframes[0].transform).toContain('scale(0.5, 0.5)');
  });
});
