import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { KeyboardClickDirective } from './keyboard-click.directive';

@Component({
  imports: [KeyboardClickDirective],
  template: `
    <div class="card" role="button" tabindex="0" appKeyboardClick (click)="clicks = clicks + 1">
      <input class="inner-input" />
    </div>
  `
})
class HostComponent {
  clicks = 0;
}

describe('KeyboardClickDirective', () => {
  function setup() {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return { host: fixture.componentInstance, card: el.querySelector('.card') as HTMLElement, input: el.querySelector('.inner-input') as HTMLInputElement };
  }

  function press(target: HTMLElement, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    return event;
  }

  it.each(['Enter', ' '])('fires the host click on %j and prevents the default', (key) => {
    const { host, card } = setup();

    const event = press(card, key);

    expect(host.clicks).toBe(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('ignores other keys', () => {
    const { host, card } = setup();

    press(card, 'a');
    press(card, 'Tab');

    expect(host.clicks).toBe(0);
  });

  it('ignores Enter pressed in a nested element', () => {
    const { host, input } = setup();

    const event = press(input, 'Enter');

    expect(host.clicks).toBe(0);
    expect(event.defaultPrevented).toBe(false);
  });

  it('ignores auto-repeat so holding Enter does not fire repeatedly', () => {
    const { host, card } = setup();

    press(card, 'Enter', { repeat: true });

    expect(host.clicks).toBe(0);
  });
});
