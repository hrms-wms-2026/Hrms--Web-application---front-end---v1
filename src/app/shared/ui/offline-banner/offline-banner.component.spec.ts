import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NetworkStatusService } from '../../../core/network/network-status.service';
import { OfflineBannerComponent } from './offline-banner.component';

describe('OfflineBannerComponent', () => {
  it('shows a status message only while the browser is offline', () => {
    const online = signal(true);
    TestBed.configureTestingModule({ providers: [{ provide: NetworkStatusService, useValue: { online } }] });
    const fixture = TestBed.createComponent(OfflineBannerComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[role="status"]')).toBeNull();

    online.set(false);
    fixture.detectChanges();
    const banner = el.querySelector('[role="status"]');
    expect(banner?.textContent?.trim()).toBe('You are offline. Changes will not be saved until the connection is back.');

    online.set(true);
    fixture.detectChanges();
    expect(el.querySelector('[role="status"]')).toBeNull();
  });
});
