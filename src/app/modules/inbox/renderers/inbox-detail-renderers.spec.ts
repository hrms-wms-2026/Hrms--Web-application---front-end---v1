import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { INBOX_DETAIL_RENDERERS, InboxDetailRendererRegistry, parseExtra } from './inbox-detail-renderers';

@Component({ selector: 'app-x', standalone: true, template: '' })
class XRendererComponent {}

describe('InboxDetailRendererRegistry', () => {
  it('resolves a registered key and falls back to null for unknown or missing keys', () => {
    TestBed.configureTestingModule({ providers: [{ provide: INBOX_DETAIL_RENDERERS, useValue: { x: XRendererComponent } }] });
    const registry = TestBed.inject(InboxDetailRendererRegistry);

    expect(registry.resolve('x')).toBe(XRendererComponent);
    expect(registry.resolve('y')).toBeNull();
    expect(registry.resolve(null)).toBeNull();
  });

  it('parses the extra payload and tolerates bad JSON', () => {
    expect(parseExtra('{"a":1}')).toEqual({ a: 1 });
    expect(parseExtra('not json')).toBeNull();
    expect(parseExtra('3')).toBeNull();
    expect(parseExtra(null)).toBeNull();
  });
});
