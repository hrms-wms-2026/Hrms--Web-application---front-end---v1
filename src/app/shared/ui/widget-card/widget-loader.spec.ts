import { HttpErrorResponse } from '@angular/common/http';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { createWidgetLoader } from './widget-loader';

@Component({ standalone: true, template: '' })
class HostComponent {
  readonly id = signal('a');
  source: (id: string) => Observable<string> | null = (id) => of(`data-${id}`);
  readonly loader = createWidgetLoader<string>(() => this.source(this.id()), { isEmpty: (v) => v === '' });
}

describe('createWidgetLoader', () => {
  function setup(source?: HostComponent['source']) {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    if (source) fixture.componentInstance.source = source;
    return { fixture, host: fixture.componentInstance };
  }

  it('starts loading, then exposes ready data', () => {
    const subject = new Subject<string>();
    const { fixture, host } = setup(() => subject.asObservable());
    fixture.detectChanges();

    expect(host.loader.state()).toBe('loading');
    expect(host.loader.data()).toBeNull();

    subject.next('hello');
    expect(host.loader.state()).toBe('ready');
    expect(host.loader.data()).toBe('hello');
  });

  it('reports empty when isEmpty says so', () => {
    const { fixture, host } = setup(() => of(''));
    fixture.detectChanges();

    expect(host.loader.state()).toBe('empty');
  });

  it('maps a 403 to forbidden and any other error to error, clearing data', () => {
    const forbidden = setup(() => throwError(() => new HttpErrorResponse({ status: 403 })));
    forbidden.fixture.detectChanges();
    expect(forbidden.host.loader.state()).toBe('forbidden');
    expect(forbidden.host.loader.data()).toBeNull();

    TestBed.resetTestingModule();
    const failed = setup(() => throwError(() => new HttpErrorResponse({ status: 500 })));
    failed.fixture.detectChanges();
    expect(failed.host.loader.state()).toBe('error');
  });

  it('refetches when a tracked signal changes and ignores the stale in-flight response', () => {
    const first = new Subject<string>();
    const second = new Subject<string>();
    const source = vi.fn((id: string) => (id === 'a' ? first : second).asObservable());
    const { fixture, host } = setup(source);
    fixture.detectChanges();

    host.id.set('b');
    fixture.detectChanges();
    expect(source).toHaveBeenCalledTimes(2);

    first.next('stale');
    expect(host.loader.state()).toBe('loading');
    expect(host.loader.data()).toBeNull();

    second.next('fresh');
    expect(host.loader.state()).toBe('ready');
    expect(host.loader.data()).toBe('fresh');
  });

  it('reload() issues the request again', () => {
    const source = vi.fn((id: string) => of(`data-${id}`));
    const { fixture, host } = setup(source);
    fixture.detectChanges();

    host.loader.reload();
    fixture.detectChanges();

    expect(source).toHaveBeenCalledTimes(2);
    expect(host.loader.state()).toBe('ready');
  });

  it('stays loading and makes no request while the source returns null', () => {
    const { fixture, host } = setup(() => null);
    fixture.detectChanges();

    expect(host.loader.state()).toBe('loading');
    expect(host.loader.data()).toBeNull();
  });

  it('unsubscribes from an in-flight request when the host is destroyed', () => {
    const subject = new Subject<string>();
    const { fixture } = setup(() => subject.asObservable());
    fixture.detectChanges();
    expect(subject.observed).toBe(true);

    fixture.destroy();

    expect(subject.observed).toBe(false);
  });
});
