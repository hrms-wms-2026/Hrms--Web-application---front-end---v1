import { Component, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PanZoomCanvasComponent } from './pan-zoom-canvas.component';

@Component({
  standalone: true,
  imports: [PanZoomCanvasComponent],
  template: `
    <app-pan-zoom-canvas label="Chart" (backgroundPointerDown)="pressed = pressed + 1">
      <h2 canvasOverlay class="title">Title</h2>
      <div class="tt-slot card" style="width: 100px; height: 40px">A</div>
      <div class="tt-slot card highlight" style="width: 100px; height: 40px">B</div>
    </app-pan-zoom-canvas>
  `
})
class HostComponent {
  readonly canvas = viewChild.required(PanZoomCanvasComponent);
  pressed = 0;
}

describe('PanZoomCanvasComponent', () => {
  async function setup() {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return { fixture, host: fixture.componentInstance, canvas: fixture.componentInstance.canvas() };
  }

  function pointer(type: string, target: Element, clientX = 0, clientY = 0, button = 0): PointerEvent {
    return { type, pointerId: 1, clientX, clientY, button, target, preventDefault: () => {} } as unknown as PointerEvent;
  }

  const wheel = (deltaY: number, preventDefault: () => void = () => {}) => ({ deltaY, preventDefault }) as unknown as WheelEvent;

  it('projects overlay content outside the zoomed world and the rest inside it, over the grid', async () => {
    const { fixture } = await setup();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('app-pan-zoom-canvas > .title')).not.toBeNull();
    expect(el.querySelectorAll('.pzc-world .card').length).toBe(2);
    expect(el.querySelector('app-pan-zoom-canvas > app-canvas-grid')).not.toBeNull();
  });

  it('wheel zooms in small steps, prevents page scroll, and clamps at the limits', async () => {
    const { canvas } = await setup();
    const preventDefault = vi.fn();
    expect(canvas.zoom()).toBe(0.7);

    canvas.onWheel(wheel(-100, preventDefault));
    expect(canvas.zoom()).toBeCloseTo(0.72);
    expect(preventDefault).toHaveBeenCalled();
    canvas.onWheel(wheel(100));
    expect(canvas.zoom()).toBeCloseTo(0.7);

    for (let i = 0; i < 60; i++) canvas.onWheel(wheel(-100));
    expect(canvas.zoom()).toBe(1.5);
    for (let i = 0; i < 80; i++) canvas.onWheel(wheel(100));
    expect(canvas.zoom()).toBe(0.4);
  });

  it('a wheel tick is smaller than a +/- click; buttons clamp; reset restores zoom and pan', async () => {
    const { canvas } = await setup();
    canvas.onWheel(wheel(-100));
    const wheelStep = canvas.zoom() - 0.7;
    canvas.resetZoom();
    canvas.zoomIn();
    expect(canvas.zoom()).toBe(0.8);
    expect(wheelStep).toBeGreaterThan(0);
    expect(wheelStep).toBeLessThan(canvas.zoom() - 0.7);

    for (let i = 0; i < 20; i++) canvas.zoomIn();
    expect(canvas.zoom()).toBe(1.5);
    for (let i = 0; i < 30; i++) canvas.zoomOut();
    expect(canvas.zoom()).toBe(0.4);

    canvas.panX.set(40);
    canvas.resetZoom();
    expect(canvas.zoom()).toBe(0.7);
    expect(canvas.panX()).toBe(0);
    expect(canvas.transform()).toBe('translate(0px, 0px) scale(0.7)');
  });

  it('dragging empty canvas pans and reports a background press; pointercancel ends the pan', async () => {
    const { fixture, host, canvas } = await setup();
    const background: HTMLElement = fixture.nativeElement.querySelector('app-pan-zoom-canvas');

    canvas.onPointerDown(pointer('pointerdown', background, 100, 200));
    expect(canvas.isPanning()).toBe(true);
    expect(host.pressed).toBe(1);
    canvas.onPointerMove(pointer('pointermove', background, 150, 230));
    expect(canvas.panX()).toBe(50);
    expect(canvas.panY()).toBe(30);
    expect(canvas.transform()).toContain('translate(50px, 30px)');
    canvas.endPan();
    expect(canvas.isPanning()).toBe(false);
  });

  it('pressing a card, a button or the minimap never starts a pan', async () => {
    const { fixture, host, canvas } = await setup();
    const card: HTMLElement = fixture.nativeElement.querySelector('.card');
    const button = document.createElement('button');
    const minimap = document.createElement('app-canvas-minimap');

    for (const target of [card, button, minimap]) canvas.onPointerDown(pointer('pointerdown', target));
    canvas.onPointerDown(pointer('pointerdown', fixture.nativeElement.querySelector('app-pan-zoom-canvas'), 0, 0, 2));

    expect(canvas.isPanning()).toBe(false);
    expect(host.pressed).toBe(0);
  });

  it('centerOn pans so the world point lands in the canvas centre, matching the minimap viewport', async () => {
    const { canvas } = await setup();
    // Canvas 1000x600, content at (32, 80), 936 wide: its top-centre origin is x = 468.
    (canvas as unknown as { layout: { set(v: object): void } }).layout.set({ width: 1000, height: 600, left: 32, top: 80, worldWidth: 936 });

    canvas.centerOn({ x: 468, y: 200 });

    expect(canvas.panX()).toBeCloseTo(0); // 500 - 32 - 468 - 0.7 * 0
    expect(canvas.panY()).toBeCloseTo(80); // 300 - 80 - 0.7 * 200
    const v = canvas.viewport()!;
    expect(v.x + v.width / 2).toBeCloseTo(468);
    expect(v.y + v.height / 2).toBeCloseTo(200);
  });

  it('fit falls back to the starting zoom when there is nothing measurable (no layout in tests)', async () => {
    const { canvas } = await setup();
    canvas.zoomIn();
    canvas.panX.set(25);
    canvas.fit();
    expect(canvas.zoom()).toBe(0.7);
    expect(canvas.panX()).toBe(0);
  });

  it('fitAndReveal leaves a fitted view alone when the element is visible, and centres on it when it is not', async () => {
    const { canvas } = await setup();
    const fit = vi.spyOn(canvas, 'fit').mockImplementation(() => undefined);
    const centre = vi.spyOn(canvas, 'centerOnMatch');
    const layout = (canvas as unknown as { layout: { set(v: object): void } }).layout;

    // jsdom has no layout, so both cards sit at (0,0); a viewport covering the origin shows them.
    layout.set({ width: 1000, height: 600, left: 0, top: 0, worldWidth: 1000 });
    canvas.fitAndReveal('.highlight');
    expect(fit).toHaveBeenCalled();
    expect(centre).not.toHaveBeenCalled();

    // Pan far away so the origin is off screen: it centres on the card.
    canvas.panX.set(-5000);
    canvas.fitAndReveal('.highlight');
    expect(centre).toHaveBeenCalledWith('.highlight');
  });

  it('centerOnMatch finds content by selector and reports when nothing matches', async () => {
    const { canvas } = await setup();
    expect(canvas.centerOnMatch('.highlight')).toBe(true);
    expect(canvas.centerOnMatch('.missing')).toBe(false);
  });
});
