import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DashboardLayoutApiService } from '../../data-access/dashboard-layout-api.service';
import { Subject } from 'rxjs';
import { BootstrapWidget, WidgetDataResponse } from '../../models/dashboard-layout.model';
import { injectWidgetData, WIDGET_DATA } from '../../widgets/widget-data';
import { WIDGET_REGISTRY } from '../../widgets/widget-registry';
import { WidgetFrameComponent } from './widget-frame.component';

@Component({ selector: 'app-fake-card', template: '<button data-testid="fake-btn">{{ flag() }}-{{ ctx?.data() }}</button>' })
class FakeCardComponent {
  readonly flag = input(false);
  readonly ctx = injectWidgetData<string>();
}

const registry = WIDGET_REGISTRY as Record<string, unknown>;
const fake = () => Promise.resolve(FakeCardComponent);

function widget(over: Partial<BootstrapWidget> = {}): BootstrapWidget {
  return {
    instanceId: 'w1',
    widgetKey: 'fake',
    title: 'Fake Card',
    layout: { x: 0, y: 0, w: 3, h: 2 },
    size: { minW: 2, minH: 2, maxW: 12, maxH: 6 },
    dataState: { status: 'success', fetchedAt: null, error: null },
    data: 'seed',
    ...over
  };
}

async function setup(w: BootstrapWidget, editing = false) {
  TestBed.configureTestingModule({
    providers: [{ provide: DashboardLayoutApiService, useValue: { widgetData: vi.fn() } }]
  });
  const fixture = TestBed.createComponent(WidgetFrameComponent);
  fixture.componentRef.setInput('widget', w);
  fixture.componentRef.setInput('editing', editing);
  fixture.detectChanges();
  // The card component arrives through a dynamic import; let it resolve, then render it.
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

describe('WidgetFrameComponent', () => {
  afterEach(() => {
    delete registry['fake'];
  });

  it('renders_registered_component_with_inputs', async () => {
    registry['fake'] = { load: fake, inputs: { flag: true } };
    const fixture = await setup(widget());
    const btn = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="fake-btn"]');
    expect(btn?.textContent).toBe('true-seed');
    expect(fixture.nativeElement.querySelector('[data-testid="unsupported-widget"]')).toBeNull();
  });

  it('does_not_load_the_card_chunk_until_the_widget_is_rendered', async () => {
    const load = vi.fn(fake);
    registry['fake'] = { load };
    expect(load).not.toHaveBeenCalled();
    await setup(widget());
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('failed_chunk_load_renders_placeholder', async () => {
    registry['fake'] = { load: () => Promise.reject(new Error('chunk failed')) };
    const fixture = await setup(widget());
    expect(fixture.nativeElement.querySelector('[data-testid="unsupported-widget"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="fake-btn"]')).toBeNull();
  });

  it('unknown_key_renders_placeholder', async () => {
    const fixture = await setup(widget({ widgetKey: 'does-not-exist' }));
    expect(fixture.nativeElement.querySelector('[data-testid="unsupported-widget"]')).not.toBeNull();
  });

  it('error_unsupported_widget_renders_placeholder', async () => {
    registry['fake'] = { load: fake };
    const fixture = await setup(widget({ dataState: { status: 'error', fetchedAt: null, error: 'UNSUPPORTED_WIDGET' } }));
    expect(fixture.nativeElement.querySelector('[data-testid="unsupported-widget"]')).not.toBeNull();
  });

  it('view_mode_has_no_chrome', async () => {
    registry['fake'] = { load: fake };
    const el = (await setup(widget(), false)).nativeElement as HTMLElement;
    expect(el.querySelector('[data-drag-handle]')).toBeNull();
    expect(el.querySelector('[data-resize-handle]')).toBeNull();
    expect(el.querySelector('[data-testid="widget-edit-overlay"]')).toBeNull();
    expect(el.querySelector('button[aria-label^="Remove"]')).toBeNull();
  });

  it('view_mode_wrapper_does_not_clip_and_flagged_card_is_overflow_visible', async () => {
    registry['fake'] = { load: fake };
    let el = (await setup(widget(), false)).nativeElement as HTMLElement;
    const wrapper = el.querySelector('[data-testid="widget-content"]') as HTMLElement;
    expect(wrapper.className).not.toContain('overflow-hidden');
    expect(wrapper.className).toContain('overflow-auto');
    TestBed.resetTestingModule();
    registry['fake'] = { load: fake, overflowVisible: true };
    el = (await setup(widget(), false)).nativeElement as HTMLElement;
    const flagged = el.querySelector('[data-testid="widget-content"]') as HTMLElement;
    expect(flagged.className).toContain('overflow-visible');
    expect(flagged.className).not.toContain('overflow-auto');
  });

  it('layout_only_change_keeps_refreshed_data_and_new_instance_reseeds', async () => {
    registry['fake'] = { load: fake };
    const pending = new Subject<WidgetDataResponse>();
    const widgetData = vi.fn().mockReturnValue(pending);
    TestBed.configureTestingModule({ providers: [{ provide: DashboardLayoutApiService, useValue: { widgetData } }] });
    const fixture = TestBed.createComponent(WidgetFrameComponent);
    const w = widget();
    fixture.componentRef.setInput('widget', w);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const btn = () => (fixture.nativeElement as HTMLElement).querySelector('[data-testid="fake-btn"]')?.textContent;
    expect(btn()).toBe('false-seed');

    // A refresh is in flight, then the grid moves the widget (new object, same dataState/data).
    const ctx = fixture.debugElement.injector.get(WIDGET_DATA);
    ctx.refresh();
    fixture.componentRef.setInput('widget', { ...w, layout: { x: 3, y: 1, w: 3, h: 2 } });
    fixture.detectChanges();
    expect(pending.observed).toBe(true);
    pending.next({ instanceId: 'w1', status: 'success', fetchedAt: 'now', payload: 'fresh' });
    pending.complete();
    fixture.detectChanges();
    expect(btn()).toBe('false-fresh');

    // Another move after the refresh still keeps the refreshed data.
    fixture.componentRef.setInput('widget', { ...w, layout: { x: 0, y: 4, w: 3, h: 2 } });
    fixture.detectChanges();
    expect(btn()).toBe('false-fresh');

    // A different instance is re-seeded.
    fixture.componentRef.setInput('widget', { ...w, instanceId: 'w2', data: 'other' });
    fixture.detectChanges();
    expect(btn()).toBe('false-other');
  });

  it('edit_mode_blocks_card_clicks_and_shows_remove', async () => {
    registry['fake'] = { load: fake };
    const fixture = await setup(widget(), true);
    const el = fixture.nativeElement as HTMLElement;
    let removed = 0;
    fixture.componentInstance.remove.subscribe(() => removed++);
    expect(el.querySelector('[data-drag-handle]')).not.toBeNull();
    expect(el.querySelector('[data-resize-handle]')).not.toBeNull();
    const overlay = el.querySelector('[data-testid="widget-edit-overlay"]') as HTMLElement;
    expect(overlay.className).toContain('absolute');
    expect(overlay.className).toContain('inset-0');
    expect(el.querySelector('[inert]')).not.toBeNull();
    const rm = el.querySelector('button[aria-label="Remove Fake Card"]') as HTMLButtonElement;
    expect(rm).not.toBeNull();
    rm.click();
    expect(removed).toBe(1);
  });

  it('edit_mode_chrome_floats_over_the_card_without_shrinking_it', async () => {
    // Size-driven widgets pick their view from their box, so edit chrome must not take space from the card:
    // the content stays the frame's only in-flow child, and the drag handle is the overlay itself.
    registry['fake'] = { load: fake };
    const el = (await setup(widget(), true)).nativeElement as HTMLElement;
    const frame = el.querySelector('[data-testid="widget-frame"]') as HTMLElement;
    expect(frame.children.length).toBe(2); // content box + absolutely positioned resize handle
    expect(frame.className).not.toMatch(/(^|\s)p-\d/);
    expect(el.querySelector('[data-testid="widget-edit-bar"]')).toBeNull();
    expect(el.querySelector('[data-drag-handle]')?.getAttribute('data-testid')).toBe('widget-edit-overlay');
  });
});
