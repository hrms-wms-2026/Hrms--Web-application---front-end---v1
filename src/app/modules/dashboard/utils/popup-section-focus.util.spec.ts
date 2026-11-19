import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { injectPopupSectionFocus } from './popup-section-focus.util';

@Component({
  standalone: true,
  template: `
    @if (open()) {
      <section data-section="trend">Trend</section>
      <section data-section="ranking">Ranking</section>
    }
  `
})
class DialogComponent {
  readonly open = input(false);
  readonly focusSection = input<string | null>(null);
  constructor() {
    injectPopupSectionFocus(this.open, this.focusSection);
  }
}

describe('injectPopupSectionFocus', () => {
  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('scrolls the asked-for section into view once the popup opens', () => {
    vi.useFakeTimers();
    const scrolled: string[] = [];
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this.getAttribute('data-section') ?? '');
    };
    const fixture = TestBed.createComponent(DialogComponent);
    fixture.componentRef.setInput('focusSection', 'ranking');
    fixture.detectChanges();
    vi.runAllTimers();
    expect(scrolled).toEqual([]);

    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    vi.runAllTimers();
    expect(scrolled).toEqual(['ranking']);
  });

  it('does nothing without a section', () => {
    vi.useFakeTimers();
    const scrolled: string[] = [];
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push('x');
    };
    const fixture = TestBed.createComponent(DialogComponent);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    vi.runAllTimers();
    expect(scrolled).toEqual([]);
  });
});
