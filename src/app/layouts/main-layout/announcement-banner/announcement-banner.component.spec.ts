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

  const mixed = [
    { id: 'i1', title: 'New export', body: 'Payroll exports are faster.', severity: 'info' },
    { id: 'w1', title: 'Maintenance', body: 'Tonight 23:00 to 23:30.', severity: 'warning' },
    { id: 'c1', title: 'Clock-in failing', body: 'We are on it.', severity: 'critical' }
  ];

  function strips(el: HTMLElement): HTMLElement[] {
    return Array.from(el.querySelectorAll<HTMLElement>('[data-testid="announcement-strip"]'));
  }

  it('shows one strip per announcement, critical first, then warning, then info, each with an icon', () => {
    const fixture = render();
    http.expectOne(`${environment.apiUrl}/announcements/active`).flush(mixed);
    fixture.detectChanges();

    const found = strips(fixture.nativeElement);
    expect(found.map((s) => s.dataset['severity'])).toEqual(['critical', 'warning', 'info']);
    for (const strip of found) {
      expect(strip.querySelector('[data-testid="announcement-icon"]')).not.toBeNull();
    }
  });

  it('lets a long body be expanded and collapsed again', () => {
    const fixture = render();
    const long = 'CROWNUS will be unavailable while we move the database to a larger server. Expect about 30 minutes of downtime.';
    http.expectOne(`${environment.apiUrl}/announcements/active`).flush([
      { id: 'w2', title: 'Database move', body: long, severity: 'warning' }
    ]);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const more = el.querySelector('[data-testid="announcement-more"]') as HTMLButtonElement;
    const body = el.querySelector('[data-testid="announcement-body"]') as HTMLElement;
    expect(more.getAttribute('aria-expanded')).toBe('false');
    expect(body.classList).toContain('truncate');

    more.click();
    fixture.detectChanges();
    expect(more.getAttribute('aria-expanded')).toBe('true');
    expect(more.textContent?.trim()).toBe('Less');
    expect(body.classList).not.toContain('truncate');

    more.click();
    fixture.detectChanges();
    expect(more.getAttribute('aria-expanded')).toBe('false');
    expect(body.classList).toContain('truncate');
  });

  it('shows no More button for a short body', () => {
    const fixture = render();
    http.expectOne(`${environment.apiUrl}/announcements/active`).flush([mixed[1]]);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="announcement-more"]')).toBeNull();
  });

  it('renders nothing when the feed fails', () => {
    const fixture = render();
    http.expectOne(`${environment.apiUrl}/announcements/active`).flush('down', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent?.trim()).toBe('');
  });
});
