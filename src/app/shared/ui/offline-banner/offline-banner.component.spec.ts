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
    const region = () => el.querySelector('[role="status"]');
    // The live region is always there, empty while online, so its text is announced when it appears.
    expect(region()).not.toBeNull();
    expect(region()?.textContent?.trim()).toBe('');

    online.set(false);
    fixture.detectChanges();
    expect(region()?.textContent?.trim()).toBe('You are offline. Changes will not be saved until the connection is back.');

    online.set(true);
    fixture.detectChanges();
    expect(region()?.textContent?.trim()).toBe('');
  });
});
