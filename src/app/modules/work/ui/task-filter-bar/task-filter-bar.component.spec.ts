import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HIGHLIGHT_SWATCHES, TaskFilterBarComponent, TaskFilterFieldConfig } from './task-filter-bar.component';

describe('TaskFilterBarComponent', () => {
  let fixture: ComponentFixture<TaskFilterBarComponent>;

  const fields: TaskFilterFieldConfig[] = [
    { key: 'priority', label: 'Priority', icon: 'priority', kind: 'multi', options: [{ value: 'high', label: 'High' }] }
  ];

  function setup(inputs: Record<string, unknown> = {}): void {
    fixture = TestBed.createComponent(TaskFilterBarComponent);
    fixture.componentRef.setInput('fields', fields);
    for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
    fixture.detectChanges();
  }

  function query(selector: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(selector);
  }

  function openPanel(): void {
    (query('.tfb__trigger-btn') as HTMLElement).click();
    fixture.detectChanges();
  }

  it('shows no highlight color row by default (board/backlog usage is unchanged)', () => {
    setup();
    openPanel();
    expect(query('[data-testid="highlight-color-row"]')).toBeNull();
    expect(query('[data-testid="highlight-color-dot"]')).toBeNull();
    expect(query('.tfb__trigger-btn')?.textContent).toContain('Filter');
  });

  describe('with a highlight color', () => {
    beforeEach(() => setup({ highlightColor: HIGHLIGHT_SWATCHES[0] }));

    it('labels the trigger "Highlight" and shows the current color dot', () => {
      expect(query('.tfb__trigger-btn')?.textContent).toContain('Highlight');
      const dot = query('[data-testid="highlight-color-dot"]') as HTMLElement;
      expect(dot.style.background).not.toBe('');
    });

    it('renders one swatch per preset plus a custom color input, and marks the current one', () => {
      openPanel();
      const swatches = fixture.nativeElement.querySelectorAll('[data-testid="highlight-swatch"]');
      expect(swatches.length).toBe(HIGHLIGHT_SWATCHES.length);
      expect((swatches[0] as HTMLElement).getAttribute('aria-pressed')).toBe('true');
      expect((swatches[1] as HTMLElement).getAttribute('aria-pressed')).toBe('false');
      expect(query('[data-testid="highlight-custom-color"]')).not.toBeNull();
    });

    it('emits highlightColorChanged when a swatch is picked', () => {
      const emitted: string[] = [];
      fixture.componentInstance.highlightColorChanged.subscribe((c) => emitted.push(c));
      openPanel();
      (fixture.nativeElement.querySelectorAll('[data-testid="highlight-swatch"]')[2] as HTMLElement).click();
      expect(emitted).toEqual([HIGHLIGHT_SWATCHES[2]]);
    });

    it('emits highlightColorChanged from the custom color input', () => {
      const emitted: string[] = [];
      fixture.componentInstance.highlightColorChanged.subscribe((c) => emitted.push(c));
      openPanel();
      const input = query('[data-testid="highlight-custom-color"]') as HTMLInputElement;
      input.value = '#123456';
      input.dispatchEvent(new Event('input'));
      expect(emitted).toEqual(['#123456']);
    });
  });

  it('anchors the panel to the left edge when panelAlign is left', () => {
    setup({ panelAlign: 'left' });
    openPanel();
    expect(query('.tfb__panel')?.classList).toContain('tfb__panel--left');
  });
});
