import { TestBed } from '@angular/core/testing';
import { CanvasMinimapComponent } from './canvas-minimap.component';

describe('CanvasMinimapComponent', () => {
  async function setup() {
    await TestBed.configureTestingModule({ imports: [CanvasMinimapComponent] }).compileComponents();
    const fixture = TestBed.createComponent(CanvasMinimapComponent);
    fixture.componentRef.setInput('world', { x: -100, y: -50, width: 400, height: 200 });
    fixture.componentRef.setInput('items', [
      { shape: 'circle', x: 0, y: 0, r: 10, tone: 'secondary' },
      { shape: 'rect', x: 50, y: 20, width: 80, height: 30 }
    ]);
    fixture.componentRef.setInput('links', [{ x1: 0, y1: 0, x2: 50, y2: 20 }]);
    fixture.componentRef.setInput('viewport', { x: 0, y: 0, width: 100, height: 60 });
    fixture.detectChanges();
    return fixture;
  }

  it('frames the world box and draws items, links and the viewport rectangle', async () => {
    const fixture = await setup();
    const map: SVGSVGElement = fixture.nativeElement.querySelector('.cmm-map');
    expect(map.getAttribute('viewBox')).toBe('-100 -50 400 200');
    expect(map.querySelector('circle.cmm-item--secondary')).not.toBeNull();
    expect(map.querySelector('rect.cmm-item--primary')).not.toBeNull();
    expect(map.querySelectorAll('line.cmm-link').length).toBe(1);
    expect(map.querySelector('rect.cmm-view')?.getAttribute('width')).toBe('100');
  });

  it('emits zoom and fit from its buttons and disables zoom at the limits', async () => {
    const fixture = await setup();
    const events: string[] = [];
    fixture.componentInstance.zoomIn.subscribe(() => events.push('in'));
    fixture.componentInstance.zoomOut.subscribe(() => events.push('out'));
    fixture.componentInstance.fit.subscribe(() => events.push('fit'));
    const el: HTMLElement = fixture.nativeElement;

    (el.querySelector('button[aria-label="Zoom in"]') as HTMLButtonElement).click();
    (el.querySelector('button[aria-label="Zoom out"]') as HTMLButtonElement).click();
    (el.querySelector('button[aria-label="Fit to view"]') as HTMLButtonElement).click();
    expect(events).toEqual(['in', 'out', 'fit']);

    fixture.componentRef.setInput('canZoomIn', false);
    fixture.detectChanges();
    expect((el.querySelector('button[aria-label="Zoom in"]') as HTMLButtonElement).disabled).toBe(true);
  });

  it('keeps pointer and wheel gestures from reaching the canvas underneath', async () => {
    const fixture = await setup();
    const parentPointer = vi.fn();
    const parentWheel = vi.fn();
    const host: HTMLElement = fixture.nativeElement;
    const parent = document.createElement('div');
    parent.appendChild(host);
    parent.addEventListener('pointerdown', parentPointer);
    parent.addEventListener('wheel', parentWheel);

    host.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    host.dispatchEvent(new Event('wheel', { bubbles: true }));

    expect(parentPointer).not.toHaveBeenCalled();
    expect(parentWheel).not.toHaveBeenCalled();
  });
});
