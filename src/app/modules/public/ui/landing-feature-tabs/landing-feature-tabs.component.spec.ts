import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { LandingFeatureTabsComponent } from './landing-feature-tabs.component';

describe('LandingFeatureTabsComponent keyboard access', () => {
  afterEach(() => TestBed.resetTestingModule());

  function setup() {
    const fixture = TestBed.createComponent(LandingFeatureTabsComponent);
    fixture.detectChanges();
    const tabs = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.tabs-sec__tab-item'));
    return { fixture, tabs };
  }

  it('makes every feature tab a focusable button that reports whether it is selected', () => {
    const { tabs } = setup();

    expect(tabs).toHaveLength(4);
    for (const tab of tabs) {
      expect(tab.getAttribute('role')).toBe('button');
      expect(tab.getAttribute('tabindex')).toBe('0');
    }
    expect(tabs.map((t) => t.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false', 'false']);
  });

  it('selects a tab with Enter', () => {
    const { fixture, tabs } = setup();

    tabs[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    fixture.detectChanges();

    expect(fixture.componentInstance.activeTab()).toBe('intelligence');
    expect(tabs[2].getAttribute('aria-pressed')).toBe('true');
    expect(tabs[0].getAttribute('aria-pressed')).toBe('false');
  });

  it('selects a tab with Space', () => {
    const { fixture, tabs } = setup();

    tabs[1].dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
    fixture.detectChanges();

    expect(fixture.componentInstance.activeTab()).toBe('hr');
  });
});
