import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { BackToHomeLinkComponent } from './back-to-home-link.component';

describe('BackToHomeLinkComponent', () => {
  it('links to the dashboard home route and labels itself "Back to Home"', async () => {
    await TestBed.configureTestingModule({
      imports: [BackToHomeLinkComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    const fixture = TestBed.createComponent(BackToHomeLinkComponent);
    fixture.detectChanges();

    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('[data-testid="back-to-home-link"]');
    expect(link.getAttribute('href')).toBe('/dashboard');
    expect(link.textContent?.trim()).toContain('Back to Home');
  });
});
