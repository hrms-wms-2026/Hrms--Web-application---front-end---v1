import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { DashboardInsightsBannerComponent } from './dashboard-insights-banner.component';

describe('DashboardInsightsBannerComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function setup(): Promise<ComponentFixture<DashboardInsightsBannerComponent>> {
    await TestBed.configureTestingModule({
      imports: [DashboardInsightsBannerComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    const fixture = TestBed.createComponent(DashboardInsightsBannerComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('renders the heading text "More insights about your performance and activity"', async () => {
    const fixture = await setup();
    expect(fixture.nativeElement.textContent).toContain('More insights about your performance and activity');
  });

  it('both links have the correct hrefs: /dashboard/insights and /dashboard/activity-timeline', async () => {
    const fixture = await setup();
    expect(fixture.nativeElement.querySelector('[data-testid="dashboard-insights-banner-insights-link"]').getAttribute('href')).toBe(
      '/dashboard/insights'
    );
    expect(fixture.nativeElement.querySelector('[data-testid="dashboard-insights-banner-timeline-link"]').getAttribute('href')).toBe(
      '/dashboard/activity-timeline'
    );
  });
});
