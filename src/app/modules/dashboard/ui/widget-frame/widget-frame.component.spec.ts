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

function setup(w: BootstrapWidget, editing = false) {
  TestBed.configureTestingModule({
    providers: [{ provide: DashboardLayoutApiService, useValue: { widgetData: vi.fn() } }]
  });
  const fixture = TestBed.createComponent(WidgetFrameComponent);
  fixture.componentRef.setInput('widget', w);
  fixture.componentRef.setInput('editing', editing);
  fixture.detectChanges();
  return fixture;
}

describe('WidgetFrameComponent', () => {
  afterEach(() => {
    delete registry['fake'];
  });

  it('renders_registered_component_with_inputs', () => {
    registry['fake'] = { component: FakeCardComponent, inputs: { flag: true } };
    const fixture = setup(widget());
    const btn = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="fake-btn"]');
    expect(btn?.textContent).toBe('true-seed');
    expect(fixture.nativeElement.querySelector('[data-testid="unsupported-widget"]')).toBeNull();
  });

  it('unknown_key_renders_placeholder', () => {
    const fixture = setup(widget({ widgetKey: 'does-not-exist' }));
    expect(fixture.nativeElement.querySelector('[data-testid="unsupported-widget"]')).not.toBeNull();
  });

  it('error_unsupported_widget_renders_placeholder', () => {
    registry['fake'] = { component: FakeCardComponent };
    const fixture = setup(widget({ dataState: { status: 'error', fetchedAt: null, error: 'UNSUPPORTED_WIDGET' } }));
    expect(fixture.nativeElement.querySelector('[data-testid="unsupported-widget"]')).not.toBeNull();
  });

  it('view_mode_has_no_chrome', () => {
    registry['fake'] = { component: FakeCardComponent };
    const el = setup(widget(), false).nativeElement as HTMLElement;
    expect(el.querySelector('[data-drag-handle]')).toBeNull();
    expect(el.querySelector('[data-resize-handle]')).toBeNull();
    expect(el.querySelector('[data-testid="widget-edit-overlay"]')).toBeNull();
    expect(el.querySelector('button[aria-label^="Remove"]')).toBeNull();
  });

  it('view_mode_wrapper_does_not_clip_and_flagged_card_is_overflow_visible', () => {
    registry['fake'] = { component: FakeCardComponent };
    let el = setup(widget(), false).nativeElement as HTMLElement;
    const wrapper = el.querySelector('[data-testid="widget-content"]') as HTMLElement;
    expect(wrapper.className).not.toContain('overflow-hidden');
    expect(wrapper.className).toContain('overflow-auto');
    TestBed.resetTestingModule();
    registry['fake'] = { component: FakeCardComponent, overflowVisible: true };
    el = setup(widget(), false).nativeElement as HTMLElement;
    const flagged = el.querySelector('[data-testid="widget-content"]') as HTMLElement;
    expect(flagged.className).toContain('overflow-visible');
    expect(flagged.className).not.toContain('overflow-auto');
  });

  it('layout_only_change_keeps_refreshed_data_and_new_instance_reseeds', () => {
    registry['fake'] = { component: FakeCardComponent };
    const pending = new Subject<WidgetDataResponse>();
    const widgetData = vi.fn().mockReturnValue(pending);
    TestBed.configureTestingModule({ providers: [{ provide: DashboardLayoutApiService, useValue: { widgetData } }] });
    const fixture = TestBed.createComponent(WidgetFrameComponent);
    const w = widget();
    fixture.componentRef.setInput('widget', w);
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

  it('edit_mode_blocks_card_clicks_and_shows_remove', () => {
    registry['fake'] = { component: FakeCardComponent };
    const fixture = setup(widget(), true);
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
});
