import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { StopClickPropagationDirective } from './stop-click-propagation.directive';

@Component({
  imports: [StopClickPropagationDirective],
  template: `
    <div class="outer" role="presentation" (click)="outerClicks = outerClicks + 1">
      <div class="shield" appStopClickPropagation>
        <button type="button" class="inner" (click)="innerClicks = innerClicks + 1">Inner</button>
      </div>
      <button type="button" class="sibling">Sibling</button>
    </div>
  `
})
class HostComponent {
  outerClicks = 0;
  innerClicks = 0;
}

describe('StopClickPropagationDirective', () => {
  function setup() {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return { host: fixture.componentInstance, el };
  }

  it('lets clicks inside the shield reach their own handlers but not the ancestor', () => {
    const { host, el } = setup();

    (el.querySelector('.inner') as HTMLButtonElement).click();

    expect(host.innerClicks).toBe(1);
    expect(host.outerClicks).toBe(0);
  });

  it('leaves clicks outside the shield alone', () => {
    const { host, el } = setup();

    (el.querySelector('.sibling') as HTMLButtonElement).click();

    expect(host.outerClicks).toBe(1);
  });
});
