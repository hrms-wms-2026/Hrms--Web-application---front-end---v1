import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { DashboardLayoutApiService } from '../../data-access/dashboard-layout-api.service';
import { BootstrapWidget } from '../../models/dashboard-layout.model';
import { DashboardGridComponent } from './dashboard-grid.component';

function widget(id: string, over: Partial<BootstrapWidget> = {}): BootstrapWidget {
  return {
    instanceId: id,
    widgetKey: 'fake-' + id,
    title: 'Widget ' + id,
    layout: { x: 2, y: 1, w: 3, h: 2 },
    size: { minW: 2, minH: 1, maxW: 6, maxH: 4 },
    dataState: { status: 'success', fetchedAt: null, error: null },
    data: null,
    ...over
  };
}

// 1200px wide, 12 columns, 12px gap => cell 89px, pitch 101px horizontally; rows 96px => pitch 108px.
function setup(widgets: BootstrapWidget[], editing = true) {
  TestBed.configureTestingModule({
    providers: [{ provide: DashboardLayoutApiService, useValue: { widgetData: vi.fn() } }]
  });
  const fixture = TestBed.createComponent(DashboardGridComponent);
  fixture.componentRef.setInput('widgets', widgets);
  fixture.componentRef.setInput('columns', 12);
  fixture.componentRef.setInput('rowHeight', 96);
  fixture.componentRef.setInput('gap', 12);
  fixture.componentRef.setInput('editing', editing);
  const el: HTMLElement = fixture.nativeElement;
  const grid = el.querySelector('[data-testid="dashboard-grid"]') as HTMLElement | null;
  fixture.detectChanges();
  const gridEl = (grid ?? (el.querySelector('[data-testid="dashboard-grid"]') as HTMLElement));
  Object.defineProperty(gridEl, 'clientWidth', { configurable: true, value: 1200 });
  const moved = vi.fn();
  const resized = vi.fn();
  const removed = vi.fn();
  fixture.componentInstance.reordered.subscribe((e) => moved(e.id, e.index));
  fixture.componentInstance.resized.subscribe((e) => resized(e.id, e.w, e.h));
  fixture.componentInstance.removed.subscribe((id) => removed(id));
  return { fixture, el, moved, resized, removed };
}

function cell(el: HTMLElement, id: string): HTMLElement {
  return el.querySelector(`[data-instance-id="${id}"]`) as HTMLElement;
}

function ptr(type: string, clientX: number, clientY: number, target: EventTarget) {
  target.dispatchEvent(new MouseEvent(type, { clientX, clientY, bubbles: true, cancelable: true }));
}

function key(target: HTMLElement, k: string, shiftKey = false) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key: k, shiftKey, bubbles: true, cancelable: true }));
}

