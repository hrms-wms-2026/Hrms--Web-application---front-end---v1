import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PopoutPanelComponent } from './popout-panel.component';

@Component({
  standalone: true,
  imports: [PopoutPanelComponent],
  template: `
    <app-popout-panel [open]="open()" label="Details" (closed)="closedCount = closedCount + 1; open.set(false)">
      <p data-testid="content">{{ open() ? 'all rows' : 'first rows' }}</p>
    </app-popout-panel>
  `
})
class HostComponent {
  readonly open = signal(false);
  closedCount = 0;
}

@Component({
  standalone: true,
  imports: [PopoutPanelComponent],
  template: `<app-popout-panel [open]="open()" expandedWidth="60rem" expandedMaxHeight="85vh" (closed)="open.set(false)"><p>rows</p></app-popout-panel>`
})
class WideHostComponent {
  readonly open = signal(false);
}

@Component({
  standalone: true,
  imports: [PopoutPanelComponent],
  template: `<app-popout-panel [open]="open()" expandedWidth="60rem" [growLeft]="true" (closed)="open.set(false)"><p>rows</p></app-popout-panel>`
})
class GrowLeftHostComponent {
  readonly open = signal(false);
}

describe('PopoutPanelComponent', () => {
  function setup() {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const panel = () => el.querySelector('[data-testid="popout-panel"]') as HTMLElement;
    return { fixture, el, panel };
  }

  it('stays in the page flow while closed', () => {
    const { el, panel } = setup();

    expect(panel().classList.contains('popout-panel--open')).toBe(false);
    expect(panel().getAttribute('role')).toBeNull();
    expect(el.querySelector('[data-testid="popout-backdrop"]')).toBeNull();
  });

  it('floats in place as a labelled dialog with a backdrop when opened, keeping a placeholder height', () => {
    const { fixture, el, panel } = setup();

    fixture.componentInstance.open.set(true);
    fixture.detectChanges();

    expect(panel().classList.contains('popout-panel--open')).toBe(true);
    expect(panel().getAttribute('role')).toBe('dialog');
    expect(panel().getAttribute('aria-label')).toBe('Details');
    expect(el.querySelector('[data-testid="popout-backdrop"]')).toBeTruthy();
    expect((el.querySelector('app-popout-panel') as HTMLElement).style.height).toMatch(/px$/);
    expect(el.querySelector('[data-testid="content"]')!.textContent).toContain('all rows');
  });

  it('reserves the resting height, not the height the content grows to in the same update', () => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    // The child host exists only after the first render pass; stub its layout height via the prototype.
    const spy = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.tagName === 'APP-POPOUT-PANEL' ? (fixture.componentInstance.open() ? 600 : 180) : 0;
    });
    fixture.detectChanges();

    fixture.componentInstance.open.set(true);
    fixture.detectChanges();

    expect(((fixture.nativeElement as HTMLElement).querySelector('app-popout-panel') as HTMLElement).style.height).toBe('180px');
    spy.mockRestore();
  });

  it('grows to the requested width and max height when asked, and back to the card width when closed', () => {
    TestBed.configureTestingModule({ imports: [WideHostComponent] });
    const fixture = TestBed.createComponent(WideHostComponent);
    fixture.detectChanges();
    const panel = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="popout-panel"]') as HTMLElement;
    const popout = fixture.debugElement.query((d) => d.name === 'app-popout-panel').componentInstance as PopoutPanelComponent;

    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    expect(panel.classList.contains('popout-panel--wide')).toBe(true);
    // jsdom cannot parse min()/max() widths, so check the resolved value the panel binds.
    expect(popout.panelWidth()).toContain('60rem');
    expect(popout.panelWidth()).toContain('100vw');
    expect(panel.style.maxHeight).toBe('85vh');

    fixture.componentInstance.open.set(false);
    fixture.detectChanges();
    expect(panel.classList.contains('popout-panel--wide')).toBe(false);
    expect(popout.panelWidth()).toBeNull();
  });

  it('with growLeft, sizes against the room left of the card and shifts left by any right-edge overflow', async () => {
    TestBed.configureTestingModule({ imports: [GrowLeftHostComponent] });
    const fixture = TestBed.createComponent(GrowLeftHostComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const host = root.querySelector('app-popout-panel') as HTMLElement;
    const panel = root.querySelector('[data-testid="popout-panel"]') as HTMLElement;
    const popout = fixture.debugElement.query((d) => d.name === 'app-popout-panel').componentInstance as PopoutPanelComponent;
    const viewport = document.documentElement.clientWidth;
    // A card in the last column: its right edge sits at the viewport's 24px gutter.
    host.getBoundingClientRect = () => ({ left: viewport - 424, right: viewport - 24 } as DOMRect);
    panel.getBoundingClientRect = () => ({ left: viewport - 424, right: viewport - 424 + 960 } as DOMRect);

    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(popout.panelWidth()).toContain(`${viewport - 24}px`);
    expect(popout.panelWidth()).not.toContain('100vw');
    expect(popout.leftShift()).toBe(560);
    expect(panel.style.left).toBe('-560px');

    fixture.componentInstance.open.set(false);
    fixture.detectChanges();
    expect(popout.leftShift()).toBe(0);
  });

  it('keeps the dim visual only, so the page underneath still scrolls', () => {
    const { fixture, el } = setup();
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();

    const backdrop = el.querySelector('[data-testid="popout-backdrop"]') as HTMLElement;
    expect(getComputedStyle(backdrop).pointerEvents).toBe('none');
  });

  it('ignores presses inside the panel', () => {
    const { fixture, panel } = setup();
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();

    panel().querySelector('[data-testid="content"]')!.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    fixture.detectChanges();

    expect(fixture.componentInstance.closedCount).toBe(0);
  });

  it('asks to close on a press outside the panel and on Escape, then drops back into the layout', () => {
    const { fixture, el, panel } = setup();
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();

    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    fixture.detectChanges();

    expect(fixture.componentInstance.closedCount).toBe(1);
    expect(panel().classList.contains('popout-panel--open')).toBe(false);
    expect((el.querySelector('app-popout-panel') as HTMLElement).style.height).toBe('');

    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    panel().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(fixture.componentInstance.closedCount).toBe(2);
  });
});
