import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AnnouncementBannerComponent } from './announcement-banner.component';
import { environment } from '../../../../environments/environment';

describe('AnnouncementBannerComponent', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [AnnouncementBannerComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function render() {
    const fixture = TestBed.createComponent(AnnouncementBannerComponent);
    fixture.detectChanges();
    return fixture;
  }

  const feed = [
    { id: 'a1', title: 'Scheduled maintenance', body: 'Sunday 02:00 UTC', severity: 'warning', published_at: null },
    { id: 'a2', title: 'Email delays', body: 'Notifications may arrive late', severity: 'critical', published_at: null }
  ];

  it('shows the published announcements, critical ones as alerts', () => {
    const fixture = render();
    http.expectOne(`${environment.apiUrl}/announcements/active`).flush(feed);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Scheduled maintenance');
    expect(el.textContent).toContain('Notifications may arrive late');
    expect(el.querySelectorAll('[role="alert"]').length).toBe(1);
  });

  it('hides an announcement once dismissed', () => {
    const fixture = render();
    http.expectOne(`${environment.apiUrl}/announcements/active`).flush(feed);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    (el.querySelector('button[aria-label="Dismiss announcement: Email delays"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(el.textContent).not.toContain('Email delays');
    expect(el.textContent).toContain('Scheduled maintenance');
  });

  it('renders nothing when the feed fails', () => {
    const fixture = render();
    http.expectOne(`${environment.apiUrl}/announcements/active`).flush('down', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent?.trim()).toBe('');
  });
});