describe('DashboardGridComponent', () => {
  it('places_widget_by_grid_lines', () => {
    const { el } = setup([widget('a'), widget('b', { layout: { x: 0, y: 0, w: 4, h: 3 } })]);
    const a = cell(el, 'a');
    expect(a.style.gridColumn).toBe('3 / span 3');
    expect(a.style.gridRow).toBe('2 / span 2');
    const b = cell(el, 'b');
    expect(b.style.gridColumn).toBe('1 / span 4');
    expect(b.style.gridRow).toBe('1 / span 3');
    const grid = el.querySelector('[data-testid="dashboard-grid"]') as HTMLElement;
    expect(grid.style.gridTemplateColumns).toContain('repeat(12');
    expect(grid.style.gridTemplateColumns).toContain('minmax(0');
    expect(grid.style.gridAutoRows).toBe('96px');
    expect(grid.style.gap).toBe('12px');
  });

  it('keyboard_arrows_move_a_widget_earlier_or_later_in_reading_order', () => {
    const { el, moved } = setup([widget('a', { layout: { x: 0, y: 0, w: 3, h: 2 } }), widget('b', { layout: { x: 3, y: 0, w: 3, h: 2 } })]);
    const a = cell(el, 'a');
    expect(a.getAttribute('tabindex')).toBe('0');
    expect(a.getAttribute('aria-label')).toBe('Widget a, column 1, row 1, width 3, height 2');
    key(a, 'ArrowLeft');
    key(a, 'ArrowUp');
    expect(moved).not.toHaveBeenCalled();
    key(a, 'ArrowRight');
    expect(moved).toHaveBeenLastCalledWith('a', 1);
    key(a, 'ArrowDown');
    expect(moved).toHaveBeenLastCalledWith('a', 1);
    key(cell(el, 'b'), 'ArrowUp');
    expect(moved).toHaveBeenLastCalledWith('b', 0);
    key(cell(el, 'b'), 'ArrowRight');
    expect(moved).toHaveBeenCalledTimes(3);
  });

  it('shift_arrow_emits_resized', () => {
    const { el, resized, moved } = setup([widget('a')]);
    const a = cell(el, 'a');
    key(a, 'ArrowRight', true);
    expect(resized).toHaveBeenLastCalledWith('a', 4, 2);
    key(a, 'ArrowDown', true);
    expect(resized).toHaveBeenLastCalledWith('a', 3, 3);
    key(a, 'ArrowLeft', true);
    expect(resized).toHaveBeenLastCalledWith('a', 2, 2);
    key(a, 'ArrowUp', true);
    expect(resized).toHaveBeenLastCalledWith('a', 3, 1);
    expect(moved).not.toHaveBeenCalled();
  });

  it('delete_and_backspace_emit_removed', () => {
    const { el, removed } = setup([widget('a')]);
    key(cell(el, 'a'), 'Delete');
    key(cell(el, 'a'), 'Backspace');
    expect(removed).toHaveBeenCalledTimes(2);
    expect(removed).toHaveBeenCalledWith('a');
  });

  it('keyboard_respects_clamps', () => {
    const { el, moved, resized } = setup([widget('a', { layout: { x: 0, y: 0, w: 2, h: 1 } })]);
    const a = cell(el, 'a');
    key(a, 'ArrowLeft');
    key(a, 'ArrowUp');
    expect(moved).not.toHaveBeenCalled();
    key(a, 'ArrowLeft', true); // w already at minW 2
    key(a, 'ArrowUp', true); // h already at minH 1
    expect(resized).not.toHaveBeenCalled();
  });

  it('keyboard_resize_wraps_instead_of_stopping_at_the_right_edge', () => {
    const { el, moved, resized } = setup([widget('b', { layout: { x: 9, y: 0, w: 3, h: 1 } })]);
    key(cell(el, 'b'), 'ArrowRight');
    expect(moved).not.toHaveBeenCalled();
    key(cell(el, 'b'), 'ArrowRight', true);
    expect(resized).toHaveBeenLastCalledWith('b', 4, 1);
  });

  it('dragging_over_another_widget_takes_its_place_and_emits_only_on_up', () => {
    const { fixture, el, moved } = setup([widget('a', { layout: { x: 0, y: 0, w: 3, h: 2 } }), widget('b', { layout: { x: 3, y: 0, w: 3, h: 2 } })]);
    const handle = cell(el, 'a').querySelector('[data-drag-handle]') as HTMLElement;
    ptr('pointerdown', 10, 10, handle);
    ptr('pointermove', 353, 50, document);
    fixture.detectChanges();
    expect(moved).not.toHaveBeenCalled();
    // b steps aside into a's old place; the ghost shows where a lands.
    expect(cell(el, 'b').style.gridColumn).toBe('1 / span 3');
    const ghost = el.querySelector('[data-testid="grid-ghost"]') as HTMLElement;
    expect(ghost.style.gridColumn).toBe('4 / span 3');
    expect(ghost.style.gridRow).toBe('1 / span 2');
    ptr('pointerup', 353, 50, document);
    fixture.detectChanges();
    expect(moved).toHaveBeenCalledTimes(1);
    expect(moved).toHaveBeenCalledWith('a', 1);
    expect(el.querySelector('[data-testid="grid-ghost"]')).toBeNull();
  });

  it('resize_handle_emits_resized_on_up_and_clamps_to_size', () => {
    const { fixture, el, resized } = setup([widget('a')]);
    const handle = cell(el, 'a').querySelector('[data-resize-handle]') as HTMLElement;
    ptr('pointerdown', 0, 0, handle);
    ptr('pointermove', 202, 108, document);
    expect(resized).not.toHaveBeenCalled();
    ptr('pointerup', 202, 108, document);
    expect(resized).toHaveBeenLastCalledWith('a', 5, 3);
    // far beyond max (6x4) clamps to size.max
    ptr('pointerdown', 0, 0, handle);
    ptr('pointermove', 2000, 2000, document);
    ptr('pointerup', 2000, 2000, document);
    expect(resized).toHaveBeenLastCalledWith('a', 6, 4);
    // far below min (2x1) clamps to size.min
    ptr('pointerdown', 0, 0, handle);
    ptr('pointermove', -2000, -2000, document);
    ptr('pointerup', -2000, -2000, document);
    expect(resized).toHaveBeenLastCalledWith('a', 2, 1);
    fixture.detectChanges();
  });

  it('resize_previews_live_and_re_packs_the_neighbours_before_the_drop', () => {
    const { fixture, el, resized } = setup([widget('a', { layout: { x: 0, y: 0, w: 3, h: 2 } }), widget('b', { layout: { x: 3, y: 0, w: 3, h: 2 } })]);
    const handle = cell(el, 'a').querySelector('[data-resize-handle]') as HTMLElement;
    ptr('pointerdown', 0, 0, handle);
    ptr('pointermove', 101, 0, document);
    fixture.detectChanges();
    expect(resized).not.toHaveBeenCalled();
    expect(cell(el, 'a').style.gridColumn).toBe('1 / span 4');
    expect(cell(el, 'b').style.gridColumn).toBe('5 / span 3');
    expect(cell(el, 'b').style.gridRow).toBe('1 / span 2');
    ptr('pointerup', 101, 0, document);
    fixture.detectChanges();
    expect(resized).toHaveBeenCalledWith('a', 4, 2);
    // Back to the stored layout until the owner applies the resize.
    expect(cell(el, 'b').style.gridColumn).toBe('4 / span 3');
  });

  it('the_dragged_widget_follows_the_pointer_lifted_above_its_slot', () => {
    const { fixture, el } = setup([widget('a', { layout: { x: 0, y: 0, w: 3, h: 2 } }), widget('b', { layout: { x: 3, y: 0, w: 3, h: 2 } })]);
    const handle = cell(el, 'a').querySelector('[data-drag-handle]') as HTMLElement;
    ptr('pointerdown', 10, 10, handle);
    ptr('pointermove', 50, 40, document);
    fixture.detectChanges();
    expect(cell(el, 'a').style.transform).toBe('translate(40px, 30px) scale(1.02)');
    expect(cell(el, 'b').style.gridColumn).toBe('4 / span 3');

    ptr('pointermove', 353, 50, document);
    fixture.detectChanges();
    // a is laid out in b's old slot and shifted back so it stays under the pointer.
    expect(cell(el, 'a').style.gridColumn).toBe('4 / span 3');
    expect(cell(el, 'a').style.transform).toBe('translate(40px, 40px) scale(1.02)');
    ptr('pointerup', 353, 50, document);
    fixture.detectChanges();
    expect(cell(el, 'a').style.transform).toBe('');
  });

  it('dragging_below_every_widget_moves_it_to_the_end', () => {
    const { el, moved } = setup([
      widget('a', { layout: { x: 0, y: 0, w: 3, h: 2 } }),
      widget('b', { layout: { x: 3, y: 0, w: 3, h: 2 } }),
      widget('c', { layout: { x: 6, y: 0, w: 3, h: 2 } })
    ]);
    const handle = cell(el, 'a').querySelector('[data-drag-handle]') as HTMLElement;
    ptr('pointerdown', 10, 10, handle);
    ptr('pointermove', 10, 5000, document);
    ptr('pointerup', 10, 5000, document);
    expect(moved).toHaveBeenLastCalledWith('a', 2);
  });

  it('does_not_emit_when_cell_unchanged', () => {
    const { el, moved, resized } = setup([widget('a')]);
    const drag = cell(el, 'a').querySelector('[data-drag-handle]') as HTMLElement;
    ptr('pointerdown', 10, 10, drag);
    ptr('pointermove', 30, 20, document);
    ptr('pointerup', 30, 20, document);
    expect(moved).not.toHaveBeenCalled();
    const rs = cell(el, 'a').querySelector('[data-resize-handle]') as HTMLElement;
    ptr('pointerdown', 10, 10, rs);
    ptr('pointermove', 30, 20, document);
    ptr('pointerup', 30, 20, document);
    expect(resized).not.toHaveBeenCalled();
  });

  it('escape_cancels_drag', () => {
    const { fixture, el, moved } = setup([widget('a')]);
    const handle = cell(el, 'a').querySelector('[data-drag-handle]') as HTMLElement;
    ptr('pointerdown', 0, 0, handle);
    ptr('pointermove', 303, 0, document);
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="grid-ghost"]')).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="grid-ghost"]')).toBeNull();
    ptr('pointerup', 303, 0, document);
    expect(moved).not.toHaveBeenCalled();
  });

  it('view_mode_has_no_tabindex_handles_or_aria_label', () => {
    const { el } = setup([widget('a')], false);
    const a = cell(el, 'a');
    expect(a.hasAttribute('tabindex')).toBe(false);
    expect(a.hasAttribute('aria-label')).toBe(false);
    expect(a.querySelector('[data-drag-handle]')).toBeNull();
    key(a, 'ArrowRight');
  });

  it('team_widgets_keep_deep_link_anchor_ids', () => {
    const { el } = setup(
      [
        widget('s', { widgetKey: 'team-status' }),
        widget('p', { widgetKey: 'team-progress' }),
        widget('c', { widgetKey: 'action-center' })
      ],
      false
    );
    expect(el.querySelector('#my-team-widget-teamStatus')).not.toBeNull();
    expect(el.querySelector('#my-team-widget-teamProgress')).not.toBeNull();
    const ac = el.querySelector('#my-team-widget-actionCenter') as HTMLElement;
    expect(ac).not.toBeNull();
    expect(ac.classList.contains('scroll-mt-4')).toBe(true);
  });

  it('edit_cell_is_a_described_widget_group_and_handles_are_hidden_from_assistive_tech', () => {
    const { el } = setup([widget('a')]);
    const a = cell(el, 'a');
    expect(a.getAttribute('role')).toBe('group');
    expect(a.getAttribute('aria-roledescription')).toBe('widget');
    const describedBy = a.getAttribute('aria-describedby')!;
    expect(describedBy).toBeTruthy();
    const help = el.querySelector('#' + describedBy) as HTMLElement;
    expect(help.classList.contains('sr-only')).toBe(true);
    expect(help.textContent).toContain('arrow keys');
    const drag = a.querySelector('[data-drag-handle]') as HTMLElement;
    const resize = a.querySelector('[data-resize-handle]') as HTMLElement;
    for (const h of [drag, resize]) {
      expect(h.getAttribute('aria-hidden')).toBe('true');
      expect(h.hasAttribute('aria-label')).toBe(false);
    }
  });

  it('view_mode_cell_has_no_group_role_or_live_region', () => {
    const { el } = setup([widget('a')], false);
    const a = cell(el, 'a');
    expect(a.hasAttribute('role')).toBe(false);
    expect(a.hasAttribute('aria-roledescription')).toBe(false);
    expect(a.hasAttribute('aria-describedby')).toBe(false);
    expect(el.querySelector('[data-testid="grid-live"]')).toBeNull();
  });

  it('announces_the_new_position_and_size_after_keyboard_move_and_resize', () => {
    const b = widget('b', { layout: { x: 0, y: 0, w: 2, h: 2 } });
    const { fixture, el } = setup([widget('a'), b]);
    const live = () => (el.querySelector('[data-testid="grid-live"]') as HTMLElement);
    expect(live().getAttribute('aria-live')).toBe('polite');
    key(cell(el, 'a'), 'ArrowUp');
    // The owner re-packs the layout; announce where the widget settled.
    fixture.componentRef.setInput('widgets', [widget('a', { layout: { x: 0, y: 0, w: 3, h: 2 } }), { ...b, layout: { x: 3, y: 0, w: 2, h: 2 } }]);
    fixture.detectChanges();
    expect(live().textContent).toContain('Widget a moved to column 1, row 1');
    key(cell(el, 'a'), 'ArrowRight', true);
    fixture.componentRef.setInput('widgets', [widget('a', { layout: { x: 0, y: 0, w: 4, h: 2 } }), { ...b, layout: { x: 4, y: 0, w: 2, h: 2 } }]);
    fixture.detectChanges();
    expect(live().textContent).toContain('Widget a resized to width 4, height 2');
  });

  it('delete_moves_focus_to_the_next_cell_else_the_previous_else_requests_outside_focus', () => {
    const ws = [widget('a', { layout: { x: 0, y: 0, w: 3, h: 2 } }), widget('b', { layout: { x: 3, y: 0, w: 3, h: 2 } }), widget('c', { layout: { x: 6, y: 0, w: 3, h: 2 } })];
    const { fixture, el } = setup(ws);
    const outside = vi.fn();
    fixture.componentInstance.focusOutside.subscribe(() => outside());
    cell(el, 'b').focus();
    key(cell(el, 'b'), 'Delete');
    expect(document.activeElement).toBe(cell(el, 'c'));
    fixture.componentRef.setInput('widgets', [ws[0], ws[2]]);
    fixture.detectChanges();
    key(cell(el, 'c'), 'Delete');
    expect(document.activeElement).toBe(cell(el, 'a'));
    fixture.componentRef.setInput('widgets', [ws[0]]);
    fixture.detectChanges();
    key(cell(el, 'a'), 'Delete');
    expect(outside).toHaveBeenCalledTimes(1);
  });

  it('frame_remove_is_reemitted_as_removed', () => {
    const { el, removed } = setup([widget('a')]);
    (el.querySelector('button[aria-label="Remove Widget a"]') as HTMLButtonElement).click();
    expect(removed).toHaveBeenCalledWith('a');
  });
});
