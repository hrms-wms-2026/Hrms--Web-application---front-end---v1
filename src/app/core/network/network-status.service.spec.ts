import { TestBed } from '@angular/core/testing';
import { NetworkStatusService } from './network-status.service';

describe('NetworkStatusService', () => {
  const original = Object.getOwnPropertyDescriptor(Navigator.prototype, 'onLine');
  const setOnline = (value: boolean) => Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => value });

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'onLine');
    if (original) Object.defineProperty(Navigator.prototype, 'onLine', original);
  });

  it('starts from navigator.onLine and follows the offline and online events', () => {
    setOnline(false);
    const service = TestBed.inject(NetworkStatusService);
    expect(service.online()).toBe(false);

    window.dispatchEvent(new Event('online'));
    expect(service.online()).toBe(true);
    window.dispatchEvent(new Event('offline'));
    expect(service.online()).toBe(false);
  });

  it('stops listening when the app is torn down', () => {
    setOnline(true);
    const service = TestBed.inject(NetworkStatusService);
    TestBed.resetTestingModule();
    window.dispatchEvent(new Event('offline'));
    expect(service.online()).toBe(true);
  });
});
